import { type EmojisMap, type Model, Models } from './types/llm'
import { getConfig } from './utils'

export const defaultConfig = {
	endpoint: 'http://127.0.0.1:11434',
}

class Config {
	get inference() {
		// Load model
		const configModel = getConfig('model') as keyof typeof Models
		let modelName: string | Model = Models[configModel]

		if (configModel === 'Custom') {
			modelName = getConfig('custom.model') || ''
		}

		// Load Emojis Config
		const useEmojis = getConfig('useEmojis') as boolean
		const commitEmojis = getConfig('commitEmojis') as EmojisMap
		const useDescription = getConfig('useDescription') as boolean

		// Load endpoint
		let endpoint = getConfig('custom.endpoint') || defaultConfig.endpoint
		if (endpoint.endsWith('/')) {
			endpoint = endpoint.slice(0, -1).trim()
		}

		// Load custom prompt and temperatures
		const summaryPrompt = getConfig('custom.summaryPrompt')
		const summaryTemperature = getConfig('custom.summaryTemperature') as number

		const commitPrompt = getConfig('custom.commitPrompt')
		const commitTemperature = getConfig('custom.commitTemperature') as number

		return {
			endpoint,
			modelName,
			summaryPrompt,
			summaryTemperature,
			commitPrompt,
			commitTemperature,
			useDescription,
			useEmojis,
			commitEmojis,
		}
	}
}

export const config = new Config()
