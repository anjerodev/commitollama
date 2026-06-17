import type { EmojisMap, Language } from './llm'

export type ExtensionConfig = {
	model?: string
	useEmojis: boolean
	useDescription: boolean
	useLowerCase: boolean
	language: Language
	promptTemperature: number
	commitTemplate: string
	'custom.language'?: string
	'custom.emojis'?: EmojisMap
	'custom.endpoint'?: string
	'custom.prompt'?: string
	'custom.typeRules'?: string
	'custom.commitMessageRules'?: string
	'custom.descriptionPrompt'?: string
	'custom.requestHeaders'?: Record<string, string>
	'background.enabled'?: boolean
	'background.interval'?: number
	'background.onSave'?: boolean
}
