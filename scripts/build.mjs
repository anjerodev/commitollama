import * as esbuild from 'esbuild'
import { readdir, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const extensionEntry = 'src/extension.ts'
const extensionOutput = 'out/extension.js'
const testDir = 'src/test'

const testExternals = ['vscode', 'sinon', 'assert', 'node:assert']

const sharedOptions = {
	bundle: true,
	platform: 'node',
	format: 'cjs',
	sourcemap: true,
	target: 'es2021',
	logLevel: 'info',
}

async function getTestEntries() {
	const files = await readdir(testDir)
	return files
		.filter((file) => file.endsWith('.test.ts'))
		.map((file) => join(testDir, file))
}

async function build() {
	await mkdir(dirname(extensionOutput), { recursive: true })
	await mkdir('out/test', { recursive: true })

	const testEntries = await getTestEntries()

	await esbuild.build({
		...sharedOptions,
		entryPoints: [extensionEntry],
		outfile: extensionOutput,
		external: ['vscode'],
	})

	if (testEntries.length > 0) {
		await esbuild.build({
			...sharedOptions,
			entryPoints: testEntries,
			outdir: 'out/test',
			outbase: testDir,
			external: testExternals,
		})
	}
}

const watch = process.argv.includes('--watch')

if (watch) {
	const testEntries = await getTestEntries()
	const extensionCtx = await esbuild.context({
		...sharedOptions,
		entryPoints: [extensionEntry],
		outfile: extensionOutput,
		external: ['vscode'],
	})
	const testCtx = await esbuild.context({
		...sharedOptions,
		entryPoints: testEntries,
		outdir: 'out/test',
		outbase: testDir,
		external: testExternals,
	})
	await extensionCtx.watch()
	await testCtx.watch()
	console.log('Watching...')
} else {
	build().catch((error) => {
		console.error(error)
		process.exit(1)
	})
}
