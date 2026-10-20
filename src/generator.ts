import * as vscode from 'vscode'
import { ZodError } from 'zod'
import * as ai from './ai'
import { isLowQualityCommit } from './commitQuality'
import { config } from './config'
import { OLLAMA_LIBRARY_URL } from './constants'
import { truncateDiffForPrompt } from './promptStrategy'
import { createChatAdapter } from './providers'
import { buildOpenAICompatibleModelOptions } from './providers/openaiCompatibleOptions'
import {
	buildCommitSchema,
	type CommitStructure,
	parseCommitResponse,
} from './schemas/commit'
import { extractJsonObject } from './schemas/jsonExtract'
import { formatExtensionError, logExtensionError } from './security/log'
import { wrapUntrustedContent } from './security/prompt'
import type { EmojisMap } from './types/llm'

export type ChangeSummary = {
	file: string
	summary: string
}

export type CommitPromptSource =
	| { kind: 'summaries'; summaries: ChangeSummary[] }
	| { kind: 'diff'; diff: string }

function isModelNotFoundError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false
	}

	const candidate = error as {
		status_code?: number
		message?: string
		cause?: unknown
	}
	if (candidate.status_code === 404) {
		return true
	}

	if (
		typeof candidate.message === 'string' &&
		/not found/i.test(candidate.message)
	) {
		return true
	}

	if (candidate.cause) {
		return isModelNotFoundError(candidate.cause)
	}

	return false
}

function isStructuredOutputCompatibilityError(error: unknown): boolean {
	const message = formatExtensionError(error).toLowerCase()
	return (
		message.includes('structured output generation failed') ||
		message.includes('failed to parse structured output as json') ||
		message.includes('does not support structured outputs')
	)
}

function isJsonResponseValidationError(error: unknown): boolean {
	return (
		error instanceof ZodError ||
		(error instanceof Error &&
			error.message.includes('Could not find a JSON object in the model response'))
	)
}

type ChatTextResult = {
	text?: string
	chunks?: Array<{ type?: string; delta?: string }>
}

/** Collect assistant text; fall back to reasoning deltas when content is empty. */
function getChatResultText(result: string | ChatTextResult): string {
	if (typeof result === 'string') {
		return result
	}

	if (result.text?.trim()) {
		return result.text
	}

	const parts: string[] = []
	for (const chunk of result.chunks ?? []) {
		if (
			typeof chunk.delta === 'string' &&
			chunk.delta &&
			typeof chunk.type === 'string' &&
			(chunk.type === 'TEXT_MESSAGE_CONTENT' ||
				chunk.type.includes('REASONING_MESSAGE_CONTENT'))
		) {
			parts.push(chunk.delta)
		}
	}
	return parts.join('')
}

function parseJsonCommitResponse(
	rawText: string,
	useDescription: boolean,
	language: string,
): CommitStructure {
	try {
		return parseCommitResponse(
			extractJsonObject(rawText),
			useDescription,
			language,
		)
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === 'Could not find a JSON object in the model response'
		) {
			const preview = rawText.trim().slice(0, 240)
			throw new Error(
				preview
					? `Could not find a JSON object in the model response. Raw: ${preview}`
					: 'Could not find a JSON object in the model response (empty model output). Try a higher token limit or a model that follows JSON instructions.',
			)
		}
		throw error
	}
}

function formatChangeSummaries(summaries: ChangeSummary[]): string {
	return summaries
		.map(({ file, summary }) => `- ${file}: ${summary}`)
		.join('\n')
}

/** Normalize HEAD name for prompts; undefined when detached/unnamed. */
export function normalizeBranchName(
	branchName?: string | null,
): string | undefined {
	const trimmed = branchName?.trim()
	return trimmed ? trimmed : undefined
}

function buildBranchSection(branchName?: string | null): string {
	const normalizedBranch = normalizeBranchName(branchName)
	return normalizedBranch
		? `Current git branch (optional context only; may inform ticket or feature naming but must not invent changes):\n${wrapUntrustedContent('branch', normalizedBranch)}\n\n`
		: 'Current git branch: detached HEAD or unnamed (optional context only).\n\n'
}

export function buildCommitUserContent(
	summaries: ChangeSummary[],
	branchName?: string | null,
): string {
	const wrappedSummaries = wrapUntrustedContent(
		'summaries',
		formatChangeSummaries(summaries),
	)

	return `${buildBranchSection(branchName)}Staged change summaries:\n${wrappedSummaries}`
}

export function buildCommitDiffUserContent(
	diff: string,
	branchName?: string | null,
): string {
	const wrappedDiff = wrapUntrustedContent(
		'diff',
		truncateDiffForPrompt(diff),
	)

	return `${buildBranchSection(branchName)}Staged git diff:\n${wrappedDiff}`
}

function buildCommitUserContentFromSource(
	source: CommitPromptSource,
	branchName?: string | null,
): string {
	if (source.kind === 'diff') {
		return buildCommitDiffUserContent(source.diff, branchName)
	}
	return buildCommitUserContent(source.summaries, branchName)
}

function buildStructuredPrompt(options: {
	typeRules: string
	commitMessageRules: string
	language: string
	useDescription: boolean
	descriptionPrompt: string
	customPrompt?: string
	extraInstruction?: string
	jsonOnly?: boolean
	sourceKind: CommitPromptSource['kind']
}): string {
	const {
		typeRules,
		commitMessageRules,
		language,
		useDescription,
		descriptionPrompt,
		customPrompt,
		extraInstruction,
		jsonOnly,
		sourceKind,
	} = options

	const changeSource =
		sourceKind === 'diff' ? 'staged git diff' : 'change summaries'

	const basePrompt =
		customPrompt ||
		`You are an expert developer specialist in creating commit messages.
	Based on the provided user changes, generate a commit message with the appropriate type.

	Rules for commit type:
	${typeRules}
	- Use "docs" only when the ${changeSource} clearly describes documentation changes (README, docs/, comments, or .md files)
	- Do not guess "docs" from code-only changes

	Rules for commit message:
	${commitMessageRules}
	- Write the message in ${language}
	- Describe only what is present in the ${changeSource}
	- Never say the commit is empty, has no changes, or that input is missing
	- Do not invent files, features, or changes that are not in the ${changeSource}
	- You may use the current branch name as optional context (for example ticket IDs)
	- Never invent work from the branch name alone; ground the message in the ${changeSource}

	${useDescription ? descriptionPrompt : ''}
	Respond using JSON`

	const jsonOnlyInstruction = jsonOnly
		? `Respond with exactly one valid JSON object and nothing else. Do not use Markdown, code fences, or explanatory text. Required fields: ${useDescription ? '{"type":"feat","message":"Brief commit subject","summary":"One to three sentence commit description"}' : '{"type":"feat","message":"Brief commit subject"}'}. The type value must be one of: feat, fix, docs, style, test, chore, revert, refactor.`
		: undefined

	const instructions = [extraInstruction, jsonOnlyInstruction].filter(Boolean)

	if (instructions.length === 0) {
		return basePrompt
	}

	return `${basePrompt}\n\n${instructions.join('\n\n')}`
}

async function requestStructuredCommit(
	source: CommitPromptSource,
	options?: {
		extraInstruction?: string
		branchName?: string | null
		jsonOnly?: boolean
	},
): Promise<CommitStructure> {
	const {
		provider,
		promptTemperature,
		language,
		useDescription,
		customPrompt,
		customTypeRules,
		customCommitMessageRules,
		customDescriptionPrompt,
	} = config.inference
	const jsonOnly =
		options?.jsonOnly ?? provider === 'openai-compatible'

	const typeRules =
		customTypeRules ||
		`- feat: Only when adding a new feature
	- fix: When fixing a bug
	- docs: When updating documentation
	- style: When changing elements styles or design and/or making changes to the code style (formatting, missing semicolons, etc.) without changing the code logic
	- test: When adding or updating tests
	- chore: When making changes to the build process or auxiliary tools and libraries
	- revert: When undoing a previous commit
	- refactor: When restructuring code without changing its external behavior`

	const commitMessageRules =
		customCommitMessageRules ||
		`- Be concise and descriptive
	- Keep under 50 characters
	- Describe the main goal of the changes
	- Do not include the type in the message (it will be separate)`

	const descriptionPrompt =
		customDescriptionPrompt ||
		'Also provide an extended summary (1-3 sentences) that describes the changes in more detail for the commit description.'

	const structuredPrompt = buildStructuredPrompt({
		typeRules,
		commitMessageRules,
		language,
		useDescription,
		descriptionPrompt,
		customPrompt,
		extraInstruction: options?.extraInstruction,
		jsonOnly,
		sourceKind: source.kind,
	})

	const chatBase = {
		adapter: createChatAdapter(),
		systemPrompts: [structuredPrompt],
		messages: [
			{
				role: 'user' as const,
				content: buildCommitUserContentFromSource(source, options?.branchName),
			},
		],
	}

	if (jsonOnly) {
		// Local OpenAI-compatible servers often stream under the hood even when
		// chat({ stream: false }) is set. Reasoning models can spend most of a
		// small max_tokens budget on thinking and return empty/non-JSON content.
		const result = await ai.chat({
			...chatBase,
			stream: false,
			reasoning: false,
			modelOptions: buildOpenAICompatibleModelOptions({
				temperature: promptTemperature,
				maxTokens: 2048,
			}),
		})
		return parseJsonCommitResponse(
			getChatResultText(result),
			useDescription,
			language,
		)
	}

	const outputSchema = buildCommitSchema(useDescription, language)
	const result = await ai.chat({
		...chatBase,
		outputSchema,
		reasoning: false,
		modelOptions: {
			options: {
				temperature: promptTemperature,
				num_predict: 256,
			},
		},
	})

	return parseCommitResponse(result, useDescription, language)
}

async function generateStructuredCommitFromSource(
	source: CommitPromptSource,
	branchName?: string | null,
): Promise<CommitStructure> {
	try {
		const jsonOnly = config.inference.provider === 'openai-compatible'
		const groundedInstruction =
			source.kind === 'diff'
				? 'The previous response was invalid because it did not describe the staged changes. Use the staged git diff exactly and describe the real code changes.'
				: 'The previous response was invalid because it did not describe the staged changes. Use the summaries exactly and describe the real code changes.'
		let commit: CommitStructure

		try {
			commit = await requestStructuredCommit(source, {
				branchName,
				jsonOnly,
			})
		} catch (error) {
			if (!jsonOnly || !isJsonResponseValidationError(error)) {
				throw error
			}

			commit = await requestStructuredCommit(source, {
				branchName,
				jsonOnly: true,
				extraInstruction:
					'Your previous response was invalid. Return exactly one JSON object with every required field from the requested format.',
			})
		}

		if (isLowQualityCommit(commit.message, commit.type)) {
			commit = await requestStructuredCommit(source, {
				branchName,
				jsonOnly,
				extraInstruction: groundedInstruction,
			})
		}

		if (isLowQualityCommit(commit.message, commit.type)) {
			throw new Error(
				'The model returned a generic commit message that does not match the staged changes. Try another model or reduce unrelated staged files.',
			)
		}

		return commit
	} catch (error: unknown) {
		logExtensionError('generateStructuredCommit', error)

		if (isModelNotFoundError(error)) {
			const message = formatExtensionError(error)
			const errorMessage = message.charAt(0).toUpperCase() + message.slice(1)
			const { provider } = config.inference

			if (provider === 'openai-compatible') {
				vscode.window.showErrorMessage(
					`${errorMessage} Load the model in your OpenAI-compatible server (for example LM Studio) and try again.`,
				)
			} else {
				vscode.window
					.showErrorMessage(
						`${errorMessage} Pull the model in your terminal with "ollama pull <model>".`,
						'Open Ollama Library',
					)
					.then((action) => {
						if (action === 'Open Ollama Library') {
							vscode.env.openExternal(vscode.Uri.parse(OLLAMA_LIBRARY_URL))
						}
					})
			}

			throw new Error()
		}

		const { model } = config.inference
		if (isStructuredOutputCompatibilityError(error)) {
			throw new Error(
				`Failed to generate commit with model "${model}": this model does not produce stable JSON output for Commitollama yet. Try switching model from the Source Control toolbar (swap icon) or Command Palette ("Commitollama: Switch Model"). Raw error: ${formatExtensionError(error)}`,
			)
		}

		throw new Error(
			`Failed to generate commit with model "${model}": ${formatExtensionError(error)}`,
		)
	}
}

export async function generateStructuredCommit(
	summaries: ChangeSummary[],
	branchName?: string | null,
): Promise<CommitStructure> {
	return generateStructuredCommitFromSource(
		{ kind: 'summaries', summaries },
		branchName,
	)
}

function formatCommitMessage(structuredCommit: CommitStructure): string {
	const {
		useDescription,
		useEmojis,
		commitEmojis,
		useLowerCase,
		commitTemplate,
	} = config.inference

	const { type, message, summary } = structuredCommit

	const commitMessage = useLowerCase
		? message.charAt(0).toLowerCase() + message.slice(1)
		: message.charAt(0).toUpperCase() + message.slice(1)

	const emoji = useEmojis ? commitEmojis?.[type as keyof EmojisMap] : ''

	let commit = commitTemplate
		.replace('{{type}}', type)
		.replace('{{message}}', commitMessage)
		.replace('{{emoji}}', emoji)
		.replace(/\s+/g, ' ')
		.replace(/\s+:/g, ':')

	if (useDescription && summary) {
		commit = `${commit}\n\n${summary}`
	}

	return commit.trim()
}

export async function getCommitMessage(
	summaries: ChangeSummary[],
	branchName?: string | null,
) {
	const structuredCommit = await generateStructuredCommit(
		summaries,
		branchName,
	)
	return formatCommitMessage(structuredCommit)
}

export async function getCommitMessageFromDiff(
	diff: string,
	branchName?: string | null,
) {
	const structuredCommit = await generateStructuredCommitFromSource(
		{ kind: 'diff', diff },
		branchName,
	)
	return formatCommitMessage(structuredCommit)
}
