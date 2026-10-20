import * as vscode from 'vscode'

const warnedSettings = new Set<string>()

function warnOnce(key: string, message: string): void {
	if (warnedSettings.has(key)) {
		return
	}
	warnedSettings.add(key)
	vscode.window.showWarningMessage(message)
}

export function warnUntrustedConfigOnce(
	setting: 'endpoint' | 'headers' | 'prompt',
): void {
	const label =
		setting === 'endpoint'
			? 'custom inference endpoint'
			: setting === 'headers'
				? 'custom request headers'
				: 'custom prompt text'

	warnOnce(
		`untrusted:${setting}`,
		`Commitollama: ${label} is ignored in untrusted workspaces.`,
	)
}

export function warnWorkspaceNetworkIgnoredOnce(
	setting: 'endpoint' | 'headers',
): void {
	const message =
		setting === 'endpoint'
			? 'Commitollama: ignored a non-local inference endpoint from workspace settings. Set commitollama.custom.endpoint in user settings to use a remote server.'
			: 'Commitollama: ignored request headers from workspace settings. Set commitollama.custom.requestHeaders in user settings.'

	warnOnce(`workspace:${setting}`, message)
}
