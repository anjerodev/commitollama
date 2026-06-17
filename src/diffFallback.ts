export function buildDiffFallbackSummary(file: string, diff: string): string {
	const lines = diff.split('\n')
	const addedLines = lines
		.filter((line) => line.startsWith('+') && !line.startsWith('+++'))
		.map((line) => line.slice(1).trim())
		.filter(Boolean)
	const removedCount = lines.filter(
		(line) => line.startsWith('-') && !line.startsWith('---'),
	).length

	if (addedLines.length > 0) {
		const preview = addedLines.slice(0, 2).join('; ')
		const clipped =
			preview.length > 80 ? `${preview.slice(0, 77)}...` : preview
		if (removedCount > 0) {
			return `Update ${file}: add ${addedLines.length} line(s), remove ${removedCount} line(s) — ${clipped}`
		}
		return `Update ${file}: add ${addedLines.length} line(s) — ${clipped}`
	}

	if (removedCount > 0) {
		return `Update ${file}: remove ${removedCount} line(s)`
	}

	return `Update ${file}`
}
