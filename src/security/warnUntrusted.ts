import * as vscode from 'vscode'

const warnedSettings = new Set<'endpoint' | 'headers'>()

export function warnUntrustedConfigOnce(setting: 'endpoint' | 'headers'): void {
	if (warnedSettings.has(setting)) {
		return
	}
	warnedSettings.add(setting)

	const label =
		setting === 'endpoint' ? 'custom Ollama endpoint' : 'custom request headers'

	vscode.window.showWarningMessage(
		`Commitollama: ${label} is ignored in untrusted workspaces. Trust this workspace to use custom Ollama settings.`,
	)
}
