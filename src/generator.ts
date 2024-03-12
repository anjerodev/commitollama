import { config } from "./config"
import { Ollama } from "ollama"

export async function getSummary(diff: string): Promise<string> {
	const { summaryPrompt, endpoint, summaryTemperature, modelName } =
		config.inference
	const ollama = new Ollama({ host: endpoint })

	const defaultSummaryPrompt = `You are an expert developer specialist in creating commits.
	Provide a super concise one sentence overall changes summary of the user \`git diff\` output following strictly the next rules:
	- Do not use any code snippets, imports, file routes or bullets points.
	- Do not mention the route of file that has been change.
	- Simply describe the MAIN GOAL of the changes.
	- Output directly the summary in plain text.`

	const prompt = summaryPrompt || defaultSummaryPrompt

	try {
		const res = await ollama.chat({
			model: modelName,
			options: {
				temperature: summaryTemperature,
			},
			messages: [
				{
					role: "system",
					content: prompt,
				},
				{
					role: "user",
					content: `Here is the \`git diff\` output: ${diff}`,
				},
			],
		})

		return res.message.content
			.trimStart()
			.split("\n")
			.map((v) => v.trim())
			.join("\n")
	} catch (error) {
		throw new Error(
			"Unable to connect to ollama. Please, check that ollama is running.",
		)
	}
}

export async function getCommitMessage(summaries: string[]) {
	const {
		commitPrompt,
		endpoint,
		commitTemperature,
		useEmojis,
		commitEmojis,
		modelName,
	} = config.inference
	const ollama = new Ollama({ host: endpoint })

	const defaultCommitPrompt = `You are an expert developer specialist in creating commits messages.
	Your only goal is to retrieve a single commit message. 
	Based on the provided user changes, combine them in ONE SINGLE commit message retrieving the global idea, following strictly the next rules:
	- Always use the next format: \`{type}: {commit_message}\` where \`{type}\` is one of \`feat\`, \`fix\`, \`docs\`, \`style\`, \`refactor\`, \`test\`, \`chore\`, \`revert\`.
	- Output directly only one commit message in plain text.
	- Be as concise as possible. 50 characters max.
	- Do not add any issues numeration nor explain your output.`

	const prompt = commitPrompt || defaultCommitPrompt

	try {
		const response = await ollama.chat({
			model: modelName,
			options: {
				temperature: commitTemperature,
				num_predict: 45,
			},
			messages: [
				{
					role: "system",
					content: prompt,
				},
				{
					role: "user",
					content: `Here are the summaries changes: ${summaries.join(", ")}`,
				},
			],
		})

		let commit = response.message.content.replace(/["`]/g, "")

		// Add the emoji to the commit if activated
		if (useEmojis) {
			const emojisMap = JSON.parse(JSON.stringify(commitEmojis))
			for (const [type, emoji] of Object.entries(emojisMap)) {
				const regex = new RegExp(`\\b${type}\\b`, "g")
				commit = commit.replace(regex, `${type} ${emoji}`)
			}
		}

		return commit.trim()
	} catch (error) {
		throw new Error("Unable to generate commit.")
	}
}
