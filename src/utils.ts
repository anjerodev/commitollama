import { relative } from 'node:path'
import * as vscode from 'vscode'
import { summaryCache } from './cache'
import { isLowQualitySummary } from './commitQuality'
import { config } from './config'
import { buildDiffFallbackSummary } from './diffFallback'
import {
	type ChangeSummary,
	getCommitMessage,
	getCommitMessageFromDiff,
} from './generator'
import { ensureModelSelected } from './modelSelection'
import { shouldUseDirectDiffPrompt } from './promptStrategy'
import { formatExtensionError, logExtensionError } from './security/log'
import { summarizeFileDiff } from './summarizer'
import type { ExtensionConfig } from './types/config'
import type { Change, GitExtension, Repository } from './types/git'

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

function getRepoRelativePath(repo: Repository, uri: vscode.Uri): string {
	const rootPath = repo.rootUri.fsPath
	if (uri.fsPath.startsWith(rootPath)) {
		return relative(rootPath, uri.fsPath).replace(/\\/g, '/')
	}
	return vscode.workspace.asRelativePath(uri, false)
}

export async function getSummaryUriDiff(
	repo: Repository,
	uri: vscode.Uri,
): Promise<string> {
	const path = getRepoRelativePath(repo, uri)
	return repo.diffIndexWithHEAD(path)
}

async function resolveSummary(
	file: string,
	cacheKey: string,
	diff: string,
	diffHash: string,
): Promise<string> {
	const cached = summaryCache.get(cacheKey)
	if (cached?.diffHash === diffHash && !isLowQualitySummary(cached.summary)) {
		return cached.summary
	}

	try {
		const summary = await summarizeFileDiff(diff)
		if (!isLowQualitySummary(summary)) {
			summaryCache.set(cacheKey, diffHash, summary)
			return summary
		}
	} catch (error) {
		logExtensionError('summarizeStagedChange', error)
	}

	return buildDiffFallbackSummary(file, diff)
}

async function summarizeStagedChange(
	repo: Repository,
	uri: vscode.Uri,
): Promise<ChangeSummary | null> {
	const path = getRepoRelativePath(repo, uri)
	const diff = await repo.diffIndexWithHEAD(path)
	if (!diff || diff.trim() === '') {
		return null
	}

	const summary = await resolveSummary(
		path,
		uri.fsPath,
		diff,
		summaryCache.computeHash(diff),
	)
	return { file: path, summary }
}

async function buildSummariesForCommit(
	repo: Repository,
	stagedFiles: Change[],
): Promise<ChangeSummary[]> {
	const summaries: ChangeSummary[] = []
	for (const change of stagedFiles) {
		const summary = await summarizeStagedChange(repo, change.uri)
		if (summary) {
			summaries.push(summary)
		}
	}

	if (summaries.length === 0) {
		const fullDiff = await repo.diff(true)
		if (fullDiff?.trim()) {
			const summary = await resolveSummary(
				'staged changes',
				'staged changes',
				fullDiff,
				summaryCache.computeHash(fullDiff),
			)
			summaries.push({
				file: 'staged changes',
				summary,
			})
		}
	}

	return summaries
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

				repo.inputBox.value = ''

				const stagedFiles = await repo.diffIndexWithHEAD()

				if (stagedFiles.length === 0) {
					throw new Error(
						'No changes to commit. Please stage your changes first.',
					)
				}

				const stagedDiff = (await repo.diff(true))?.trim() ?? ''
				if (!stagedDiff) {
					throw new Error(
						'No readable staged diffs were found. Stage text file changes with a visible diff.',
					)
				}

				const branchName = repo.state.HEAD?.name
				const { promptStrategy } = config.inference
				const preferDiff = shouldUseDirectDiffPrompt({
					strategy: promptStrategy,
					diffLength: stagedDiff.length,
					fileCount: stagedFiles.length,
				})

				if (preferDiff) {
					try {
						repo.inputBox.value = await getCommitMessageFromDiff(
							stagedDiff,
							branchName,
						)
						return
					} catch (error) {
						if (promptStrategy === 'diff') {
							throw error
						}
						logExtensionError(
							'createCommitMessage.diffPromptFallback',
							error,
						)
					}
				}

				const summaries = await buildSummariesForCommit(repo, stagedFiles)

				if (summaries.length === 0) {
					throw new Error(
						'No readable staged diffs were found. Stage text file changes with a visible diff.',
					)
				}

				repo.inputBox.value = await getCommitMessage(summaries, branchName)
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
