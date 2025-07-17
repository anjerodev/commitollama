# Commitollama 🦙

A free alternative to Github Copilot's commit generator that runs on your device using [ollama][1].

## Features

- No telemetry or tracking.
- No API key needed.
- Different models available.
- No Internet connection needed.

## Demo

![vscode-commitollama-demo][2]

## Requirements

- Install [Ollama][1] on your local machine.
- Install the model to use: `ollama pull [model_name]`, recommended to use `llama3.2` or `gemma3`.
- Make sure ollama is running, you can do it by visiting http://127.0.0.1:11434/ in your web browser (The port number might be different for you). If not, only opening the app should be enough, or run in your terminal: `ollama serve`.

## Configuration

- Model: You can select the model from the plugin configuration.

  `Llama` - default (Uses llama3.2:latest) (slow)

  `Codegemma` (Uses codegemma:latest)

  `Codellama` (Uses codellama. Worst result obtained)

  `Mistral` (Uses mistral:latest)

  `Gemma` (Uses gemma3:latest) (fast)

  `Qwen` (Uses qwen3:latest)

  `Custom` - It allows you to write down any other model name from ollama.

- Use Emojis: It allows you to enable or disable the use of emojis in commit messages.

- Use Description: It allows you to enable or disable the use of commit descriptions.

- Use Lowercase: Enables or disables the use of lowercase at the beginning of commit messages.

- Language: Language for commit messages.

- Prompt Temperature: Custom temperature for generating the commit message. (Higher number = more creative)

- Commit Template: It allows you to write down the commit template you want to use. You should use the following placeholders: 
  - `{{type}}`: It will be replaced by the type of the commit.
  - `{{emoji}}`: It will be replaced by the emoji selected in the configuration.
  - `{{message}}`: It will be replaced by the commit message.

Default value: `{{type}} {{emoji}}: {{message}}`

- Custom Model: Allows you to specify any model. The model has to be downloaded and available on your Ollama instance. **Note:** Ignored if `commitollama.model` is not set to "Custom".

- Custom Language: Allows you to specify any language for the commit messages. **Note:** Ignored if `commitollama.language` is not set to "Custom".

- Custom Emojis: Allows you to specify the emojis you want to use in the next template object within the VSCode config.json.

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

- Custom Prompt: The prompt that will be used to generate the commit message instead of the default one. If this field is populated, it will override all the extension prompts and rules.

- Custom Type Rules: Custom rules for commit message types.

- Custom Commit Message Rules: Custom rules for commit messages.

- Custom Description Prompt: A custom prompt to generate the commit description.

- Request Headers: Custom headers that will be sent with each request to the Ollama server. This is useful for authentication or other purposes.

## Known Issues

Sometimes, depending on the model used, it can generate quite long commit messages. However, it provides a good starting point for what the commit should be and can be manually edited to achieve the desired length.

[1]: https://ollama.ai/
[2]: https://raw.githubusercontent.com/jepricreations/commitollama/main/commitollama-demo.gif
