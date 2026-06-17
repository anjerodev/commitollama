import { ZodError } from 'zod'

const REDACTION_PATTERNS = [
	/Bearer\s+\S+/gi,
	/Authorization:\s*\S+/gi,
	/api[_-]?key=\S+/gi,
	/token=\S+/gi,
]

const MAX_ERROR_DEPTH = 5

function getErrorCause(error: Error): unknown {
	return (error as Error & { cause?: unknown }).cause
}

function collectErrorParts(error: unknown, depth = 0): string[] {
	if (depth > MAX_ERROR_DEPTH) {
		return []
	}

	if (error instanceof ZodError) {
		return error.issues.map((issue) => {
			const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
			return `${path}${issue.message}`
		})
	}

	if (error instanceof Error) {
		const parts: string[] = []
		if (error.message.trim()) {
			parts.push(error.message)
		}
		const cause = getErrorCause(error)
		if (cause) {
			parts.push(...collectErrorParts(cause, depth + 1))
		}
		return parts
	}

	if (typeof error === 'string' && error.trim()) {
		return [error]
	}

	if (!error || typeof error !== 'object') {
		return []
	}

	const candidate = error as Record<string, unknown>
	const parts: string[] = []

	if (typeof candidate.error === 'string' && candidate.error.trim()) {
		parts.push(candidate.error)
	}
	if (typeof candidate.message === 'string' && candidate.message.trim()) {
		parts.push(candidate.message)
	}
	if (typeof candidate.statusText === 'string' && candidate.statusText.trim()) {
		parts.push(candidate.statusText)
	}
	if (typeof candidate.status_code === 'number') {
		parts.push(`HTTP ${candidate.status_code}`)
	}
	if (typeof candidate.status === 'number') {
		parts.push(`HTTP ${candidate.status}`)
	}
	if (candidate.cause) {
		parts.push(...collectErrorParts(candidate.cause, depth + 1))
	}

	return parts
}

export function formatExtensionError(error: unknown): string {
	const parts = collectErrorParts(error).filter(
		(part, index, all) => all.indexOf(part) === index,
	)
	const message = parts.length > 0 ? parts.join(' — ') : 'Unknown error'
	return redactSensitiveData(message)
}

function extractErrorMessage(error: unknown): string {
	return formatExtensionError(error)
}

export function redactSensitiveData(message: string): string {
	let redacted = message
	for (const pattern of REDACTION_PATTERNS) {
		redacted = redacted.replace(pattern, '[REDACTED]')
	}
	return redacted
}

export function logExtensionError(context: string, error: unknown): void {
	const message = redactSensitiveData(extractErrorMessage(error))
	console.error(`[commitollama] ${context}: ${message}`)
}
