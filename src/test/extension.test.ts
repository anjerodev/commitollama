import * as assert from 'node:assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'
import * as ai from '../ai'
import { defaultConfig } from '../config'
import * as extension from '../extension'
import type { ChangeSummary } from '../generator'
import {
	buildCommitUserContent,
	generateStructuredCommit,
	getCommitMessage,
	normalizeBranchName,
} from '../generator'
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

suite('generateStructuredCommit Tests', () => {
	const summariesSample: ChangeSummary[] = [
		{ file: 'src/feature.ts', summary: 'Added a feature' },
		{ file: 'src/bug.ts', summary: 'Fixed a bug' },
	]
	let chatStub: sinon.SinonStub

	setup(() => {
		chatStub = sinon.stub(ai.llm, 'chat').resolves({
			type: 'feat',
			message: 'Add new feature',
		})
	})

	teardown(() => {
		sinon.restore()
	})

	test('Should return a structured commit for summaries', async () => {
		const result = await generateStructuredCommit(summariesSample)

		assert.strictEqual(result.type, 'feat')
		assert.strictEqual(result.message, 'Add new feature')
		assert.ok(chatStub.calledOnce)
	})

	test('Should show error message when model is not found', async () => {
		chatStub.rejects({ status_code: 404, message: 'model not found' })

		const showErrorMessageStub = sinon
			.stub(vscode.window, 'showErrorMessage')
			.resolves()

		try {
			await generateStructuredCommit(summariesSample)
		} catch {
			// Expected error
		}

		showErrorMessageStub.restore()
	})

	test('Should reject malformed JSON from model', async () => {
		chatStub.resolves({ type: 123, message: 'Add feature' })

		await assert.rejects(
			() => generateStructuredCommit(summariesSample),
			/Failed to generate commit with model/,
		)
	})

	test('Should reject invalid commit type from model', async () => {
		chatStub.resolves({ type: 'invalid', message: 'Bad type' })

		await assert.rejects(
			() => generateStructuredCommit(summariesSample),
			/Failed to generate commit with model/,
		)
	})

	test('Should include Ollama error details when chat fails', async () => {
		chatStub.rejects({
			status_code: 400,
			error: 'model does not support structured outputs',
		})

		await assert.rejects(
			() => generateStructuredCommit(summariesSample),
			/model does not support structured outputs/,
		)
	})

	test('Should retry when model returns a generic commit message', async () => {
		chatStub.onFirstCall().resolves({
			type: 'chore',
			message: 'Empty commit or no changes provided',
		})
		chatStub.onSecondCall().resolves({
			type: 'feat',
			message: 'Add new feature',
		})

		const result = await generateStructuredCommit(summariesSample)

		assert.strictEqual(result.type, 'feat')
		assert.strictEqual(result.message, 'Add new feature')
		assert.strictEqual(chatStub.callCount, 2)
	})

	test('Should show guidance for structured output parse failures', async () => {
		chatStub.rejects(
			new Error(
				'Structured output generation failed: Failed to parse structured output as JSON. Content:',
			),
		)

		await assert.rejects(
			() => generateStructuredCommit(summariesSample),
			/Switch Model/,
		)
	})

	test('Should include current branch name in the chat user content', async () => {
		await generateStructuredCommit(summariesSample, 'feature/ABC-123-login')

		const chatArgs = chatStub.firstCall.args[0]
		const userContent = chatArgs.messages[0].content as string
		const systemPrompt = chatArgs.systemPrompts[0] as string

		assert.ok(userContent.includes('feature/ABC-123-login'))
		assert.ok(userContent.includes('<untrusted_branch>'))
		assert.ok(userContent.includes('Staged change summaries:'))
		assert.ok(systemPrompt.includes('current branch name as optional context'))
	})

	test('Should describe detached HEAD when branch name is missing', async () => {
		await generateStructuredCommit(summariesSample)

		const userContent = chatStub.firstCall.args[0].messages[0].content as string
		assert.ok(userContent.includes('detached HEAD or unnamed'))
		assert.ok(!userContent.includes('<untrusted_branch>'))
	})
})

suite('branch context helpers', () => {
	test('normalizeBranchName trims and drops empty values', () => {
		assert.strictEqual(normalizeBranchName('  feat/x  '), 'feat/x')
		assert.strictEqual(normalizeBranchName(''), undefined)
		assert.strictEqual(normalizeBranchName('   '), undefined)
		assert.strictEqual(normalizeBranchName(null), undefined)
		assert.strictEqual(normalizeBranchName(undefined), undefined)
	})

	test('buildCommitUserContent wraps branch as untrusted content', () => {
		const content = buildCommitUserContent(
			[{ file: 'a.ts', summary: 'Added a' }],
			'fix/42-thing',
		)

		assert.ok(content.includes('<untrusted_branch>'))
		assert.ok(content.includes('fix/42-thing'))
		assert.ok(content.includes('<untrusted_summaries>'))
		assert.ok(content.includes('- a.ts: Added a'))
	})
})

suite('getCommitMessage Tests', () => {
	const summariesSample: ChangeSummary[] = [
		{ file: 'src/feature.ts', summary: 'Added a feature' },
		{ file: 'src/bug.ts', summary: 'Fixed a bug' },
	]
	let chatStub: sinon.SinonStub
	let originalUseEmojis: any
	let originalUseDescription: any
	let originalLowerCase: any
	let originalCustomEmojis: any
	let originalCustomCommitTemplate: any

	setup(async () => {
		chatStub = sinon.stub(ai.llm, 'chat').resolves({
			type: 'feat',
			message: 'Add new feature',
		})
		originalUseEmojis = getConfig('useEmojis')
		originalUseDescription = getConfig('useDescription')
		originalLowerCase = getConfig('useLowerCase')
		originalCustomCommitTemplate = getConfig('commitTemplate')
		originalCustomEmojis = getConfig('custom.emojis')

		await setConfig('useEmojis', false)
		await setConfig('useDescription', false)
		await setConfig('useLowerCase', false)
	})

	teardown(async () => {
		sinon.restore()
		await setConfig('useEmojis', originalUseEmojis)
		await setConfig('useDescription', originalUseDescription)
		await setConfig('useLowerCase', originalLowerCase)
		await setConfig('commitTemplate', originalCustomCommitTemplate)
		await setConfig('custom.emojis', originalCustomEmojis)
	})

	test('Should return a commit message based on summaries', async () => {
		const result = await getCommitMessage(summariesSample)

		assert.strictEqual(result, 'feat: Add new feature')
		assert.ok(chatStub.calledOnce)
	})

	test('Should pass branch name through to the model request', async () => {
		const result = await getCommitMessage(
			summariesSample,
			'bugfix/ISSUE-9',
		)

		assert.strictEqual(result, 'feat: Add new feature')
		const userContent = chatStub.firstCall.args[0].messages[0].content as string
		assert.ok(userContent.includes('bugfix/ISSUE-9'))
	})

	test('Should add emojis if configured to use emojis', async () => {
		const originalUseEmojis = getConfig('useEmojis')
		const originalCustomEmojis = getConfig('custom.emojis')

		await setConfig('useEmojis', true)
		await setConfig('custom.emojis', { ...defaultConfig.emojis, feat: '🔥' })

		const result = await getCommitMessage(summariesSample)

		assert.strictEqual(result, 'feat 🔥: Add new feature')
		await setConfig('useEmojis', originalUseEmojis!)
		await setConfig('custom.emojis', originalCustomEmojis!)
	})

	test('Should add summaries as descriptions if configured to use descriptions', async () => {
		chatStub.resolves({
			type: 'feat',
			message: 'Add new feature',
			summary: 'Extended summary of the feature',
		})

		const originalUseDescription = getConfig('useDescription')
		await setConfig('useDescription', true)

		const result = await getCommitMessage(summariesSample)

		assert.strictEqual(
			result,
			'feat: Add new feature\n\nExtended summary of the feature',
		)

		await setConfig('useDescription', originalUseDescription!)
	})

	test('Should lowercase the message if configured to use lowercase', async () => {
		const originalLowercase = getConfig('useLowerCase')
		await setConfig('useLowerCase', true)

		const result = await getCommitMessage(summariesSample)

		assert.strictEqual(result, 'feat: add new feature')

		await setConfig('useLowerCase', originalLowercase!)
	})

	test('Should format commit message according to template', async () => {
		const originalCustomCommitTemplate = getConfig('commitTemplate')
		const originalUseEmojis = getConfig('useEmojis')

		await setConfig('commitTemplate', '{{emoji}}{{type}}: {{message}}')
		await setConfig('useEmojis', true)

		const result = await getCommitMessage(summariesSample)

		assert.strictEqual(result, '✨feat: Add new feature')
		await setConfig('commitTemplate', originalCustomCommitTemplate!)
		await setConfig('useEmojis', originalUseEmojis!)
	})
})
