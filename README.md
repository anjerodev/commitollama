# Commitollama 🦙

A Github Copilot commits generator free alternative, that run on your device using [ollama][1].

## Features

- No telemetry or tracking.
- No API key needed.
- Different models available.
- No Internet connection needed.

## Demo

![vscode-commitollama-demo][2]

## Requirements

- Install [Ollama][1] on your local machine.
- Install the model to use: `ollama pull [model_name]`, recommended to use `llama3.2`.
- Make sure ollama is running, you can do it by visiting http://127.0.0.1:11434/ in your web browser (The port number might be different for you). If not, only opening the app should be enough, or run in your terminal: `ollama serve`.

## Configuration

- Model: You can select the model from the plugin configuration.

  `Llama` - default (Uses llama3.2:latest)

  `Codegemma` (Uses codegemma:latest)

  `Codellama` (Uses codellama. Worst result obtained)

  `Mistral` (Uses mistral:latest)

  `Custom` - It allow you to write down any other model name from ollama.

- Use Description: It allow you to enable or disable the use of commit description.

- Use Emojis: It allow you to enable or disable the use of emojis in commit messages.

- Custom Emojis: It allow you to write down the emojis you want to use in the next template object in the VSCode config.json.

  ```json
   "commitollama.commitEmojis": {
    "feat": "✨",
    "fix": "🐛",
    "docs": "📝",
    "style": "💎",
    "refactor": "♻️",
    "test": "🧪",
    "chore": "📦",
    "revert": "⏪"
  }
  ```

- Custom Endpoint: Ollama usually uses port 11434. It is the value that will be used if empty.

- Custom Summary Prompt: The prompt that will be used to generate the summary of all git diff.

- Custom Commit Prompt: The prompt that will be used to generate the commit message.

- Custom Summary Temperature: The temperature that will be used to generate the summary of all git diff.

- Custom Commit Temperature: The temperature that will be used to generate the commit message.

## Known Issues

Sometimes can generate quite long commits, but it give you an idea of what the commit should be and can be edited manually to achieve the correct length.

## Release Notes

### 1.7.0

- Added support for commit description.
- Now if a model is not installed, you will have the option to pull it from the notification.

### 1.4.0 to 1.6.0

- Fixes and refactoring.

### 1.3.0

- Added support for emojis.

### 1.2.0

- Added support for custom prompts and llm temperature.

### 1.0.0

- Initial release of commitollama.

[1]: https://ollama.ai/
[2]: https://raw.githubusercontent.com/jepricreations/commitollama/main/commitollama-demo.gif
