import {
	DEFAULT_MODEL,
	DEFAULT_OLLAMA_ENDPOINT,
	LEGACY_MODEL_SETTINGS,
} from './constants'
import { resolveEndpoint } from './security/endpoint'
import { resolveRequestHeaders } from './security/headers'
import { type EmojisMap, type Language, Languages } from './types/llm'
import { getConfig } from './utils'

export const defaultConfig = {
	endpoint: DEFAULT_OLLAMA_ENDPOINT,
	model: DEFAULT_MODEL,
	useEmojis: false,
	useDescription: false,
	useLowerCase: false,
	language: Languages.English,
	commitTemplate: '{{type}} {{emoji}}: {{message}}',
	promptTemperature: 0.2,
	requestHeaders: {},
	emojis: {
		feat: '✨',
		fix: '🐛',
		docs: '📝',
		style: '💎',
		refactor: '♻️',
		test: '🧪',
		chore: '📦',
		revert: '⏪',
	} as EmojisMap,
	background: {
		enabled: true,
		interval: 60,
		onSave: true,
	},
} as const

function resolveModel(): string {
	const configured = getConfig('model')
	if (!configured) {
		return defaultConfig.model
	}

	return LEGACY_MODEL_SETTINGS[configured] ?? configured
}

class Config {
	get inference() {
		const model = resolveModel()

		const useEmojis = getConfig('useEmojis') || defaultConfig.useEmojis
		const customEmojis = getConfig('custom.emojis')
		const commitEmojis =
			customEmojis && typeof customEmojis === 'object'
				? { ...defaultConfig.emojis, ...(customEmojis as EmojisMap) }
				: defaultConfig.emojis

		const useDescription =
			getConfig('useDescription') || defaultConfig.useDescription

		const useLowerCase = getConfig('useLowerCase') || defaultConfig.useLowerCase

		const commitTemplate =
			getConfig('commitTemplate') || defaultConfig.commitTemplate

		const configLanguage = getConfig('language')
		let language: string | Language = configLanguage
			? Languages[configLanguage]
			: defaultConfig.language
		if (language === Languages.Custom) {
			language = getConfig('custom.language') || defaultConfig.language
		}

		const endpoint = resolveEndpoint(getConfig('custom.endpoint'))
		const requestHeaders = resolveRequestHeaders(
			getConfig('custom.requestHeaders'),
		)

		const promptTemperature =
			getConfig('promptTemperature') || defaultConfig.promptTemperature

		const customPrompt = getConfig('custom.prompt')
		const customTypeRules = getConfig('custom.typeRules')
		const customCommitMessageRules = getConfig('custom.commitMessageRules')
		const customDescriptionPrompt = getConfig('custom.descriptionPrompt')

		const background = {
			enabled:
				getConfig('background.enabled') ?? defaultConfig.background.enabled,
			interval:
				getConfig('background.interval') ?? defaultConfig.background.interval,
			onSave: getConfig('background.onSave') ?? defaultConfig.background.onSave,
		}

		return {
			commitEmojis,
			promptTemperature,
			commitTemplate,
			customCommitMessageRules,
			customDescriptionPrompt,
			customPrompt,
			customTypeRules,
			endpoint,
			language,
			model,
			useDescription,
			useEmojis,
			useLowerCase,
			requestHeaders,
			background,
		}
	}
}

export const config = new Config()
