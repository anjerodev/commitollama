const EXACT_LOW_QUALITY_MESSAGES = new Set([
	'empty commit',
	'empty commit or no changes provided',
	'no changes',
	'no changes provided',
	'nothing to commit',
	'not provided',
	'docs update',
	'update docs',
	'documentation update',
])

const SHORT_LOW_QUALITY_PHRASES = [
	'empty commit',
	'no changes',
	'nothing to commit',
	'not provided',
	'no change provided',
	'without changes',
]

const GENERIC_SUMMARY_MESSAGES = new Set([
	'empty commit',
	'empty diff',
	'no changes',
	'no changes provided',
	'nothing to commit',
	'not provided',
])

export function isLowQualitySummary(summary: string): boolean {
	const normalized = summary.trim().toLowerCase()
	if (!normalized) {
		return true
	}

	return GENERIC_SUMMARY_MESSAGES.has(normalized)
}

export function isLowQualityCommit(message: string, type?: string): boolean {
	const normalized = message.trim().toLowerCase()
	if (!normalized) {
		return true
	}

	if (EXACT_LOW_QUALITY_MESSAGES.has(normalized)) {
		return true
	}

	const withType = `${type ?? ''} ${normalized}`.trim()
	if (EXACT_LOW_QUALITY_MESSAGES.has(withType)) {
		return true
	}

	if (normalized.length <= 30) {
		return SHORT_LOW_QUALITY_PHRASES.some((phrase) =>
			normalized.includes(phrase),
		)
	}

	return false
}
