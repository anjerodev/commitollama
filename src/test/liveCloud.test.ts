import * as assert from 'node:assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'
import * as ai from '../ai'
import type { ChangeSummary } from '../generator'
import { getCommitMessage } from '../generator'
import { setConfig } from '../utils'

const liveSuite =
	process.env.COMMITOLLAMA_LIVE_MODEL_TEST === '1' ? suite : suite.skip

liveSuite('Live Ollama Cloud Tests', () => {
	test('GPT-OSS generates a commit with a model-written description in one call', async function () {
		this.timeout(30_000)

		const originalModel = vscode.workspace
			.getConfiguration('commitollama')
			.inspect<string>('model')?.workspaceValue
		const originalCompatibilityMode = vscode.workspace
			.getConfiguration('commitollama')
			.inspect<boolean>('cloudCompatibilityMode')?.workspaceValue
		const originalUseDescription = vscode.workspace
			.getConfiguration('commitollama')
			.inspect<boolean>('useDescription')?.workspaceValue
		const chatSpy = sinon.spy(ai.llm, 'chat')
		const summaries: ChangeSummary[] = [
			{
				file: 'src/example.ts',
				summary: 'Add a function that returns the sum of two numbers.',
			},
			{
				file: 'src/example.test.ts',
				summary: 'Add unit tests for the sum function.',
			},
		]

		await setConfig('model', 'gpt-oss:20b-cloud')
		await setConfig('cloudCompatibilityMode', true)
		await setConfig('useDescription', true)

		try {
			const commit = await getCommitMessage(summaries, 'test/live-cloud')

			assert.match(
				commit,
				/^(feat|fix|docs|style|test|chore|revert|refactor): .+\n\n.+/,
			)
			assert.strictEqual(chatSpy.callCount, 1)
		} finally {
			sinon.restore()
			const configuration = vscode.workspace.getConfiguration('commitollama')
			await configuration.update(
				'cloudCompatibilityMode',
				originalCompatibilityMode,
				vscode.ConfigurationTarget.Workspace,
			)
			await configuration.update(
				'useDescription',
				originalUseDescription,
				vscode.ConfigurationTarget.Workspace,
			)
			await configuration.update(
				'model',
				originalModel,
				vscode.ConfigurationTarget.Workspace,
			)
		}
	})
})
