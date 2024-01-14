import vscode from "vscode"
import { Model } from "./types/llm"

class Config {
	// Inference
	get inference() {
		const config = this.#config

		// Load endpoint
		let endpoint = (config.get("endpoint") as string).trim()
		if (endpoint.endsWith("/")) {
			endpoint = endpoint.slice(0, endpoint.length - 1).trim()
		}
		if (endpoint === "") {
			endpoint = "http://127.0.0.1:11434"
		}

		// Load model
		let modelName = config.get("model") as string | Model
		if (!modelName || modelName === "") {
			modelName = Model.Mistral
		}
		if (modelName === "custom") {
			modelName = config.get("custom.model") as string
		}

		return {
			endpoint,
			modelName,
		}
	}

	get #config() {
		return vscode.workspace.getConfiguration("inference")
	}
}

export const config = new Config()
