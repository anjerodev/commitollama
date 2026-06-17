import * as vscode from 'vscode'
import { config } from './config'
import {
	formatNoModelsMessage,
	isRecommendedModel,
	OLLAMA_LIBRARY_URL,
} from './constants'
import { listOllamaModels } from './ollamaAdapter'

function isSettingConfigured(key: string): boolean {
	const inspected = vscode.workspace
		.getConfiguration('commitollama')
		.inspect(key)

	return (
		inspected?.globalValue !== undefined ||
		inspected?.workspaceValue !== undefined ||
		inspected?.workspaceFolderValue !== undefined
	)
}

function isModelConfigured(): boolean {
	return isSettingConfigured('model')
}

function getModelConfigTarget(): vscode.ConfigurationTarget {
	const inspected = vscode.workspace
		.getConfiguration('commitollama')
		.inspect<string>('model')

	if (
		inspected?.workspaceFolderValue !== undefined ||
		inspected?.workspaceValue !== undefined
	) {
		return vscode.ConfigurationTarget.Workspace
	}

	if (inspected?.globalValue !== undefined) {
		return vscode.ConfigurationTarget.Global
	}

	return vscode.ConfigurationTarget.Workspace
}

async function saveModel(
	model: string,
	target: vscode.ConfigurationTarget,
): Promise<void> {
	await vscode.workspace
		.getConfiguration('commitollama')
		.update('model', model, target)
}

async function pickModelStorageTarget(options?: {
	currentTarget?: vscode.ConfigurationTarget
}): Promise<vscode.ConfigurationTarget | null> {
	const currentTarget = options?.currentTarget

	const selected = await vscode.window.showQuickPick(
		[
			{
				label: 'Project settings',
				description: 'Save in .vscode/settings.json for this project',
				target: vscode.ConfigurationTarget.Workspace,
				picked:
					currentTarget === undefined ||
					currentTarget === vscode.ConfigurationTarget.Workspace,
			},
			{
				label: 'User settings',
				description: 'Save globally for all projects',
				target: vscode.ConfigurationTarget.Global,
				picked: currentTarget === vscode.ConfigurationTarget.Global,
			},
		],
		{
			title: 'Where should Commitollama save this model?',
			placeHolder: 'Choose project or user settings',
		},
	)

	return selected?.target ?? null
}

function sortModels(models: string[]): string[] {
	return [...models].sort((a, b) => {
		const aRecommended = isRecommendedModel(a)
		const bRecommended = isRecommendedModel(b)
		if (aRecommended !== bRecommended) {
			return aRecommended ? -1 : 1
		}
		return a.localeCompare(b)
	})
}

async function listAvailableModels(): Promise<string[] | null> {
	try {
		return sortModels(await listOllamaModels())
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: 'Unable to connect to Ollama. Please check that Ollama is running.'
		await vscode.window.showErrorMessage(message)
		return null
	}
}

async function showNoModelsMessage(): Promise<void> {
	const action = await vscode.window.showErrorMessage(
		formatNoModelsMessage(),
		'Open Ollama Library',
	)
	if (action === 'Open Ollama Library') {
		await vscode.env.openExternal(vscode.Uri.parse(OLLAMA_LIBRARY_URL))
	}
}

async function pickOllamaModel(options?: {
	currentModel?: string
	title?: string
}): Promise<string | null> {
	const models = await listAvailableModels()
	if (!models) {
		return null
	}

	if (models.length === 0) {
		await showNoModelsMessage()
		return null
	}

	const currentModel = options?.currentModel
	const selected = await vscode.window.showQuickPick(
		models.map((model) => {
			const isCurrent = model === currentModel
			const recommended = isRecommendedModel(model)
			return {
				label: recommended ? `$(star) ${model}` : model,
				description: isCurrent
					? 'Current model'
					: recommended
						? 'Recommended for commit messages'
						: undefined,
				model,
				picked: isCurrent,
			}
		}),
		{
			title: options?.title ?? 'Select an Ollama model for Commitollama',
			placeHolder: 'Choose a model you have already pulled',
		},
	)

	return selected?.model ?? null
}

export async function ensureModelSelected(): Promise<boolean> {
	if (isModelConfigured()) {
		return true
	}

	const model = await pickOllamaModel()
	if (!model) {
		return false
	}

	const target = await pickModelStorageTarget()
	if (!target) {
		return false
	}

	await saveModel(model, target)
	return true
}

export async function switchModel(): Promise<void> {
	const currentModel = config.inference.model
	const model = await pickOllamaModel({
		currentModel,
		title: 'Switch Commitollama model',
	})

	if (!model || model === currentModel) {
		return
	}

	const target = await pickModelStorageTarget({
		currentTarget: isModelConfigured() ? getModelConfigTarget() : undefined,
	})
	if (!target) {
		return
	}

	await saveModel(model, target)
	await vscode.window.showInformationMessage(
		`Commitollama is now using ${model}.`,
	)
}
