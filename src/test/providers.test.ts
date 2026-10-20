import * as assert from 'node:assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'
import { defaultEndpointForProvider } from '../security/endpoint'
import { setConfig } from '../utils'

suite('Provider defaults', () => {
	test('uses Ollama default endpoint', () => {
		assert.strictEqual(
			defaultEndpointForProvider('ollama'),
			'http://127.0.0.1:11434',
		)
	})

	test('uses OpenAI-compatible default endpoint', () => {
		assert.strictEqual(
			defaultEndpointForProvider('openai-compatible'),
			'http://127.0.0.1:1234/v1',
		)
	})
})

suite('OpenAI-compatible model listing', () => {
	let originalProvider: string | undefined
	let originalEndpoint: string | undefined
	let fetchStub: sinon.SinonStub

	setup(async () => {
		const configuration = vscode.workspace.getConfiguration('commitollama')
		originalProvider = configuration.inspect<string>('provider')?.workspaceValue
		originalEndpoint = configuration.inspect<string>(
			'custom.endpoint',
		)?.workspaceValue
		await setConfig('provider', 'openai-compatible')
		await setConfig('custom.endpoint', 'http://127.0.0.1:1234/v1')
		fetchStub = sinon.stub(globalThis, 'fetch')
	})

	teardown(async () => {
		fetchStub.restore()
		const configuration = vscode.workspace.getConfiguration('commitollama')
		await configuration.update(
			'provider',
			originalProvider,
			vscode.ConfigurationTarget.Workspace,
		)
		await configuration.update(
			'custom.endpoint',
			originalEndpoint,
			vscode.ConfigurationTarget.Workspace,
		)
	})

	test('lists model ids from /v1/models', async () => {
		fetchStub.resolves(
			new Response(
				JSON.stringify({
					data: [{ id: 'local-model' }, { id: 'other-model' }],
				}),
				{ status: 200 },
			),
		)

		const { listModels } = await import('../providers')
		const models = await listModels()

		assert.deepStrictEqual(models, ['local-model', 'other-model'])
		assert.ok(
			String(fetchStub.firstCall.args[0]).endsWith('/models') ||
				String(fetchStub.firstCall.args[0]).includes('/v1/models'),
		)
	})
})
