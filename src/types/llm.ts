export const Models = {
	Llama: 'llama3.2:latest',
	Codegemma: 'codegemma:latest',
	Codellama: 'codellama',
	Mistral: 'mistral:latest',
	Custom: 'custom',
} as const

export type Model = keyof typeof Models

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
