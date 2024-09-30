import type { EmojisMap, Model } from './llm'

export type ExtensionConfig = {
	model: Model
	useEmojis: boolean
	useDescription: boolean
	commitEmojis: EmojisMap
	'custom.endpoint': string
	'custom.model': string
	'custom.summaryPrompt': string
	'custom.summaryTemperature': number
	'custom.commitPrompt': string
	'custom.commitTemperature': number
}
