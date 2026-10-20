import {
	ChatStreamSummarizeAdapter,
	type AnySummarizeAdapter,
	type AnyTextAdapter,
} from '@tanstack/ai/adapters'
import { createOllamaChat } from '@tanstack/ai-ollama'
import { config } from '../config'
import type { ConnectionConfig } from './types'

interface OllamaTagsResponse {
	models?: Array<{ name: string }>
}

export function getOllamaConnectionConfig(): ConnectionConfig {
	const { endpoint, requestHeaders } = config.inference
	return { host: endpoint, headers: requestHeaders }
}

export async function listOllamaModels(): Promise<string[]> {
	const { host, headers } = getOllamaConnectionConfig()
	const response = await fetch(`${host}/api/tags`, { headers })

	if (!response.ok) {
		throw new Error(
			'Unable to reach Ollama. Make sure Ollama is running and the endpoint is correct.',
		)
	}

	const data = (await response.json()) as OllamaTagsResponse
	return (data.models ?? []).map((model) => model.name).filter(Boolean)
}

export function createOllamaChatAdapter(): AnyTextAdapter {
	const { model } = config.inference
	const { host, headers } = getOllamaConnectionConfig()
	return createOllamaChat(model, { host, headers }) as unknown as AnyTextAdapter
}

export function createOllamaSummarizeAdapter(): AnySummarizeAdapter {
	const { model } = config.inference
	const { host, headers } = getOllamaConnectionConfig()

	return new ChatStreamSummarizeAdapter(
		createOllamaChat(model, { host, headers }),
		model,
		'ollama',
	) as unknown as AnySummarizeAdapter
}
