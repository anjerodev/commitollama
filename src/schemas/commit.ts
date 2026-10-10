import { z } from 'zod'

export const COMMIT_TYPES = [
	'feat',
	'fix',
	'docs',
	'style',
	'test',
	'chore',
	'revert',
	'refactor',
] as const

export type CommitType = (typeof COMMIT_TYPES)[number]

export type CommitStructure = {
	type: CommitType
	message: string
	summary?: string
}

export function extractJsonObject(text: string): unknown {
	for (
		let start = text.indexOf('{');
		start !== -1;
		start = text.indexOf('{', start + 1)
	) {
		let depth = 0
		let inString = false
		let escaped = false

		for (let index = start; index < text.length; index++) {
			const character = text[index]

			if (inString) {
				if (escaped) {
					escaped = false
				} else if (character === '\\') {
					escaped = true
				} else if (character === '"') {
					inString = false
				}
				continue
			}

			if (character === '"') {
				inString = true
			} else if (character === '{') {
				depth++
			} else if (character === '}') {
				depth--
				if (depth === 0) {
					try {
						return JSON.parse(text.slice(start, index + 1))
					} catch {
						break
					}
				}
			}
		}
	}

	throw new Error('Could not find a JSON object in the model response')
}

export function buildCommitSchema(useDescription: boolean, language: string) {
	const base = z.object({
		type: z
			.enum(COMMIT_TYPES)
			.describe(
				'The commit type (feat, fix, docs, style, test, chore, revert, refactor)',
			),
		message: z
			.string()
			.trim()
			.min(1)
			.max(200)
			.describe(`The commit message in ${language}`),
	})

	if (useDescription) {
		return base.extend({
			summary: z
				.string()
				.trim()
				.min(1)
				.max(500)
				.describe(`Extended summary of the changes in ${language}`),
		})
	}

	return base
}

export function parseCommitResponse(
	data: unknown,
	useDescription: boolean,
	language: string,
): CommitStructure {
	return buildCommitSchema(useDescription, language).parse(data)
}
