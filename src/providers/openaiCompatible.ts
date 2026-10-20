import {
	ChatStreamSummarizeAdapter,
	type AnySummarizeAdapter,
	type AnyTextAdapter,
} from '@tanstack/ai/adapters'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { config } from '../config'
import type { ConnectionConfig } from './types'

interface OpenAIModelsResponse {
	data?: Array<{ id?: string }>
}

function resolveApiKey(headers: Record<string, string>): string {
	const authorization =
		headers.Authorization ?? headers.authorization ?? headers.AUTHORIZATION
	if (
		typeof authorization === 'string' &&
		/^bearer\s+/i.test(authorization.trim())
	) {
		return authorization.replace(/^bearer\s+/i, '').trim()
	}

	return (
		headers['x-api-key'] ??
		headers['X-Api-Key'] ??
		headers['X-API-Key'] ??
		'commitollama'
	)
}

function withoutAuthHeaders(
	headers: Record<string, string>,
): Record<string, string> {
	const next: Record<string, string> = {}
	for (const [key, value] of Object.entries(headers)) {
		if (/^(authorization|x-api-key)$/i.test(key)) {
			continue
		}
		next[key] = value
	}
	return next
}

export function getOpenAICompatibleConnectionConfig(): ConnectionConfig {
	const { endpoint, requestHeaders } = config.inference
	return { host: endpoint, headers: requestHeaders }
}

export async function listOpenAICompatibleModels(): Promise<string[]> {
	const { host, headers } = getOpenAICompatibleConnectionConfig()
	const response = await fetch(`${host}/models`, { headers })

	if (!response.ok) {
		throw new Error(
			'Unable to reach the OpenAI-compatible server. Make sure it is running (for example LM Studio) and the endpoint is correct.',
		)
	}

	const data = (await response.json()) as OpenAIModelsResponse
	return (data.data ?? [])
		.map((model) => model.id)
		.filter((id): id is string => Boolean(id))
}

function createCompatibleTextAdapter() {
	const { model } = config.inference
	const { host, headers } = getOpenAICompatibleConnectionConfig()

	return openaiCompatibleText(model, {
		name: 'openai-compatible',
		baseURL: host,
		apiKey: resolveApiKey(headers),
		api: 'chat-completions',
		defaultHeaders: withoutAuthHeaders(headers),
	})
}

export function createOpenAICompatibleChatAdapter(): AnyTextAdapter {
	return createCompatibleTextAdapter() as unknown as AnyTextAdapter
}

export function createOpenAICompatibleSummarizeAdapter(): AnySummarizeAdapter {
	const { model } = config.inference
	return new ChatStreamSummarizeAdapter(
		createCompatibleTextAdapter(),
		model,
		'openai-compatible',
	) as unknown as AnySummarizeAdapter
}
