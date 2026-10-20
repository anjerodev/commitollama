/**
 * Request knobs that ask OpenAI-compatible servers (LM Studio, vLLM, etc.)
 * to skip chain-of-thought. Servers that do not understand a field ignore it;
 * models that cannot disable thinking still may emit reasoning tokens.
 *
 * Do not set OpenAI `response_format: json_object` here — LM Studio only
 * accepts `json_schema` or `text`, so we rely on JSON-only prompting instead.
 */
export function buildOpenAICompatibleModelOptions(options: {
	temperature: number
	maxTokens?: number
}): Record<string, unknown> {
	return {
		temperature: options.temperature,
		...(options.maxTokens !== undefined
			? { max_tokens: options.maxTokens }
			: {}),
		// Qwen / vLLM / many LM Studio chat templates
		chat_template_kwargs: { enable_thinking: false },
		enable_thinking: false,
	}
}
