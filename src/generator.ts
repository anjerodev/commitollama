import * as vscode from 'vscode'
import { ZodError } from 'zod'
import * as ai from './ai'
import { isLowQualityCommit } from './commitQuality'
import { config } from './config'
import { OLLAMA_LIBRARY_URL } from './constants'
import { buildCommitModelOptions } from './modelOptions'
import { createChatAdapter } from './ollamaAdapter'
import {
	buildCommitSchema,
	type CommitStructure,
	extractJsonObject,
	parseCommitResponse,
} from './schemas/commit'
import { formatExtensionError, logExtensionError } from './security/log'
import { wrapUntrustedContent } from './security/prompt'
import type { EmojisMap } from './types/llm'

export type ChangeSummary = {
	file: string
	summary: string
}

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

function isCloudResponseValidationError(error: unknown): boolean {
	return (
		error instanceof ZodError ||
		(error instanceof Error &&
			(error.message === 'Could not find a JSON object in the model response' ||
				isStructuredOutputCompatibilityError(error)))
	)
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

export function buildCommitUserContent(
	summaries: ChangeSummary[],
	branchName?: string | null,
): string {
	const wrappedSummaries = wrapUntrustedContent(
		'summaries',
		formatChangeSummaries(summaries),
	)
	const normalizedBranch = normalizeBranchName(branchName)
	const branchSection = normalizedBranch
		? `Current git branch (optional context only; may inform ticket or feature naming but must not invent changes):\n${wrapUntrustedContent('branch', normalizedBranch)}\n\n`
		: 'Current git branch: detached HEAD or unnamed (optional context only).\n\n'

	return `${branchSection}Staged change summaries:\n${wrappedSummaries}`
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
	} = options

	const basePrompt =
		customPrompt ||
		`You are an expert developer specialist in creating commit messages.
	Based on the provided user changes, generate a commit message with the appropriate type.

	Rules for commit type:
	${typeRules}
	- Use "docs" only when a summary clearly describes documentation changes (README, docs/, comments, or .md files)
	- Do not guess "docs" from code-only changes

	Rules for commit message:
	${commitMessageRules}
	- Write the message in ${language}
	- Describe only what is present in the change summaries
	- Never say the commit is empty, has no changes, or that input is missing
	- Do not invent files, features, or changes that are not in the summaries
	- You may use the current branch name as optional context (for example ticket IDs)
	- Never invent work from the branch name alone; ground the message in the change summaries

	${useDescription ? descriptionPrompt : ''}
	Respond using JSON`

	const instructions = [
		extraInstruction,
		jsonOnly
			? `Respond with exactly one valid JSON object and nothing else. Do not use Markdown, code fences, or explanatory text. Required fields: ${useDescription ? '{"type":"feat","message":"Brief commit subject","summary":"One to three sentence commit description"}' : '{"type":"feat","message":"Brief commit subject"}'}. The type value must be one of: feat, fix, docs, style, test, chore, revert, refactor.`
			: undefined,
	].filter(Boolean)

	if (instructions.length === 0) {
		return basePrompt
	}

	return `${basePrompt}\n\n${instructions.join('\n\n')}`
}

async function requestStructuredCommit(
	summaries: ChangeSummary[],
	options?: {
		extraInstruction?: string
		branchName?: string | null
		jsonOnly?: boolean
	},
): Promise<CommitStructure> {
	const {
		model,
		promptTemperature,
		language,
		useDescription,
		customPrompt,
		customTypeRules,
		customCommitMessageRules,
		customDescriptionPrompt,
		cloudCompatibilityMode,
	} = config.inference
	const jsonOnly = options?.jsonOnly ?? cloudCompatibilityMode

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
	})

	const outputSchema = buildCommitSchema(useDescription, language)

	const chatOptions = {
		adapter: createChatAdapter(),
		systemPrompts: [structuredPrompt],
		messages: [
			{
				role: 'user' as const,
				content: buildCommitUserContent(summaries, options?.branchName),
			},
		],
		modelOptions: buildCommitModelOptions(model, promptTemperature),
	}

	if (jsonOnly) {
		const result = await ai.chat({ ...chatOptions, stream: false })
		const commit = parseCommitResponse(
			extractJsonObject(result),
			useDescription,
			language,
		)
		return commit
	}

	const result = await ai.chat({ ...chatOptions, outputSchema })

	return parseCommitResponse(result, useDescription, language)
}

export async function generateStructuredCommit(
	summaries: ChangeSummary[],
	branchName?: string | null,
): Promise<CommitStructure> {
	try {
		let commit: CommitStructure
		let jsonOnly = config.inference.cloudCompatibilityMode

		try {
			commit = await requestStructuredCommit(summaries, {
				branchName,
				jsonOnly,
			})
		} catch (error) {
			if (!isCloudResponseValidationError(error)) {
				throw error
			}

			// Cloud models frequently accept chat requests but either reject
			// Ollama's structured-output format or omit an optional-looking field
			// such as the enabled commit description. Retry as JSON-only text even
			// when the compatibility setting was not enabled in advance.
			jsonOnly = true
			commit = await requestStructuredCommit(summaries, {
				branchName,
				jsonOnly,
				extraInstruction:
					'Your previous response was invalid. Return exactly one JSON object with every required field from the requested format.',
			})
		}

		if (isLowQualityCommit(commit.message, commit.type)) {
			commit = await requestStructuredCommit(summaries, {
				branchName,
				jsonOnly,
				extraInstruction:
					'The previous response was invalid because it did not describe the staged changes. Use the summaries exactly and describe the real code changes.',
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

export async function getCommitMessage(
	summaries: ChangeSummary[],
	branchName?: string | null,
) {
	const {
		useDescription,
		useEmojis,
		commitEmojis,
		useLowerCase,
		commitTemplate,
	} = config.inference

	const structuredCommit = await generateStructuredCommit(
		summaries,
		branchName,
	)

	const { type, message, summary } = structuredCommit

	// Handle lower and upper case commit messages
	const commitMessage = useLowerCase
		? message.charAt(0).toLowerCase() + message.slice(1)
		: message.charAt(0).toUpperCase() + message.slice(1)

	// Handle emojis
	const emoji = useEmojis ? commitEmojis?.[type as keyof EmojisMap] : ''

	// Build final commit with template
	let commit = commitTemplate
		.replace('{{type}}', type)
		.replace('{{message}}', commitMessage)
		.replace('{{emoji}}', emoji)
		.replace(/\s+/g, ' ') // Replace multiple spaces with single space
		.replace(/\s+:/g, ':') // Remove space before colon

	// Add extended summary as description if useDescription is activated
	if (useDescription && summary) {
		commit = `${commit}\n\n${summary}`
	}

	return commit.trim()
}
