import * as assert from 'node:assert'
import * as sinon from 'sinon'
import * as ai from '../ai'
import { SummaryCache } from '../cache'
import { summarizeFileDiff } from '../summarizer'

suite('Background Scanning Tests', () => {
	suite('SummaryCache', () => {
		test('should compute consistent hash for same content', () => {
			const cache = new SummaryCache()
			const content = 'diff --git a/file.ts b/file.ts\n+console.log("hello")'
			const hash1 = cache.computeHash(content)
			const hash2 = cache.computeHash(content)
			assert.strictEqual(hash1, hash2)
		})

		test('should return different hash for different content', () => {
			const cache = new SummaryCache()
			const hash1 = cache.computeHash('content A')
			const hash2 = cache.computeHash('content B')
			assert.notStrictEqual(hash1, hash2)
		})

		test('should store and retrieve cache entries', () => {
			const cache = new SummaryCache()
			const path = '/path/to/file.ts'
			const diff = 'some diff'
			const summary = 'Fixed a bug'
			const hash = cache.computeHash(diff)

			cache.set(path, hash, summary)

			const entry = cache.get(path)
			assert.ok(entry)
			assert.strictEqual(entry?.diffHash, hash)
			assert.strictEqual(entry?.summary, summary)
		})
	})

	suite('Summarizer', () => {
		let summarizeStub: sinon.SinonStub

		setup(() => {
			summarizeStub = sinon.stub(ai.llm, 'summarize').resolves({
				summary: 'Added new function',
			})
		})

		teardown(() => {
			sinon.restore()
		})

		test('should call ai summarize for diff', async () => {
			const diff = 'diff content'
			const result = await summarizeFileDiff(diff)

			assert.strictEqual(result, 'Added new function')
			assert.ok(summarizeStub.calledOnce)
			const args = summarizeStub.firstCall.args[0]
			assert.ok(args.text.includes(diff))
		})

		test('should throw error if prediction fails', async () => {
			summarizeStub.rejects(new Error('Ollama failed'))

			await assert.rejects(() => summarizeFileDiff('diff'), /Ollama failed/)
		})
	})
})
