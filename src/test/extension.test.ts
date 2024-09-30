import * as assert from 'node:assert'
import * as vscode from 'vscode'
import * as sinon from 'sinon'
import * as extension from '../extension'
import * as ollama from 'ollama'
import { getSummary, getCommitMessage } from '../generator'
import { getConfig, getGitExtension, setConfig } from '../utils'

suite('Extension Test Suite', () => {
	test('Extension is active', () => {
		assert.ok(extension.activate)
	})

	test('Get Git Extension', () => {
		const gitExtension = getGitExtension()
		assert.ok(gitExtension)
	})
})

suite('getSummary Tests', () => {
	const diffSample =
		'diff --git a/sample.txt b/sample.txt\nindex 83db48f..1f65a11 100644\n--- a/sample.txt\n+++ b/sample.txt\n@@ -1 +1 @@\n-Hello\n+Hello World'
	const summaryResponse = {
		message: { content: 'Added a Hello World message.' },
	}

	let ollamaChatStub: sinon.SinonStub

	setup(() => {
		ollamaChatStub = sinon.stub(ollama.Ollama.prototype, 'chat')
	})

	teardown(() => {
		ollamaChatStub.restore()
	})

	test('Should return a summary for a git diff output', async () => {
		ollamaChatStub.resolves(summaryResponse)

		const result = await getSummary(diffSample)

		assert.strictEqual(result, 'Added a Hello World message.')
		assert(ollamaChatStub.calledOnce)
	})

	test('Should show error message when model is not found', async () => {
		const error = { status_code: 404, message: 'model not found' }
		ollamaChatStub.rejects(error)

		const showErrorMessageStub = sinon
			.stub(vscode.window, 'showErrorMessage')
			.resolves()

		try {
			await getSummary(diffSample)
		} catch (e) {
			// Expected error
		}

		assert(
			showErrorMessageStub.calledOnceWith(
				sinon.match.string,
				sinon.match.string,
				sinon.match.string,
			),
		)
		showErrorMessageStub.restore()
	})
})

suite('getCommitMessage Tests', () => {
	const summariesSample = ['Added a feature', 'Fixed a bug']
	const commitMessageResponse = {
		message: { content: 'feat: Add new feature' },
	}

	let ollamaChatStub: sinon.SinonStub

	setup(() => {
		ollamaChatStub = sinon.stub(ollama.Ollama.prototype, 'chat')
	})

	teardown(() => {
		ollamaChatStub.restore()
	})

	test('Should return a commit message based on summaries', async () => {
		ollamaChatStub.resolves(commitMessageResponse)

		const result = await getCommitMessage(summariesSample)

		assert.strictEqual(result, 'feat: Add new feature')
		assert(ollamaChatStub.calledOnce)
	})

	test('Should add emojis if configured to use emojis', async () => {
		ollamaChatStub.resolves(commitMessageResponse)

		const originalEmojis = getConfig('commitEmojis')
		const originalUseEmojis = getConfig('useEmojis')

		await setConfig('useEmojis', true)
		await setConfig('commitEmojis', { ...originalEmojis!, feat: '🔥' })

		const result = await getCommitMessage(summariesSample)

		assert.strictEqual(result, 'feat 🔥: Add new feature')
		await setConfig('useEmojis', originalUseEmojis!)
		await setConfig('commitEmojis', originalEmojis!)
	})

	test('Should add summaries as descriptions if configured to use descriptions', async () => {
		ollamaChatStub.resolves(commitMessageResponse)

		const originalUseDescription = getConfig('useDescription')
		await setConfig('useDescription', true)

		const result = await getCommitMessage(summariesSample)

		assert.strictEqual(
			result,
			'feat: Add new feature\n\n- Added a feature\n- Fixed a bug',
		)

		await setConfig('useDescription', originalUseDescription!)
	})
})
