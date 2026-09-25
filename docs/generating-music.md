# Generate music with Google Cloud Lyria

Use this workflow for original background music and short musical cues. Lyria generates music, not isolated sound effects. Generated originals belong in `assets/shared/audio/music/`, or `assets/games/<id>/audio/` for music only one game uses (both gitignored); only the app-ready files under `apps/web/public/` are committed. Older experiments that have no job yet stay in `assets/audio/music/`.

## Generate an MP3

Use a Google Cloud project with available credits. The project used for the current assets was `rcloud-507417`; replace it with the project you intend to charge. This calls the managed Agent Platform API, so no GPU VM is needed.

```bash
gcloud auth list
export GOOGLE_CLOUD_PROJECT=rcloud-507417
gcloud services enable aiplatform.googleapis.com --project="$GOOGLE_CLOUD_PROJECT"

export LYRIA_MODEL=lyria-3-clip-preview  # 30-second clips; use lyria-3-pro-preview for longer tracks (up to 184 seconds)
export OUTPUT=assets/shared/audio/music/my-new-track.mp3
export MUSIC_PROMPT='Instrumental loop for a cheerful floating-island board game; playful orchestral woodwinds, pizzicato strings and soft percussion, warm adventurous mood, no vocals, gentle ending that can loop.'

python3 - <<'PY'
import base64, json, os, subprocess, urllib.request
from pathlib import Path

project = os.environ["GOOGLE_CLOUD_PROJECT"]
model = os.environ["LYRIA_MODEL"]
prompt = os.environ["MUSIC_PROMPT"]
output = Path(os.environ["OUTPUT"])
token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
url = f"https://aiplatform.googleapis.com/v1beta1/projects/{project}/locations/global/interactions"
body = json.dumps({"model": model, "input": [{"type": "text", "text": prompt}]}).encode()
request = urllib.request.Request(url, data=body, headers={
    "Authorization": f"Bearer {token}", "Content-Type": "application/json",
})
with urllib.request.urlopen(request, timeout=600) as response:
    result = json.load(response)

def find_audio(value):
    if isinstance(value, dict):
        if value.get("type") == "audio" and isinstance(value.get("data"), str):
            return value["data"]
        for child in value.values():
            found = find_audio(child)
            if found:
                return found
    elif isinstance(value, list):
        for child in value:
            found = find_audio(child)
            if found:
                return found
    return None

audio = find_audio(result)
if not audio:
    raise RuntimeError("No audio data in response: " + json.dumps(result)[:1200])
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(base64.b64decode(audio))
print(f"Wrote {output}")
PY
```

Write a specific prompt: say whether it is instrumental, its mood/instruments/tempo, intended game moment, and whether it should loop. Generate a few candidates, listen to them, and keep only the useful one. Clip is suited to loops and cues; Pro is suited to longer themes. Lyria adds a SynthID watermark to generated audio.

## Put it in the game

1. Listen to the original and choose a short purpose-based app name.
2. Add a mapping in `assets/audio.json`; `src` is relative to `assets/` (add `"game": "<id>"` if only one game uses it):

   ```json
   "music-board-loop": { "src": "shared/audio/music/my-new-track.mp3" }
   ```

   For a short cue, set `duration` and `"format": "wav"` so playback starts without MP3 encoder padding.
3. Build the app asset with `npm run audio -- music-board-loop`. This writes `apps/web/public/shared/audio/music-board-loop.mp3` (or `.wav`; `games/<id>/assets/` for a game's own sound).
4. Check that it plays and that its length/trim is right; use `ffprobe` to inspect duration. Commit the mapping and app-ready output, not the original in `assets/`.

As of September 2026, the pricing page lists Lyria 3 Clip at $0.04 per generation and Pro at $0.08; verify before a large batch. Preview model names/prices can change.

## References

- [Lyria 3 model guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/lyria/lyria-3)
- [Generate music with the REST API](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/music/generate-music?hl=en)
- [Agent Platform pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
