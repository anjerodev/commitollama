import * as assert from 'node:assert'
import { ZodError } from 'zod'
import {
	formatNoModelsMessage,
	isRecommendedModel,
	RECOMMENDED_COMMIT_MODELS,
} from '../constants'
import { buildCommitSchema, parseCommitResponse } from '../schemas/commit'
import { validateEndpoint } from '../security/endpoint'
import { sanitizeRequestHeaders } from '../security/headers'
import {
	formatExtensionError,
	logExtensionError,
	redactSensitiveData,
} from '../security/log'
import { wrapUntrustedContent } from '../security/prompt'

suite('Security Tests', () => {
	suite('commit schema', () => {
		test('Should accept a valid response', () => {
			const result = parseCommitResponse(
				{ type: 'feat', message: 'Add new feature' },
				false,
				'english',
			)

			assert.strictEqual(result.type, 'feat')
			assert.strictEqual(result.message, 'Add new feature')
		})

		test('Should require summary when useDescription is true', () => {
			const result = parseCommitResponse(
				{
					type: 'feat',
					message: 'Add new feature',
					summary: 'Extended summary',
				},
				true,
				'english',
			)

			assert.strictEqual(result.summary, 'Extended summary')
		})

		test('Should reject missing fields', () => {
			assert.throws(
				() => parseCommitResponse({ type: 'feat' }, false, 'english'),
				(err) => err instanceof ZodError,
			)
		})

		test('Should reject wrong types', () => {
			assert.throws(
				() =>
					parseCommitResponse(
						{ type: 123, message: 'Add feature' },
						false,
						'english',
					),
				(err) => err instanceof ZodError,
			)
		})

		test('Should reject unknown commit type', () => {
			assert.throws(
				() =>
					parseCommitResponse(
						{ type: 'unknown', message: 'Add feature' },
						false,
						'english',
					),
				(err) => err instanceof ZodError,
			)
		})

		test('Should reject oversized message', () => {
			assert.throws(
				() =>
					parseCommitResponse(
						{ type: 'feat', message: 'x'.repeat(201) },
						false,
						'english',
					),
				(err) => err instanceof ZodError,
			)
		})

		test('Should build schema with description field when enabled', () => {
			const schema = buildCommitSchema(true, 'english')
			assert.ok('summary' in schema.shape)
		})
	})

	suite('model helpers', () => {
		test('Should identify recommended models', () => {
			assert.ok(isRecommendedModel('llama3.2:latest'))
			assert.ok(!isRecommendedModel('phi3:latest'))
		})

		test('Should include recommended models in empty-state message', () => {
			const message = formatNoModelsMessage()
			for (const model of RECOMMENDED_COMMIT_MODELS) {
				assert.ok(message.includes(model))
			}
			assert.ok(message.includes('ollama pull'))
		})
	})

	suite('sanitizeRequestHeaders', () => {
		test('Should block Host header', () => {
			const result = sanitizeRequestHeaders({
				Host: 'evil.com',
				Authorization: 'Bearer secret',
			})

			assert.strictEqual(result.Host, undefined)
			assert.strictEqual(result.Authorization, 'Bearer secret')
		})

		test('Should reject invalid key characters', () => {
			const result = sanitizeRequestHeaders({
				'X Bad Header': 'value',
				'X-Valid': 'ok',
			})

			assert.strictEqual(result['X Bad Header'], undefined)
			assert.strictEqual(result['X-Valid'], 'ok')
		})
	})

	suite('validateEndpoint', () => {
		test('Should accept valid http endpoint', () => {
			const result = validateEndpoint('http://127.0.0.1:11434')
			assert.strictEqual(result, 'http://127.0.0.1:11434')
		})

		test('Should reject file scheme', () => {
			assert.throws(
				() => validateEndpoint('file:///etc/passwd'),
				/must use http or https/,
			)
		})

		test('Should reject javascript scheme', () => {
			assert.throws(
				() => validateEndpoint('javascript:alert(1)'),
				/must use http or https/,
			)
		})

		test('Should reject credentialed URLs', () => {
			assert.throws(
				() => validateEndpoint('http://user:pass@127.0.0.1:11434'),
				/must not include credentials/,
			)
		})
	})

	suite('wrapUntrustedContent', () => {
		test('Should wrap content with delimiters and instruction', () => {
			const result = wrapUntrustedContent('diff', '+console.log()')

			assert.ok(result.includes('<untrusted_diff>'))
			assert.ok(result.includes('</untrusted_diff>'))
			assert.ok(result.includes('+console.log()'))
			assert.ok(result.includes('untrusted user data'))
		})
	})

	suite('logExtensionError', () => {
		test('Should redact Bearer tokens from error message', () => {
			const redacted = redactSensitiveData(
				'Request failed with Bearer abc123token',
			)

			assert.ok(!redacted.includes('abc123token'))
			assert.ok(redacted.includes('[REDACTED]'))
		})

		test('Should log without throwing', () => {
			logExtensionError('test', new Error('safe message'))
		})
	})

	suite('formatExtensionError', () => {
		test('Should extract nested Ollama error fields', () => {
			const message = formatExtensionError({
				status_code: 400,
				error: 'model does not support structured outputs',
				message: 'Structured output generation failed',
			})

			assert.ok(message.includes('model does not support structured outputs'))
			assert.ok(message.includes('HTTP 400'))
		})

		test('Should unwrap Error cause chain', () => {
			const inner = new Error('connection reset')
			const outer = new Error(
				'Structured output generation failed',
			) as Error & { cause: unknown }
			outer.cause = inner

			const message = formatExtensionError(outer)

			assert.ok(message.includes('Structured output generation failed'))
			assert.ok(message.includes('connection reset'))
		})
	})
})
