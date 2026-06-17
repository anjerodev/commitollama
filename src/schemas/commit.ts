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
