import * as vscode from 'vscode'
import type { GitExtension, Repository } from './types/git'
import { getCommitMessage, getSummary } from './generator'
import ollama from 'ollama'

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

	context.subscriptions.push(createCommitDisposable)
	context.subscriptions.push(ollamaPullDisposable)
}

export async function getSummaryUriDiff(repo: Repository, uri: string) {
	const diff = await repo.diffIndexWithHEAD(uri)
	const summary = await getSummary(diff)
	return summary
}

export async function createCommitMessage(repo: Repository) {
	vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.SourceControl,
			cancellable: false,
			title: 'Loading commit message',
		},
		async () => {
			vscode.commands.executeCommand('workbench.view.scm')
			try {
				// Clean the current message:
				repo.inputBox.value = ''

				const ind = await repo.diffIndexWithHEAD()

				if (ind.length === 0) {
					throw new Error(
						'No changes to commit. Please stage your changes first.',
					)
				}

				const callbacks = ind.map((change) =>
					getSummaryUriDiff(repo, change.uri.fsPath),
				)
				const summaries = await Promise.all(callbacks)

				const commitMessage = await getCommitMessage(summaries)
				repo.inputBox.value = commitMessage
			} catch (error: any) {
				vscode.window.showErrorMessage(
					error?.message || 'Unable to create commit message.',
				)
			}
		},
	)
}

export function getGitExtension() {
	const vscodeGit = vscode.extensions.getExtension<GitExtension>('vscode.git')
	const gitExtension = vscodeGit?.exports
	return gitExtension?.getAPI(1)
}

export function deactivate() {}
