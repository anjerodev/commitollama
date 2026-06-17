import * as vscode from 'vscode'
import { summaryCache } from './cache'
import { isLowQualitySummary } from './commitQuality'
import { type ChangeSummary, getCommitMessage } from './generator'
import { ensureModelSelected } from './modelSelection'
import { formatExtensionError, logExtensionError } from './security/log'
import { summarizeFileDiff } from './summarizer'
import type { ExtensionConfig } from './types/config'
import type { GitExtension, Repository } from './types/git'

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

export async function getSummaryUriDiff(
	repo: Repository,
	uri: vscode.Uri,
): Promise<string> {
	const path = vscode.workspace.asRelativePath(uri)
	return repo.diffIndexWithHEAD(path)
}

async function summarizeStagedChange(
	repo: Repository,
	uri: vscode.Uri,
): Promise<ChangeSummary | null> {
	const path = vscode.workspace.asRelativePath(uri)
	const diff = await repo.diffIndexWithHEAD(path)
	if (!diff || diff.trim() === '') {
		return null
	}

	const hash = summaryCache.computeHash(diff)
	const cached = summaryCache.get(uri.fsPath)

	let summary: string
	if (cached && cached.diffHash === hash) {
		summary = cached.summary
	} else {
		summary = await summarizeFileDiff(diff)
		summaryCache.set(uri.fsPath, hash, summary)
	}

	if (isLowQualitySummary(summary)) {
		return null
	}

	return { file: path, summary }
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
				if (!(await ensureModelSelected())) {
					return
				}

				// Clean the current message:
				repo.inputBox.value = ''

				const ind = await repo.diffIndexWithHEAD()

				if (ind.length === 0) {
					throw new Error(
						'No changes to commit. Please stage your changes first.',
					)
				}

				const summaries: ChangeSummary[] = []
				for (const change of ind) {
					const summary = await summarizeStagedChange(repo, change.uri)
					if (summary) {
						summaries.push(summary)
					}
				}

				if (summaries.length === 0) {
					const fullDiff = await repo.diff(true)
					if (fullDiff?.trim()) {
						const summary = await summarizeFileDiff(fullDiff)
						if (!isLowQualitySummary(summary)) {
							summaries.push({
								file: 'staged changes',
								summary,
							})
						}
					}
				}

				if (summaries.length === 0) {
					throw new Error(
						'No readable staged diffs were found. Stage text file changes with a visible diff.',
					)
				}

				const commitMessage = await getCommitMessage(summaries)
				repo.inputBox.value = commitMessage
			} catch (error: unknown) {
				logExtensionError('createCommitMessage', error)
				const message =
					error instanceof Error && !error.message.trim()
						? ''
						: formatExtensionError(error)
				if (message && message !== 'Unknown error') {
					vscode.window.showErrorMessage(message)
				}
			}
		},
	)
}

export function getGitExtension() {
	const vscodeGit = vscode.extensions.getExtension<GitExtension>('vscode.git')
	const gitExtension = vscodeGit?.exports
	return gitExtension?.getAPI(1)
}
