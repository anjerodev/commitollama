import * as vscode from "vscode"
import { GitExtension, Repository } from "./types/git"
import { getCommitMessage, getSummary } from "./generator"

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand(
		"commitollama.createCommit",
		async (uri?) => {
			const git = getGitExtension()
			if (!git) {
				vscode.window.showErrorMessage("Unable to load Git Extension")
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

	context.subscriptions.push(disposable)
}

async function getSummaryUriDiff(repo: Repository, uri: string) {
	const diff = await repo.diffIndexWithHEAD(uri)
	const summary = await getSummary(diff)
	return summary
}

async function createCommitMessage(repo: Repository) {
	vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.SourceControl,
			cancellable: false,
			title: "Loading commit message",
		},
		async () => {
			vscode.commands.executeCommand("workbench.view.scm")
			try {
				const ind = await repo.diffIndexWithHEAD()
				const callbacks = ind.map((change) =>
					getSummaryUriDiff(repo, change.uri.fsPath),
				)
				const summaries = await Promise.all(callbacks)
				const commitMessage = await getCommitMessage(summaries)
				repo.inputBox.value = commitMessage

				// biome-ignore lint/suspicious/noExplicitAny: no-explicit-any for error handling
			} catch (error: any) {
				vscode.window.showErrorMessage(error.message)
			}
		},
	)
}

function getGitExtension() {
	const vscodeGit = vscode.extensions.getExtension<GitExtension>("vscode.git")
	const gitExtension = vscodeGit?.exports
	return gitExtension?.getAPI(1)
}

export function deactivate() {}
