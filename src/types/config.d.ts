import type { EmojisMap, Language, Model } from './llm'

export type ExtensionConfig = {
	model: Model
	useEmojis: boolean
	useDescription: boolean
	useLowerCase: boolean
	language: Language
	promptTemperature: number
	commitTemplate: string
	'custom.model'?: string
	'custom.language'?: string
	'custom.emojis'?: EmojisMap
	'custom.endpoint'?: string
	'custom.prompt'?: string
	'custom.typeRules'?: string
	'custom.commitMessageRules'?: string
	'custom.descriptionPrompt'?: string
    'request.headers'?: Record<string, string>
}
