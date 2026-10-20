import type { AnySummarizeAdapter, AnyTextAdapter } from '@tanstack/ai'
import { config } from '../config'
import {
	createOllamaChatAdapter,
	createOllamaSummarizeAdapter,
	listOllamaModels,
} from './ollama'
import {
	createOpenAICompatibleChatAdapter,
	createOpenAICompatibleSummarizeAdapter,
	listOpenAICompatibleModels,
} from './openaiCompatible'
import type { ProviderId } from './types'

export type { ConnectionConfig, ProviderId } from './types'
export { isProviderId, PROVIDER_IDS } from './types'

export function createChatAdapter(): AnyTextAdapter {
	const { provider } = config.inference
	if (provider === 'openai-compatible') {
		return createOpenAICompatibleChatAdapter()
	}
	return createOllamaChatAdapter()
}

export function createSummarizeAdapter(): AnySummarizeAdapter {
	const { provider } = config.inference
	if (provider === 'openai-compatible') {
		return createOpenAICompatibleSummarizeAdapter()
	}
	return createOllamaSummarizeAdapter()
}

export async function listModels(): Promise<string[]> {
	const { provider } = config.inference
	if (provider === 'openai-compatible') {
		return listOpenAICompatibleModels()
	}
	return listOllamaModels()
}

export function formatProviderLabel(provider: ProviderId = 'ollama'): string {
	return provider === 'openai-compatible' ? 'OpenAI-compatible' : 'Ollama'
}
