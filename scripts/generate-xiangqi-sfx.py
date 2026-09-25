#!/usr/bin/env python3
"""Generate Xiangqi sound effects with Veo, then cut them into app-ready WAVs.

Requires gcloud auth, ffmpeg, ffprobe, and npm. The original MP4s are kept in the
gitignored assets/games/xiangqi/audio/ directory; only the final WAVs are committed.
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "games" / "xiangqi" / "audio"
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "rcloud-507417")
REGION = "us-central1"
MODEL = "veo-3.1-fast-generate-001"
ENDPOINT = (
    f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}"
    f"/locations/{REGION}/publishers/google/models/{MODEL}"
)
TIMEOUT_SECONDS = 15 * 60

SOUNDS = (
    "xiangqi-start",
    "xiangqi-piece-select",
    "xiangqi-move",
    "xiangqi-capture",
    "xiangqi-check",
    "xiangqi-turn",
    "xiangqi-illegal",
)

VIDEOS = (
    (
        "veo-xiangqi-pieces.mp4",
        "A clean cinematic macro video of a traditional Chinese chess (xiangqi) board "
        "on a quiet wooden table. The audio is the priority: generate four distinct, "
        "dry close-miked game sound effects, with clean silence between them and no "
        "room tone. Show each action as it sounds. At about 0.3 seconds, two delicate "
        "wooden pieces are placed on the board, followed by a tiny warm two-note start "
        "chime. At about 2.1 seconds, a finger lightly taps and selects one wooden piece: "
        "one small bright click. At about 4.0 seconds, a piece slides a short distance "
        "over the board and is set down with one crisp wooden clack. At about 6.0 seconds, "
        "a capture happens: one slightly heavier double wooden clack, then the captured "
        "piece is lifted away. Keep every effect short, natural, distinct, and game-ready. "
        "Leave roughly a second of silence after each event. No music, no speech, no "
        "narration, no crowd, no wind, no background ambience, no extra impacts.",
    ),
    (
        "veo-xiangqi-tactics.mp4",
        "A clean cinematic macro video of a traditional Chinese chess (xiangqi) board "
        "on a quiet wooden table. The audio is the priority: generate three distinct, "
        "dry close-miked interface sound effects, with clean silence between them and "
        "no room tone. At about 0.4 seconds, a king is put in check: one restrained "
        "wooden tick and a brief two-note warning chime, clear but not alarming. At "
        "about 3.1 seconds, a player's turn begins: one soft, friendly high ping. At "
        "about 5.7 seconds, an illegal move is rejected: two quiet, low, muted wooden "
        "knocks in quick succession. Show each sound with a small corresponding piece "
        "or light cue on the board. Keep the sounds short, natural, separate, and "
        "game-ready. Leave over a second of silence after each event. No music, no "
        "speech, no narration, no crowd, no wind, no background ambience, no extra impacts.",
    ),
)


def access_token():
    return subprocess.check_output(
        ["gcloud", "auth", "print-access-token"], text=True
    ).strip()


def post_json(url, body, token):
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Google Cloud API returned HTTP {error.code}: {details[:3000]}"
        ) from error


def find_video(value):
    if isinstance(value, dict):
        videos = value.get("videos")
        if isinstance(videos, list) and videos:
            for video in videos:
                if isinstance(video, dict) and (
                    video.get("bytesBase64Encoded") or video.get("gcsUri")
                ):
                    return video
        for child in value.values():
            found = find_video(child)
            if found:
                return found
    elif isinstance(value, list):
        for child in value:
            found = find_video(child)
            if found:
                return found
    return None


def fetch_gcs_video(uri, output):
    result = subprocess.run(
        ["gcloud", "storage", "cp", uri, str(output)],
        cwd=ROOT,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"Could not download generated video from {uri}")


def generate_video(filename, prompt, token):
    output = SOURCE_DIR / filename
    request = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "aspectRatio": "16:9",
            "durationSeconds": 8,
            "generateAudio": True,
            "sampleCount": 1,
            "resolution": "720p",
            "personGeneration": "dont_allow",
            "negativePrompt": (
                "music, soundtrack, song, singing, speech, narration, crowd, wind, "
                "continuous ambience, reverberant room, loud effects, extra noises"
            ),
        },
    }
    print(f"Requesting {filename} from {MODEL} in project {PROJECT}…", flush=True)
    operation = post_json(f"{ENDPOINT}:predictLongRunning", request, token)
    operation_name = operation.get("name")
    if not operation_name:
        raise RuntimeError("Veo did not return an operation name: " + json.dumps(operation)[:2000])

    deadline = time.monotonic() + TIMEOUT_SECONDS
    while True:
        if time.monotonic() >= deadline:
            raise TimeoutError(f"Timed out waiting for {filename}; operation: {operation_name}")
        time.sleep(15)
        result = post_json(
            f"{ENDPOINT}:fetchPredictOperation",
            {"operationName": operation_name},
            token,
        )
        if result.get("error"):
            raise RuntimeError(f"Veo generation failed: {json.dumps(result['error'])[:2500]}")
        if result.get("done"):
            break
        print(f"  Still generating {filename}…", flush=True)

    video = find_video(result.get("response", result))
    if not video:
        raise RuntimeError("Veo completed without returning video bytes: " + json.dumps(result)[:2500])
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    if video.get("bytesBase64Encoded"):
        output.write_bytes(base64.b64decode(video["bytesBase64Encoded"]))
    elif video.get("gcsUri"):
        fetch_gcs_video(video["gcsUri"], output)
    else:
        raise RuntimeError("Veo returned an unsupported video result")
    print(f"Saved {output.relative_to(ROOT)} ({output.stat().st_size / 1_000_000:.1f} MB)", flush=True)


def inspect_video(path):
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=codec_type,codec_name,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ],
        text=True,
    )
    info = json.loads(raw)
    audio_streams = [stream for stream in info.get("streams", []) if stream.get("codec_type") == "audio"]
    if not audio_streams:
        raise RuntimeError(f"Generated video has no audio stream: {path}")
    duration = float(info.get("format", {}).get("duration", 0))
    if not 7.0 <= duration <= 9.0:
        raise RuntimeError(f"Expected an 8-second source but got {duration:.2f}s: {path}")
    print(f"  {path.name}: {duration:.2f}s, audio {audio_streams[0]}", flush=True)


def build_app_sounds():
    command = ["npm", "run", "audio", "--", *SOUNDS]
    subprocess.run(command, cwd=ROOT, check=True)
    for name in SOUNDS:
        path = ROOT / "games" / "xiangqi" / "assets" / f"{name}.wav"
        if not path.is_file() or path.stat().st_size < 1024:
            raise RuntimeError(f"App-ready sound is missing or unexpectedly small: {path}")


def main():
    global PROJECT, ENDPOINT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project",
        default=PROJECT,
        help="Google Cloud project to bill (default: GOOGLE_CLOUD_PROJECT or rcloud-507417)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Generate both videos again even when saved originals already exist",
    )
    args = parser.parse_args()
    PROJECT = args.project
    ENDPOINT = (
        f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}"
        f"/locations/{REGION}/publishers/google/models/{MODEL}"
    )

    for tool in ("gcloud", "ffmpeg", "ffprobe", "npm"):
        if subprocess.run(["which", tool], stdout=subprocess.DEVNULL, check=False).returncode != 0:
            raise RuntimeError(f"Required command not found: {tool}")
    token = None

    for filename, prompt in VIDEOS:
        source = SOURCE_DIR / filename
        if source.exists() and not args.force:
            print(f"Reusing existing source: {source.relative_to(ROOT)}", flush=True)
        else:
            if token is None:
                token = access_token()
                if not token:
                    raise RuntimeError("gcloud returned an empty access token")
            generate_video(filename, prompt, token)
        inspect_video(source)

    build_app_sounds()
    print("Built seven Xiangqi WAV effects under games/xiangqi/assets/.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError, TimeoutError) as error:
        print(f"✗ {error}", file=sys.stderr)
        sys.exit(1)
