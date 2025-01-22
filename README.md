# Commitollama 🦙

A GitHub Copilot commit message generator alternative, available for use directly on your device via [Ollama][1].

## Features

- No telemetry or tracking.
- No API key needed.
- Different models available.
- No Internet connection needed.

## Demo

![vscode-commitollama-demo][2]

## Requirements

- Install [Ollama][1] on your local machine.
- Choose and install a model to use with Commitollama. We recommend using `llama3.2`. You can do this by running `ollama pull [model_name]`.
- Ensure Ollama is running by visiting <http://127.0.0.1:11434> in your web browser (note that the port number may vary, depending on your Ollama configuration). You can start Ollama by running `ollama serve` in your terminal.

## Configuration

- **Model:**

  Specify the desired model by tweaking the `commitollama.model` setting. Available options are:

  `"Llama"` - [*default*] (Uses [`llama3.2:latest`][3])

  `"Codegemma"` (Uses [`codegemma:latest`][4])

  `"Codellama"` (Uses [`codellama`][5]. Worst result obtained)

  `"Mistral"` (Uses [mistral:latest][6])

  `"Custom"` - Allows you to specify any model name from the [models available for Ollama][7].

- **Use Description:**

  *Default: `false`*
  
  Allows you to enable or disable the use of commit descriptions.

- **Use Emojis:**
  
  *Default: `false`*

  Allows you to enable or disable the use of emojis in commit messages.

- **Custom Emojis:**
  
  Tweak your preferred emojis to be used, if "Use Emojis" is enabled. Configurable through the
  `commitollama.commitEmojis` setting in the VSCode `settings.json`:

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

- **Custom Endpoint:**

  *Default: `11434`*

  Specify the port to your running Ollama instance. Default value will be used if not specified.

- **Custom Summary Prompt:**
  
  The prompt that will be used to generate the summary of all git diffs. A default value will be used
  if not specified.

- **Custom Commit Prompt:**
  
  The prompt that will be used to generate the commit message. A default value will be used
  if not specified.

- **Custom Summary Temperature:**

  *Default: `0.8`*
  
  The [temperature][8] that will be used to generate the summary of all git diffs.

- **Custom Commit Temperature:**
  
  *Default: `0.2`*

  The [temperature][8] that will be used to generate the commit message.

## Known Issues

Occasionally, the generated commit message will be quite lengthy. However, these longer commit messages
can give you an idea of what the commit message should be and can still be edited manually to achieve
the correct length.

## Release Notes

### 1.7.0

- Added support for commit description.
- Now if a model is not installed, you will have the option to pull it from the notification.

### 1.4.0 to 1.6.0

- Fixes and refactoring.

### 1.3.0

- Added support for emojis.

### 1.2.0

- Added support for custom prompts and LLM temperature.

### 1.0.0

- Initial release of commitollama.

[1]: https://ollama.ai/
[2]: https://raw.githubusercontent.com/jepricreations/commitollama/main/commitollama-demo.gif
[3]: https://ollama.com/library/llama3.2
[4]: https://ollama.com/library/codegemma
[5]: https://ollama.com/library/codellama
[6]: https://ollama.com/library/mistral
[7]: https://ollama.com/search
[8]: https://github.com/ollama/ollama/blob/main/docs/modelfile.md#:~:text=repeat_penalty%201.1-,temperature,-The%20temperature%20of
