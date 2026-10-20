export function extractJsonObject(text: string): unknown {
	for (
		let start = text.indexOf('{');
		start !== -1;
		start = text.indexOf('{', start + 1)
	) {
		let depth = 0
		let inString = false
		let escaped = false

		for (let index = start; index < text.length; index++) {
			const character = text[index]

			if (inString) {
				if (escaped) {
					escaped = false
				} else if (character === '\\') {
					escaped = true
				} else if (character === '"') {
					inString = false
				}
				continue
			}

			if (character === '"') {
				inString = true
			} else if (character === '{') {
				depth++
			} else if (character === '}') {
				depth--
				if (depth === 0) {
					try {
						return JSON.parse(text.slice(start, index + 1))
					} catch {
						break
					}
				}
			}
		}
	}

	throw new Error('Could not find a JSON object in the model response')
}
