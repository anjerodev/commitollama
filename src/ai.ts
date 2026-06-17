import {
	type SummarizationResult,
	chat as tanstackChat,
	summarize as tanstackSummarize,
} from '@tanstack/ai'

const llm = {
	chat: tanstackChat,
	summarize: tanstackSummarize,
}

export function chat(...args: Parameters<typeof tanstackChat>) {
	return llm.chat(...args)
}

export function summarize(...args: Parameters<typeof tanstackSummarize>) {
	return llm.summarize(...args) as Promise<SummarizationResult>
}

export { llm }
