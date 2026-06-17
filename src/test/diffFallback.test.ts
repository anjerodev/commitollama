import * as assert from 'node:assert'
import { buildDiffFallbackSummary } from '../diffFallback'

suite('diff fallback', () => {
	test('Should summarize added lines from a unified diff', () => {
		const diff = [
			'--- a/src/foo.ts',
			'+++ b/src/foo.ts',
			'@@ -1,2 +1,3 @@',
			' const x = 1',
			'+const y = 2',
			' return x',
		].join('\n')

		const summary = buildDiffFallbackSummary('src/foo.ts', diff)
		assert.match(summary, /add 1 line/)
		assert.match(summary, /const y = 2/)
	})

	test('Should summarize removed lines', () => {
		const diff = [
			'--- a/src/foo.ts',
			'+++ b/src/foo.ts',
			'@@ -1,2 +1,1 @@',
			'-const y = 2',
			' const x = 1',
		].join('\n')

		const summary = buildDiffFallbackSummary('src/foo.ts', diff)
		assert.match(summary, /remove 1 line/)
	})
})
