export function isGptOssModel(model: string): boolean {
	return /^gpt-oss(?::|$)/i.test(model)
}

export interface OllamaGenerationOptions {
	temperature: number
	num_predict?: number
}

export interface OllamaModelOptions {
	options: OllamaGenerationOptions
	think?: 'low' | false
}

export function buildCommitModelOptions(
	model: string,
	promptTemperature: number,
): OllamaModelOptions {
	const isGptOss = isGptOssModel(model)

	return {
		options: {
			temperature: promptTemperature,
			// GPT-OSS cannot disable reasoning. Give its low-effort trace enough
			// room to finish before it emits the short, visible JSON response.
			num_predict: isGptOss ? 2048 : 256,
		},
		think: isGptOss ? 'low' : false,
	}
}

export function buildSummarizeModelOptions(
	model: string,
	promptTemperature: number,
): OllamaModelOptions {
	if (!isGptOssModel(model)) {
		return {
			options: { temperature: promptTemperature },
		}
	}

	return {
		options: {
			temperature: promptTemperature,
			// The summarize adapter otherwise maps maxLength directly to an
			// 80-token generation cap, which GPT-OSS can exhaust on reasoning.
			num_predict: 1024,
		},
		think: 'low',
	}
}
