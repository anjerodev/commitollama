import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { defineConfig } from "@vscode/test-cli";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	files: "out/test/**/*.test.js",
	extensionDevelopmentPath: __dirname,
	workspaceFolder: `${__dirname}/sampleWorkspace`,
});