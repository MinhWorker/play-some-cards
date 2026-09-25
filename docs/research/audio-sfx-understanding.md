# Describing non-speech sound effects

_Research checked 2026-09-25._

## Recommendation

An audio language model can describe a sound effect's timbre, rhythm, pitch movement, dynamics, and mood. This Codex session has no audio-input tool enabled, so I cannot hear a local MP3 from its path alone. The available tool list contains no audio captioning or audio understanding tool.

For this MP3, the most direct service route is the **Gemini API audio understanding** endpoint. Its official example passes a local `.mp3` with the prompt “Describe this audio clip”; the same guide explicitly says Gemini understands non-speech sounds. A short local script or MCP tool can pass the path's bytes to the API and return the description. This sends the audio to Google; files uploaded via the Gemini Files API are stored temporarily for 48 hours. For small files, Gemini also documents inline audio data, avoiding the separate Files API upload while still sending the audio to the cloud. [Audio understanding](https://ai.google.dev/gemini-api/docs/audio), [Files API](https://ai.google.dev/gemini-api/docs/files).

## Options

| Option | What it provides | Practical limits |
| --- | --- | --- |
| **Gemini API** | Best documented match for this file: supports MP3 and non-speech sound understanding, and accepts a direct “Describe this audio clip” instruction. | Requires a Google AI API key and a small script/tool for a local file; audio is sent to Google. The Files API stores uploads for 48 hours. [Docs](https://ai.google.dev/gemini-api/docs/audio) |
| **OpenAI `gpt-audio-1.5` API** | Audio input with a natural language question; OpenAI's example asks “What is in this recording?” and sends audio to Chat Completions. | Requires an OpenAI API key and a script/tool. The published input example uses WAV, so Gemini's MP3 path is more directly documented for this asset. [Audio input guide](https://developers.openai.com/api/docs/guides/audio-chat-completions), [model page](https://developers.openai.com/api/docs/models/gpt-audio) |
| **Qwen2-Audio-7B-Instruct locally** | Open model option when keeping the audio on the machine matters. Its official repository demonstrates an audio-analysis prompt, “What's that sound?”, and says clips under 30 seconds work best. | More setup: the documented path uses Python, Transformers, and a 7B model. Local inference avoids uploading the clip to a model provider. [Official repository](https://github.com/QwenLM/Qwen2-Audio) |

Speech-to-text tools such as transcription APIs are the wrong category: their output is a transcript, while a sound effect may contain no words. Gemini's audio guide explicitly covers non-speech input. [OpenAI transcription API](https://platform.openai.com/docs/api-reference/audio/transcriptions), [Gemini audio guide](https://ai.google.dev/gemini-api/docs/audio).

## How this could work from Codex

There is no ready-to-call audio tool in this session. A Codex plugin can include an MCP server that exposes tools to the model; a small local MCP server could accept an audio path, call Gemini or OpenAI's audio model, and return its text description. A skill alone would only provide instructions and would not give the model access to audio. [OpenAI plugin architecture](https://developers.openai.com/plugins/concepts/plugins), [skills and MCP](https://developers.openai.com/plugins/concepts/skills).

For cautious descriptions, prompt the model to separate audible details from guesses—for example: “Describe the sounds, rhythm, pitch movement, and mood. Say which instruments or sources are uncertain.” Audio descriptions are model interpretations, so claims about the exact instrument or source should be treated as guesses unless clearly audible.
