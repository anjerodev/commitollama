import * as assert from 'node:assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'
import * as ai from '../ai'
import { SummaryCache, summaryCache } from '../cache'
import { buildSummarizeModelOptions } from '../modelOptions'
import { BackgroundScanner } from '../scheduler'
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

		test('should leave room for GPT-OSS reasoning and visible output', () => {
			const options = buildSummarizeModelOptions(
				'gpt-oss:20b-cloud',
				0.2,
			) as unknown as {
				think: string
				options: { num_predict: number }
			}

			assert.strictEqual(options.think, 'low')
			assert.strictEqual(options.options.num_predict, 1024)
		})
	})

	suite('BackgroundScanner', () => {
		teardown(() => {
			summaryCache.clear()
		})

		test('should cache a diff fallback when summarization fails', async () => {
			const rootUri = vscode.Uri.file('/workspace')
			const fileUri = vscode.Uri.file('/workspace/src/example.ts')
			const diff = [
				'diff --git a/src/example.ts b/src/example.ts',
				'@@ -0,0 +1 @@',
				'+export const answer = 42',
			].join('\n')
			const repository = {
				rootUri,
				diffWithHEAD: sinon.stub().resolves(diff),
			}
			const scanner = new BackgroundScanner({
				getGitExtension: () =>
					({ repositories: [repository] }) as never,
				summarizeFileDiff: sinon.stub().rejects(new Error('offline')),
			})
			scanner.stop()

			try {
				await (
					scanner as unknown as {
						processFile(uri: vscode.Uri): Promise<void>
					}
				).processFile(fileUri)

				const cached = summaryCache.get(fileUri.fsPath)
				assert.strictEqual(cached?.diffHash, summaryCache.computeHash(diff))
				assert.match(cached?.summary ?? '', /add 1 line/i)
				assert.match(cached?.summary ?? '', /answer = 42/)
			} finally {
				scanner.stop()
			}
		})

		test('should skip an overlapping repository scan', async () => {
			let releaseDiff: ((changes: []) => void) | undefined
			const diffPending = new Promise<[]>((resolve) => {
				releaseDiff = resolve
			})
			const diffWithHEAD = sinon.stub().returns(diffPending)
			const scanner = new BackgroundScanner({
				getGitExtension: () =>
					({ repositories: [{ diffWithHEAD }] }) as never,
			})
			scanner.stop()
			const scan = (
				scanner as unknown as {
					scanOpenRepositories(): Promise<void>
				}
			).scanOpenRepositories.bind(scanner)

			try {
				const firstScan = scan()
				await scan()
				assert.strictEqual(diffWithHEAD.callCount, 1)

				releaseDiff?.([])
				await firstScan
			} finally {
				scanner.stop()
			}
		})
	})
})
