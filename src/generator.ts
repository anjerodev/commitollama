import { config } from './config'
import { Ollama } from 'ollama'
import type { EmojisMap } from './types/llm'
import * as vscode from 'vscode'
import { OLLAMA_URL } from './constants'

interface CommitStructure {
	type: string
	message: string
	summary?: string
}

export async function generateStructuredCommit(
	summaries: string[],
): Promise<CommitStructure> {
	const {
		endpoint,
		promptTemperature,
		model,
		language,
		useDescription,
		customPrompt,
		customTypeRules,
		customCommitMessageRules,
		customDescriptionPrompt,
        requestHeaders,
	} = config.inference
	const ollama = new Ollama({ host: endpoint, headers: requestHeaders })

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

	const structuredPrompt =
		customPrompt ||
		`You are an expert developer specialist in creating commit messages.
	Based on the provided user changes, generate a commit message with the appropriate type.

	Rules for commit type:
	${typeRules}

	Rules for commit message:
	${commitMessageRules}
	- Write the message in ${language}

	${useDescription ? descriptionPrompt : ''}
	Respond using JSON`

	const format = {
		type: 'object',
		properties: {
			type: {
				type: 'string',
				description:
					'The commit type (feat, fix, docs, style, test, chore, revert, refactor)',
			},
			message: {
				type: 'string',
				description: `The commit message in ${language}`,
			},
			...(useDescription && {
				summary: {
					type: 'string',
					description: `Extended summary of the changes in ${language}`,
				},
			}),
		},
		required: useDescription
			? ['type', 'message', 'summary']
			: ['type', 'message'],
	}

	try {
		const response = await ollama.generate({
			model,
			prompt: `${structuredPrompt}\n\nChanges summaries: ${summaries.join(', ')}`,
			stream: false,
			format: format,
			options: {
				temperature: promptTemperature,
				num_predict: 100,
			},
		})

		return JSON.parse(response.response)
	} catch (error: any) {
		if (error?.status_code === 404) {
			const errorMessage =
				error?.message.charAt(0).toUpperCase() + error?.message.slice(1)

			vscode.window
				.showErrorMessage(errorMessage, 'Go to ollama website', 'Pull model')
				.then((action) => {
					if (action === 'Go to ollama website') {
						vscode.env.openExternal(vscode.Uri.parse(OLLAMA_URL))
					}
					if (action === 'Pull model') {
						vscode.commands.executeCommand('commitollama.runOllamaPull', model)
					}
				})

			throw new Error()
		}

		throw new Error(
			'Unable to connect to ollama. Please, check that ollama is running.',
		)
	}
}

export async function getCommitMessage(summaries: string[]) {
	const {
		useDescription,
		useEmojis,
		commitEmojis,
		useLowerCase,
		commitTemplate,
	} = config.inference

	try {
		const structuredCommit = await generateStructuredCommit(summaries)

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
	} catch (error) {
		throw new Error('Unable to generate commit.')
	}
}
