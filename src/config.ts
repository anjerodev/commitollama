import vscode from "vscode"
import { EmojisMap, Model } from "./types/llm"

export const defaultConfig = {
	model: Model.Mistral,
	useEmojis: false,
	commitEmojis: {
		feat: "✨",
		fix: "🐛",
		docs: "📝",
		style: "💎",
		refactor: "♻️",
		test: "🧪",
		chore: "📦",
		revert: "⏪",
	},
	temperature: 0.8,
	num_predict: 100,
}

class Config {
	get inference() {
		const config = this.#config

		// Load model
		let modelName: string | Model = config.get("model") || defaultConfig.model
		if (modelName === "custom") {
			modelName = config.get("custom.model") as string
		}

		// Load Emojis Config
		const useEmojis: boolean =
			config.get("useEmojis") || defaultConfig.useEmojis
		const commitEmojis: EmojisMap =
			config.get("commitEmojis") || defaultConfig.commitEmojis

		// Load endpoint
		let endpoint: string =
			config.get("custom.endpoint") || "http://127.0.0.1:11434"
		if (endpoint.endsWith("/")) {
			endpoint = endpoint.slice(0, -1).trim()
		}

		// Load custom prompt and temperatures
		const summaryPrompt = config.get("custom.summaryPrompt") as string
		const summaryTemperature = config.get("custom.summaryTemperature") as number
		const commitPrompt = config.get("custom.commitPrompt") as string
		const commitTemperature = config.get("custom.commitTemperature") as number

		return {
			endpoint,
			modelName,
			summaryPrompt,
			summaryTemperature,
			commitPrompt,
			commitTemperature,
			useEmojis,
			commitEmojis,
		}
	}

	get #config() {
		return vscode.workspace.getConfiguration("commitollama")
	}
}

export const config = new Config()
