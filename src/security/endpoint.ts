import * as vscode from 'vscode'
import { DEFAULT_OLLAMA_ENDPOINT } from '../constants'
import { warnUntrustedConfigOnce } from './warnUntrusted'

export function validateEndpoint(url: string): string {
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		throw new Error('Invalid Ollama endpoint URL')
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('Ollama endpoint must use http or https')
	}

	if (parsed.username || parsed.password) {
		throw new Error('Ollama endpoint must not include credentials')
	}

	let endpoint = parsed.toString()
	if (endpoint.endsWith('/')) {
		endpoint = endpoint.slice(0, -1)
	}

	return endpoint
}

export function resolveEndpoint(raw: string | undefined): string {
	if (!vscode.workspace.isTrusted) {
		if (raw) {
			warnUntrustedConfigOnce('endpoint')
		}
		return DEFAULT_OLLAMA_ENDPOINT
	}

	const endpoint = raw || DEFAULT_OLLAMA_ENDPOINT
	return validateEndpoint(endpoint)
}
