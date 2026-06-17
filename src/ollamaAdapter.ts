import type { AnySummarizeAdapter, AnyTextAdapter } from '@tanstack/ai'
import { createOllamaChat, createOllamaSummarize } from '@tanstack/ai-ollama'
import { config } from './config'

export interface OllamaConnectionConfig {
	host: string
	headers: Record<string, string>
}

interface OllamaTagsResponse {
	models?: Array<{ name: string }>
}

export function getOllamaConnectionConfig(): OllamaConnectionConfig {
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

export function createChatAdapter(): AnyTextAdapter {
	const { model } = config.inference
	const { host, headers } = getOllamaConnectionConfig()
	return createOllamaChat(model, { host, headers }) as unknown as AnyTextAdapter
}

export function createSummarizeAdapter() {
	const { model } = config.inference
	const { host } = getOllamaConnectionConfig()
	return createOllamaSummarize(model, host) as unknown as AnySummarizeAdapter
}
