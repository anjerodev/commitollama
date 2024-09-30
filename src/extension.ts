import * as vscode from 'vscode'
import ollama from 'ollama'
import { createCommitMessage, getGitExtension } from './utils'

export function activate(context: vscode.ExtensionContext) {
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

	const ollamaPullDisposable = vscode.commands.registerCommand(
		'commitollama.runOllamaPull',
		async (model: string) => {
			vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Pulling model "${model}", this can take a while... Please be patient.`,
					cancellable: true,
				},
				async (progress, token) => {
					if (!model) {
						vscode.window.showErrorMessage('Please provide a model name.')
						return
					}

					let pullPromise = ollama.pull({ model })

					token.onCancellationRequested(() => {
						vscode.window.showInformationMessage('Model pull cancelled.')
						pullPromise = Promise.reject('pull-cancelled')
					})

					try {
						await pullPromise
						vscode.window.showInformationMessage(
							`Model "${model}" pulled successfully.`,
						)
					} catch (error: any) {
						if (error === 'pull-cancelled') {
							vscode.window.showInformationMessage('Model pull was cancelled.')
						} else {
							vscode.window.showErrorMessage(
								error?.message || 'The model could not be pulled.',
							)
						}
					}
				},
			)
		},
	)

	context.subscriptions.push(createCommitDisposable, ollamaPullDisposable)
}

export function deactivate() {}
