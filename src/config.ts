import {
	type EmojisMap,
	type Model,
	type Language,
	Models,
	Languages,
} from './types/llm'
import { getConfig } from './utils'

export const defaultConfig = {
	endpoint: 'http://127.0.0.1:11434',
	model: Models.Llama,
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
} as const

class Config {
	get inference() {
		// Load model
		const configModel = getConfig('model')
		let model: string | Model = configModel
			? Models[configModel]
			: defaultConfig.model

		if (model === Models.Custom) {
			model = getConfig('custom.model') || defaultConfig.model
		}

		// Load Emojis config
		const useEmojis = getConfig('useEmojis') || defaultConfig.useEmojis
		const customEmojis = getConfig('custom.emojis')
		const commitEmojis =
			customEmojis && typeof customEmojis === 'object'
				? { ...defaultConfig.emojis, ...(customEmojis as EmojisMap) }
				: defaultConfig.emojis

		const useDescription =
			getConfig('useDescription') || defaultConfig.useDescription

		// Load useLowerCase config
		const useLowerCase = getConfig('useLowerCase') || defaultConfig.useLowerCase

		// Load commitTemplate config
		const commitTemplate =
			getConfig('commitTemplate') || defaultConfig.commitTemplate

		// Load language config
		const configLanguage = getConfig('language')
		let language: string | Language = configLanguage
			? Languages[configLanguage]
			: defaultConfig.language
		if (language === Languages.Custom) {
			language = getConfig('custom.language') || defaultConfig.language
		}

		// Load endpoint
		let endpoint = getConfig('custom.endpoint') || defaultConfig.endpoint
		if (endpoint.endsWith('/')) {
			endpoint = endpoint.slice(0, -1).trim()
		}

		// Load temperature
		const promptTemperature =
			getConfig('promptTemperature') || defaultConfig.promptTemperature

		// Load custom prompts
		const customPrompt = getConfig('custom.prompt')
		const customTypeRules = getConfig('custom.typeRules')
		const customCommitMessageRules = getConfig('custom.commitMessageRules')
		const customDescriptionPrompt = getConfig('custom.descriptionPrompt')

        // Load request headers
        const requestHeaders = 
            getConfig('request.headers') || defaultConfig.requestHeaders

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
		}
	}
}

export const config = new Config()
