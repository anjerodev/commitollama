import * as vscode from 'vscode'
import type { GitExtension, Repository } from './types/git'
import { getCommitMessage, getSummary } from './generator'
import type { ExtensionConfig } from './types/config'

export function getConfig<K extends keyof ExtensionConfig>(key: K) {
	return vscode.workspace
		.getConfiguration('commitollama')
		.get<ExtensionConfig[K]>(key)
}

export function setConfig<K extends keyof ExtensionConfig>(
	key: K,
	value: ExtensionConfig[K],
) {
	return vscode.workspace
		.getConfiguration('commitollama')
		.update(key, value, vscode.ConfigurationTarget.Workspace)
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
