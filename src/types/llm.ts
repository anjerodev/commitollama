export enum Model {
	Codellama = "codellama",
	Mistral = "mistral",
}

export type Options = {
	model: Model
	prompt: string
	num_predict: number
	temperature: number
	end_point: string
}

export type LlmParams = {
	model: string | Model
	prompt: string
	options: {
		num_predict: number
		temperature: number
	}
}

export type OllamaToken = {
	model: string
	response: string
	done: boolean
}

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
