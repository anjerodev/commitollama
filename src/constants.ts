export const OLLAMA_LIBRARY_URL = 'https://ollama.com/library'
export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434'
export const DEFAULT_MODEL = 'llama3.2:latest'

/** Maps removed preset setting keys to Ollama model tags. */
export const LEGACY_MODEL_SETTINGS: Record<string, string> = {
	Llama: 'llama3.2:latest',
	Codegemma: 'codegemma:latest',
	Codellama: 'codellama',
	Mistral: 'mistral:latest',
	Gemma: 'gemma3:latest',
	Qwen: 'qwen3:latest',
}

export const RECOMMENDED_COMMIT_MODELS = [
	'llama3.2',
	'codellama',
	'qwen3',
	'qwen2.5-coder:7b',
	'mistral',
	'gemma3',
	'codegemma',
] as const

export function isRecommendedModel(modelName: string): boolean {
	const baseName = modelName.split(':')[0]?.toLowerCase() ?? ''
	return RECOMMENDED_COMMIT_MODELS.some(
		(recommended) =>
			baseName === recommended || baseName.startsWith(`${recommended}-`),
	)
}

export function formatNoModelsMessage(): string {
	const recommended = RECOMMENDED_COMMIT_MODELS.join(', ')
	return (
		`No Ollama models found on your instance. Pull one in your terminal first, for example:\n\n` +
		`  ollama pull llama3.2\n\n` +
		`Recommended for commit messages: ${recommended}.\n\n` +
		`See ${OLLAMA_LIBRARY_URL} for more models and setup help.`
	)
}
