import * as vscode from 'vscode'
import type { EndpointSource } from './endpoint'
import {
	warnUntrustedConfigOnce,
	warnWorkspaceNetworkIgnoredOnce,
} from './warnUntrusted'

const BLOCKED_HEADERS = new Set([
	'host',
	'content-length',
	'transfer-encoding',
	'connection',
	'cookie',
	'set-cookie',
])

const MAX_HEADER_VALUE_LENGTH = 8 * 1024

export function sanitizeRequestHeaders(
	headers: Record<string, string>,
): Record<string, string> {
	const sanitized: Record<string, string> = {}

	for (const [key, value] of Object.entries(headers)) {
		if (!/^[\w-]+$/.test(key)) {
			continue
		}

		if (BLOCKED_HEADERS.has(key.toLowerCase())) {
			continue
		}

		if (typeof value !== 'string') {
			continue
		}

		const cleanValue = value
			.replace(/\0/g, '')
			.slice(0, MAX_HEADER_VALUE_LENGTH)
		sanitized[key] = cleanValue
	}

	return sanitized
}

function headerRecord(value: unknown): Record<string, string> | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined
	}

	const entries = Object.entries(value as Record<string, unknown>).filter(
		(entry): entry is [string, string] => typeof entry[1] === 'string',
	)
	if (entries.length === 0) {
		return undefined
	}

	return Object.fromEntries(entries)
}

export function selectRequestHeaders(options: {
	trusted: boolean
	endpointSource: EndpointSource
	workspaceValue?: unknown
	folderValue?: unknown
	globalValue?: unknown
}): { headers: Record<string, string>; ignoredWorkspaceHeaders: boolean } {
	const repoHeaders = Boolean(
		headerRecord(options.folderValue) || headerRecord(options.workspaceValue),
	)
	const userHeaders = headerRecord(options.globalValue)

	if (!options.trusted) {
		return {
			headers: {},
			ignoredWorkspaceHeaders: repoHeaders || Boolean(userHeaders),
		}
	}

	// A repository-selected host must not receive credentials from user settings.
	if (options.endpointSource === 'workspace-loopback') {
		return { headers: {}, ignoredWorkspaceHeaders: repoHeaders }
	}

	return {
		headers: sanitizeRequestHeaders(userHeaders ?? {}),
		ignoredWorkspaceHeaders: repoHeaders,
	}
}

export function resolveRequestHeaders(
	endpointSource: EndpointSource,
): Record<string, string> {
	const inspected = vscode.workspace
		.getConfiguration('commitollama')
		.inspect<Record<string, string>>('custom.requestHeaders')
	const selected = selectRequestHeaders({
		trusted: vscode.workspace.isTrusted,
		endpointSource,
		workspaceValue: inspected?.workspaceValue,
		folderValue: inspected?.workspaceFolderValue,
		globalValue: inspected?.globalValue,
	})

	if (!vscode.workspace.isTrusted && selected.ignoredWorkspaceHeaders) {
		warnUntrustedConfigOnce('headers')
	} else if (selected.ignoredWorkspaceHeaders) {
		warnWorkspaceNetworkIgnoredOnce('headers')
	}

	return selected.headers
}
