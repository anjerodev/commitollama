import * as vscode from 'vscode'
import {
	DEFAULT_OLLAMA_ENDPOINT,
	DEFAULT_OPENAI_COMPATIBLE_ENDPOINT,
} from '../constants'
import type { ProviderId } from '../providers/types'
import {
	warnUntrustedConfigOnce,
	warnWorkspaceNetworkIgnoredOnce,
} from './warnUntrusted'

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

export type EndpointSource = 'default' | 'user' | 'workspace-loopback'

export type ResolvedEndpoint = {
	endpoint: string
	source: EndpointSource
}

function configuredString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined
	}
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : undefined
}

/** True for localhost and 127.0.0.0/8. Other names can resolve off-machine. */
export function isLoopbackEndpoint(endpoint: string): boolean {
	let hostname: string
	try {
		hostname = new URL(endpoint).hostname.toLowerCase()
	} catch {
		return false
	}

	if (hostname.startsWith('[') && hostname.endsWith(']')) {
		hostname = hostname.slice(1, -1)
	}

	if (hostname === 'localhost' || hostname === '::1') {
		return true
	}

	const parts = hostname.split('.')
	if (parts.length !== 4) {
		return false
	}

	const octets = parts.map((part) =>
		/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN,
	)
	if (
		octets.some(
			(octet) => !Number.isInteger(octet) || octet < 0 || octet > 255,
		)
	) {
		return false
	}

	return octets[0] === 127
}

export function selectEndpoint(options: {
	trusted: boolean
	provider: ProviderId
	workspaceValue?: unknown
	folderValue?: unknown
	globalValue?: unknown
}): ResolvedEndpoint & { ignoredWorkspaceEndpoint: boolean } {
	const fallback = defaultEndpointForProvider(options.provider)
	const repoValue =
		configuredString(options.folderValue) ??
		configuredString(options.workspaceValue)
	const userValue = configuredString(options.globalValue)

	if (!options.trusted) {
		return {
			endpoint: fallback,
			source: 'default',
			ignoredWorkspaceEndpoint: Boolean(repoValue || userValue),
		}
	}

	if (userValue) {
		const endpoint = validateEndpoint(userValue)
		let ignoredWorkspaceEndpoint = false
		if (repoValue) {
			try {
				ignoredWorkspaceEndpoint = validateEndpoint(repoValue) !== endpoint
			} catch {
				ignoredWorkspaceEndpoint = true
			}
		}
		return {
			endpoint,
			source: 'user',
			ignoredWorkspaceEndpoint,
		}
	}

	if (!repoValue) {
		return {
			endpoint: fallback,
			source: 'default',
			ignoredWorkspaceEndpoint: false,
		}
	}

	try {
		const endpoint = validateEndpoint(repoValue)
		if (isLoopbackEndpoint(endpoint)) {
			return {
				endpoint,
				source: 'workspace-loopback',
				ignoredWorkspaceEndpoint: false,
			}
		}
	} catch {
		// Fall through to the provider default.
	}

	return {
		endpoint: fallback,
		source: 'default',
		ignoredWorkspaceEndpoint: true,
	}
}

export function resolveEndpoint(
	provider: ProviderId = 'ollama',
): ResolvedEndpoint {
	const inspected = vscode.workspace
		.getConfiguration('commitollama')
		.inspect<string>('custom.endpoint')
	const selected = selectEndpoint({
		trusted: vscode.workspace.isTrusted,
		provider,
		workspaceValue: inspected?.workspaceValue,
		folderValue: inspected?.workspaceFolderValue,
		globalValue: inspected?.globalValue,
	})

	if (!vscode.workspace.isTrusted && selected.ignoredWorkspaceEndpoint) {
		warnUntrustedConfigOnce('endpoint')
	} else if (selected.ignoredWorkspaceEndpoint) {
		warnWorkspaceNetworkIgnoredOnce('endpoint')
	}

	return { endpoint: selected.endpoint, source: selected.source }
}
