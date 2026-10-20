import * as assert from 'node:assert'
import {
	DIFF_PROMPT_MAX_CHARS,
	DIFF_PROMPT_MAX_FILES,
	shouldUseDirectDiffPrompt,
	truncateDiffForPrompt,
} from '../promptStrategy'

suite('promptStrategy', () => {
	test('truncateDiffForPrompt leaves small diffs unchanged', () => {
		assert.strictEqual(truncateDiffForPrompt('abc'), 'abc')
	})

	test('truncateDiffForPrompt clips oversized diffs', () => {
		const diff = 'x'.repeat(DIFF_PROMPT_MAX_CHARS + 50)
		const truncated = truncateDiffForPrompt(diff)
		assert.ok(truncated.length < diff.length)
		assert.ok(truncated.includes('[diff truncated for prompt size]'))
	})

	test('auto uses diff for small stages', () => {
		assert.strictEqual(
			shouldUseDirectDiffPrompt({
				strategy: 'auto',
				diffLength: 1_000,
				fileCount: 2,
			}),
			true,
		)
	})

	test('auto uses summaries for large stages', () => {
		assert.strictEqual(
			shouldUseDirectDiffPrompt({
				strategy: 'auto',
				diffLength: DIFF_PROMPT_MAX_CHARS + 1,
				fileCount: 2,
			}),
			false,
		)
		assert.strictEqual(
			shouldUseDirectDiffPrompt({
				strategy: 'auto',
				diffLength: 1_000,
				fileCount: DIFF_PROMPT_MAX_FILES + 1,
			}),
			false,
		)
	})

	test('diff and summaries strategies are forced', () => {
		assert.strictEqual(
			shouldUseDirectDiffPrompt({
				strategy: 'diff',
				diffLength: DIFF_PROMPT_MAX_CHARS + 1,
				fileCount: DIFF_PROMPT_MAX_FILES + 1,
			}),
			true,
		)
		assert.strictEqual(
			shouldUseDirectDiffPrompt({
				strategy: 'summaries',
				diffLength: 10,
				fileCount: 1,
			}),
			false,
		)
	})
})
