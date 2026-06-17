import * as vscode from 'vscode'
import { summaryCache } from './cache'
import { isLowQualitySummary } from './commitQuality'
import { config } from './config'
import { logExtensionError } from './security/log'
import { summarizeFileDiff } from './summarizer'
import { getGitExtension } from './utils'

export class BackgroundScanner {
	private intervalId: NodeJS.Timeout | undefined
	private disposables: vscode.Disposable[] = []

	constructor() {
		this.start()
	}

	public start() {
		if (this.disposables.length > 0) {
			return
		}

		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument(async (doc) => {
				const { background } = config.inference
				if (background.enabled && background.onSave) {
					await this.processFile(doc.uri)
				}
			}),
		)

		this.restartInterval()

		this.disposables.push(
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration('commitollama.background')) {
					this.restartInterval()
				}
			}),
		)
	}

	private restartInterval() {
		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = undefined
		}

		const { background } = config.inference
		if (background.enabled && background.interval > 0) {
			this.intervalId = setInterval(() => {
				this.scanOpenRepositories()
			}, background.interval * 1000)
		}
	}

	public stop() {
		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = undefined
		}
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
	}

	private async scanOpenRepositories() {
		const git = getGitExtension()
		if (!git) {
			return
		}

		for (const repo of git.repositories) {
			const changes = await repo.diffWithHEAD()
			for (const change of changes) {
				await this.processFile(change.uri)
			}
		}
	}

	private async processFile(uri: vscode.Uri) {
		try {
			const git = getGitExtension()
			const repo = git?.repositories.find((r) =>
				uri.fsPath.startsWith(r.rootUri.fsPath),
			)
			if (!repo) {
				return
			}

			// Working-tree diff; commit uses staged diff and matches by content hash.
			const relativePath = vscode.workspace.asRelativePath(uri)
			const workingDiff = await repo.diffWithHEAD(relativePath)
			if (!workingDiff) {
				return
			}

			const hash = summaryCache.computeHash(workingDiff)
			const cached = summaryCache.get(uri.fsPath)
			if (cached?.diffHash === hash) {
				return
			}

			const summary = await summarizeFileDiff(workingDiff)
			if (!isLowQualitySummary(summary)) {
				summaryCache.set(uri.fsPath, hash, summary)
			}
		} catch (error) {
			logExtensionError(`backgroundScan ${uri.fsPath}`, error)
		}
	}
}
