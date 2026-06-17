import * as vscode from 'vscode'
import { warnUntrustedConfigOnce } from './warnUntrusted'

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

export function resolveRequestHeaders(
	raw: Record<string, string> | undefined,
): Record<string, string> {
	if (!vscode.workspace.isTrusted) {
		if (raw && Object.keys(raw).length > 0) {
			warnUntrustedConfigOnce('headers')
		}
		return {}
	}

	if (!raw || typeof raw !== 'object') {
		return {}
	}

	return sanitizeRequestHeaders(raw)
}
