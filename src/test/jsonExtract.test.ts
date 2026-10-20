import * as assert from 'node:assert'
import { extractJsonObject } from '../schemas/jsonExtract'

suite('extractJsonObject', () => {
	test('parses a raw JSON object', () => {
		assert.deepStrictEqual(
			extractJsonObject('{"type":"feat","message":"Add feature"}'),
			{
				type: 'feat',
				message: 'Add feature',
			},
		)
	})

	test('parses a JSON fenced response', () => {
		assert.deepStrictEqual(
			extractJsonObject('```json\n{"type":"fix","message":"Fix bug"}\n```'),
			{ type: 'fix', message: 'Fix bug' },
		)
	})

	test('parses a generically fenced response', () => {
		assert.deepStrictEqual(
			extractJsonObject('```\n{"type":"docs","message":"Update README"}\n```'),
			{ type: 'docs', message: 'Update README' },
		)
	})

	test('parses a JSON object embedded in text', () => {
		assert.deepStrictEqual(
			extractJsonObject(
				'Here is the commit: {"type":"test","message":"Add parser tests"}.',
			),
			{ type: 'test', message: 'Add parser tests' },
		)
	})

	test('throws when no JSON object is present', () => {
		assert.throws(
			() => extractJsonObject('no json here'),
			/Could not find a JSON object/,
		)
	})
})
