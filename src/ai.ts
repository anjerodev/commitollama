import { randomUUID } from 'node:crypto'
import {
	type SummarizationResult,
	chat as tanstackChat,
	summarize as tanstackSummarize,
} from '@tanstack/ai'

const llm = {
	chat: tanstackChat,
	summarize: tanstackSummarize,
}

type WithOptionalThreadId<T> = Omit<T, 'threadId'> & { threadId?: string }

export function chat(
	options: WithOptionalThreadId<Parameters<typeof tanstackChat>[0]>,
) {
	return llm.chat({
		threadId: randomUUID(),
		...options,
	} as Parameters<typeof tanstackChat>[0])
}

export function summarize(
	options: WithOptionalThreadId<Parameters<typeof tanstackSummarize>[0]>,
) {
	return llm.summarize({
		threadId: randomUUID(),
		...options,
	} as Parameters<typeof tanstackSummarize>[0]) as Promise<SummarizationResult>
}

export { llm }
