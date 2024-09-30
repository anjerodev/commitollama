import type { EmojisMap, Model } from './llm'

export type ExtensionConfig = {
	model: Model
	useEmojis: boolean
	useDescription: boolean
	commitEmojis: EmojisMap
	custom: {
		endpoint: string
		model: string
		summaryPrompt: string
		summaryTemperature: number
		commitPrompt: string
		commitTemperature: number
	}
}
