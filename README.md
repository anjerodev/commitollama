# Commitollama 🦙

A Github Copilot commits generator free alternative, that run on your device using [ollama](https://ollama.ai/).

## Features

- No telemetry or tracking.
- No API key needed.
- Different models available.
- No Internet connection needed.

## Requirements

- Install [Ollama](https://ollama.ai) on your local machine.
- Install the model to use: `ollama pull [model_name]`, recommended to use `mistral` or `codellama`. It works better with `mistral`.
- Make sure ollama is running. Only opening the app should be enough, if not, run in your terminal: `ollama run [model_name]` or `ollama serve`.

## Configuration

- Endpoint: Ollama usually uses port 11434. It is the value that will be used if empty.

- You can select the model from the plugin configuration.

  `mistral` - default

  `codellama`

  `custom` - It allow you to write down the model name that you have set on ollama.

## Known Issues

Sometimes can generate quite long commits, but it give you an idea of what the commit should be and can be edited manually to achieve the correct length.

## Release Notes

### 1.0.0

Initial release of commitollama
