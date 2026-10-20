export const PROMPT_STRATEGIES = ['auto', 'diff', 'summaries'] as const

export type PromptStrategy = (typeof PROMPT_STRATEGIES)[number]

/** Prefer a single diff→commit call when staged content stays under these limits. */
export const DIFF_PROMPT_MAX_CHARS = 12_000
export const DIFF_PROMPT_MAX_FILES = 8

export function isPromptStrategy(value: unknown): value is PromptStrategy {
	return (
		typeof value === 'string' &&
		(PROMPT_STRATEGIES as readonly string[]).includes(value)
	)
}

export function truncateDiffForPrompt(
	diff: string,
	maxChars: number = DIFF_PROMPT_MAX_CHARS,
): string {
	if (diff.length <= maxChars) {
		return diff
	}

	return `${diff.slice(0, maxChars)}\n\n[diff truncated for prompt size]`
}

export function shouldUseDirectDiffPrompt(options: {
	strategy: PromptStrategy
	diffLength: number
	fileCount: number
}): boolean {
	if (options.strategy === 'diff') {
		return true
	}
	if (options.strategy === 'summaries') {
		return false
	}

	return (
		options.fileCount > 0 &&
		options.fileCount <= DIFF_PROMPT_MAX_FILES &&
		options.diffLength > 0 &&
		options.diffLength <= DIFF_PROMPT_MAX_CHARS
	)
}
