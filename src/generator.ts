import { LlmParams, OllamaToken, Options } from "./types/llm"
import { config } from "./config"

async function* lineGenerator(url: string, params: Partial<Options>) {
	if (!params?.prompt) {
		throw Error("No prompt provided")
	}

	const inferenceConfig = config.inference

	const controller = new AbortController()
	const data: LlmParams = {
		model: params.model ?? inferenceConfig.modelName,
		prompt: params.prompt,
		options: {
			num_predict: params?.num_predict ?? 100,
			temperature: params?.temperature ?? 0.8,
		},
	}

	const res = await fetch(url, {
		method: "POST",
		body: JSON.stringify(data),
		headers: {
			"Content-Type": "application/json",
		},
		signal: controller.signal,
	})

	if (!res.ok || !res.body) {
		throw Error("Unable to connect to backend")
	}

	const stream = res.body.getReader()
	const decoder = new TextDecoder()
	let pending = ""
	try {
		while (true) {
			const { done, value } = await stream.read()

			if (done) {
				if (pending.length > 0) {
					yield pending
				}
				break
			}

			const chunk = decoder.decode(value)
			pending += chunk

			while (pending.indexOf("\n") >= 0) {
				const offset = pending.indexOf("\n")
				yield pending.slice(0, offset)
				pending = pending.slice(offset + 1)
			}
		}
	} finally {
		stream.releaseLock()
		if (!stream.closed) {
			await stream.cancel()
		}
		controller.abort()
	}
}

export async function* ollamaTokenGenerator(
	url: string,
	data: Partial<Options>,
): AsyncGenerator<OllamaToken> {
	for await (const line of lineGenerator(url, data)) {
		let parsed: OllamaToken
		try {
			parsed = JSON.parse(line)
		} catch (e) {
			console.warn(`Receive wrong line: ${line}`)
			continue
		}
		yield parsed
	}
}

export async function getSummary(diff: string): Promise<string> {
	let summary = ""

	const prompt = `
	You are an expert developer specialist in creating commits. 
	Provide a super concise one sentence overall changes summary of the 
	following \`git diff\` output following strictly the next rules:
	- Do not use any code snippets, imports, file routes or bullets points.
	- Do not mention the route of file that has been change.
	- Simply describe the MAIN GOAL of the changes.
	- Output directly the summary in plain text.
	- Here is the \`git diff\` output: ${diff}
	`

	const inferenceConfig = config.inference

	for await (const token of ollamaTokenGenerator(
		`${inferenceConfig.endpoint}/api/generate`,
		{
			prompt,
		},
	)) {
		summary += token.response
	}

	summary = summary
		.trimStart()
		.split("\n")
		.map((v) => v.trim())
		.join("\n")

	return summary
}

export async function getCommitMessage(summaries: string[]) {
	let commit = ""

	const prompt =`
	Your only goal is to retrieve a single commit message. 
	Based on the following changes, combine them in ONE SINGLE 
	commit message retrieving the global idea, following strictly the next rules:
	- Always use the next format: \`{type}: {commit_message}\` where
	 \`{type}\` is one of \`feat\`, \`fix\`, \`docs\`, \`style\`, 
	 \`refactor\`, \`test\`, \`chore\`, \`revert\`.
	- Output directly only one commit message in plain text.
	- Be as concise as possible. 40 characters max.
	- Do not add any issues numeration nor explain your output.
	- Here are the summaries changes: ${summaries.join(", ")}
	`

	const inferenceConfig = config.inference

	for await (const token of ollamaTokenGenerator(
		`${inferenceConfig.endpoint}/api/generate`,
		{
			prompt,
			num_predict: 46,
			temperature: 0.2,
		},
	)) {
		commit += token.response
	}

	commit = commit.replaceAll('"', "").replaceAll("`", "").trim()

	return commit
}
