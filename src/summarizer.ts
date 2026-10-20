import * as ai from './ai'
import { config } from './config'
import { createSummarizeAdapter } from './providers'
import { buildOpenAICompatibleModelOptions } from './providers/openaiCompatibleOptions'
import { formatExtensionError, logExtensionError } from './security/log'
import { wrapUntrustedContent } from './security/prompt'

export async function summarizeFileDiff(diff: string): Promise<string> {
	const { promptTemperature, model, provider } = config.inference

	const wrappedDiff = wrapUntrustedContent('diff', diff)

	try {
		const result = await ai.summarize({
			adapter: createSummarizeAdapter(),
			text: wrappedDiff,
			maxLength: 80,
			style: 'concise',
			focus: [
				'Describe only the actual code changes shown in the diff',
				'Start directly with the action (e.g., "Add validation...", "Fix null check...")',
				'Do not say there are no changes, an empty diff, or missing input',
				'Do not start with "The code changes..." or "This file..."',
			],
			modelOptions:
				provider === 'openai-compatible'
					? buildOpenAICompatibleModelOptions({
							temperature: promptTemperature,
						})
					: {
							options: {
								temperature: promptTemperature,
							},
						},
		})

		return result.summary.trim()
	} catch (error) {
		logExtensionError('summarizeFileDiff', error)
		throw new Error(
			`Failed to summarize changes with model "${model}": ${formatExtensionError(error)}`,
		)
	}
}
