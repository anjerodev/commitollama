import * as vscode from 'vscode'
import {
	DEFAULT_OLLAMA_ENDPOINT,
	DEFAULT_OPENAI_COMPATIBLE_ENDPOINT,
} from '../constants'
import type { ProviderId } from '../providers/types'
import { warnUntrustedConfigOnce } from './warnUntrusted'

export function defaultEndpointForProvider(provider: ProviderId): string {
	return provider === 'openai-compatible'
		? DEFAULT_OPENAI_COMPATIBLE_ENDPOINT
		: DEFAULT_OLLAMA_ENDPOINT
}

export function validateEndpoint(url: string): string {
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		throw new Error('Invalid endpoint URL')
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('Endpoint must use http or https')
	}

	if (parsed.username || parsed.password) {
		throw new Error('Endpoint must not include credentials')
	}

	let endpoint = parsed.toString()
	if (endpoint.endsWith('/')) {
		endpoint = endpoint.slice(0, -1)
	}

	return endpoint
}

export function resolveEndpoint(
	raw: string | undefined,
	provider: ProviderId = 'ollama',
): string {
	if (!vscode.workspace.isTrusted) {
		if (raw) {
			warnUntrustedConfigOnce('endpoint')
		}
		return defaultEndpointForProvider(provider)
	}

	const endpoint = raw || defaultEndpointForProvider(provider)
	return validateEndpoint(endpoint)
}
