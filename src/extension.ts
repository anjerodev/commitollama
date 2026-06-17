import * as vscode from 'vscode'
import { switchModel } from './modelSelection'
import { BackgroundScanner } from './scheduler'
import { createCommitMessage, getGitExtension } from './utils'

export function activate(context: vscode.ExtensionContext) {
	const scanner = new BackgroundScanner()
	context.subscriptions.push({ dispose: () => scanner.stop() })

	const createCommitDisposable = vscode.commands.registerCommand(
		'commitollama.createCommit',
		async (uri?) => {
			const git = getGitExtension()
			if (!git) {
				vscode.window.showErrorMessage('Unable to load Git Extension')
				return
			}
			if (uri) {
				const uriPath = uri._rootUri?.path || uri.rootUri.path
				const selectedRepository = git.repositories.find((repository) => {
					return repository.rootUri.path === uriPath
				})
				if (selectedRepository) {
					await createCommitMessage(selectedRepository)
				}
			} else {
				for (const repo of git.repositories) {
					await createCommitMessage(repo)
				}
			}
		},
	)

	context.subscriptions.push(createCommitDisposable)

	const switchModelDisposable = vscode.commands.registerCommand(
		'commitollama.switchModel',
		switchModel,
	)

	context.subscriptions.push(switchModelDisposable)
}

export function deactivate() {}
