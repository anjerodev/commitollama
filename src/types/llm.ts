export const Languages = {
	Arabic: 'arabic',
	Chinese: 'chinese',
	English: 'english',
	French: 'french',
	German: 'german',
	Italian: 'italian',
	Japanese: 'japanese',
	Korean: 'korean',
	Portuguese: 'portuguese',
	Russian: 'russian',
	Spanish: 'spanish',
	Custom: 'custom',
} as const
export type Language = keyof typeof Languages

export type EmojisMap = {
	feat: string
	fix: string
	docs: string
	style: string
	refactor: string
	test: string
	chore: string
	revert: string
}
