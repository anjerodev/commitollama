import * as assert from 'node:assert'
import * as vscode from 'vscode'
import {
	createChatAdapter,
	createSummarizeAdapter,
} from '../ollamaAdapter'
import { setConfig } from '../utils'

interface OllamaClientConfig {
	host: string
	headers: Record<string, string>
}

interface OllamaTextAdapterInternals {
	client: { config: OllamaClientConfig }
}

interface SummarizeAdapterInternals {
	textAdapter: OllamaTextAdapterInternals
}

suite('Ollama adapter configuration', () => {
	const endpoint = 'https://ollama.example.test'
	const headers = {
		Authorization: 'Bearer test-token',
		'X-Workspace': 'commitollama',
	}
	let originalEndpoint: string | undefined
	let originalHeaders: Record<string, string> | undefined

	setup(async () => {
		const configuration = vscode.workspace.getConfiguration('commitollama')
		originalEndpoint = configuration.inspect<string>(
			'custom.endpoint',
		)?.workspaceValue
		originalHeaders = configuration.inspect<Record<string, string>>(
			'custom.requestHeaders',
		)?.workspaceValue
		await setConfig('custom.endpoint', endpoint)
		await setConfig('custom.requestHeaders', headers)
	})

	teardown(async () => {
		const configuration = vscode.workspace.getConfiguration('commitollama')
		await configuration.update(
			'custom.endpoint',
			originalEndpoint,
			vscode.ConfigurationTarget.Workspace,
		)
		await configuration.update(
			'custom.requestHeaders',
			originalHeaders,
			vscode.ConfigurationTarget.Workspace,
		)
	})

	test('forwards headers to chat and summarization transports', () => {
		const chatAdapter =
			createChatAdapter() as unknown as OllamaTextAdapterInternals
		const summarizeAdapter =
			createSummarizeAdapter() as unknown as SummarizeAdapterInternals

		assert.strictEqual(chatAdapter.client.config.host, `${endpoint}:443`)
		assert.deepStrictEqual(chatAdapter.client.config.headers, headers)
		assert.strictEqual(
			summarizeAdapter.textAdapter.client.config.host,
			`${endpoint}:443`,
		)
		assert.deepStrictEqual(
			summarizeAdapter.textAdapter.client.config.headers,
			headers,
		)
	})
})
