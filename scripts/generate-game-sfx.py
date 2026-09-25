#!/usr/bin/env python3
"""Generate isolated, game-specific SFX takes as Veo videos with synchronized audio."""

import argparse
import base64
import concurrent.futures
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT_DEFAULT = "rcloud-507417"
REGION = "us-central1"
MODELS = {
    "standard": "veo-3.1-generate-001",
    "fast": "veo-3.1-fast-generate-001",
    "lite": "veo-3.1-lite-generate-001",
}
BASE_URL = f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{{project}}/locations/{REGION}/publishers/google/models/{{model}}"
SAMPLE_COUNT = 4
AUTH_TOKEN = ""


def cue(name, owner, setting, action):
    prompt = (
        "Create an 8-second 16:9 polished 3D-cartoon game-art video. "
        f"Scene: {setting}. Show exactly one simple action: {action}. "
        "Audio is the priority. The complete 8-second soundtrack must be digital silence "
        "from 0 to 0.8 seconds, one short close-miked sound effect around 1 second, "
        "then digital silence from 2.2 to 8 seconds. The effect happens once and lasts less "
        "than 1.2 seconds, with only a quick natural decay. Do not sustain, repeat, echo, "
        "or add any sound underneath the effect. "
        "No music, no speech, no singing, no narration, no crowd, no wind, no room tone, "
        "no ambience, and no extra sound effects. Hold the final image still and silent."
    )
    return {"name": name, "owner": owner, "prompt": prompt}


SHARED_SCENE = "the cheerful floating-island game hub, with soft sky light, colorful wooden islands, and rounded toy-like details"
CARO_SCENE = "a small wooden three-by-three Vietnamese Caro board, with glossy red X and blue O pieces"
XIANGQI_SCENE = "a Chinese chess board on a floating garden island, with round red and black wooden pieces and a bonsai"
TIEN_LEN_SCENE = "a Vietnamese Tiến Lên card table on a floating island, with green felt, a neat deck, and warm lantern light"
LUDO_SCENE = "a colorful Cờ Cá Ngựa race board on a floating island, with red, blue, green, and yellow horse tokens and a white die"


CUES = [
    cue("button-click", "shared", SHARED_SCENE, "a fingertip presses one small polished wooden game button, making a crisp, friendly UI click"),
    cue("button-hover", "shared", SHARED_SCENE, "a fingertip makes one tiny, dry glass tick on a game button; one short high 'tik' with no ring"),
    cue("island-hover", "shared", SHARED_SCENE, "a tiny orb beside the island flashes once with one very short, dry, high interface tick and no ringing tail"),
    cue("island-click", "shared", SHARED_SCENE, "one floating island is selected, making a warm wooden pop with a soft bright click"),
    cue("island-locked", "shared", SHARED_SCENE, "a gold lock gently wobbles once, making a short muted springy wooden boing"),
    cue("cloud-spread", "shared", SHARED_SCENE, "two fluffy clouds part once with a very brief, dry airy swish under one second; no wind"),
    cue("game-win", "shared", SHARED_SCENE, "a small golden trophy lights up with a bright three-note mallet chime, all notes finish in under 1.2 seconds"),
    cue("game-lose", "shared", SHARED_SCENE, "a small wooden game token settles with two gentle descending bell notes, finished in under 1.2 seconds"),
    cue("mark-drop", "tic-tac-toe", CARO_SCENE, "a glossy red X piece drops into one wooden square with a crisp, satisfying clack"),
    cue("caro-select", "tic-tac-toe", CARO_SCENE, "a blue O piece is lightly selected with one delicate rounded plastic tap"),
    cue("caro-o-place", "tic-tac-toe", CARO_SCENE, "a glossy blue O piece lands in one wooden square with a soft, hollow clack"),
    cue("caro-line-complete", "tic-tac-toe", CARO_SCENE, "a completed row glows once with a quick, cheerful three-note sparkle chime"),
    cue("caro-start", "tic-tac-toe", CARO_SCENE, "a new round begins with one tiny warm wooden tap followed by a friendly bright chime"),
    cue("caro-win", "tic-tac-toe", CARO_SCENE, "the winning red X row lights up with a short upbeat three-note game fanfare"),
    cue("caro-draw", "tic-tac-toe", CARO_SCENE, "the full board resolves in a gentle, neutral two-note chime"),
    cue("caro-invalid", "tic-tac-toe", CARO_SCENE, "a piece gently bounces off an occupied square with one soft muted wooden double knock"),
    cue("xiangqi-start", "xiangqi", XIANGQI_SCENE, "the starting board is revealed with one calm wooden tick and a restrained welcoming bell"),
    cue("xiangqi-piece-select", "xiangqi", XIANGQI_SCENE, "a fingertip selects one round wooden chess piece with a light dry tap"),
    cue("xiangqi-move", "xiangqi", XIANGQI_SCENE, "one wooden chess piece slides a short distance and lands with a precise dry click"),
    cue("xiangqi-capture", "xiangqi", XIANGQI_SCENE, "one round wooden piece captures another with a clean, weighty double clack"),
    cue("xiangqi-check", "xiangqi", XIANGQI_SCENE, "the general is put in check with one dry wood tick followed by a restrained two-note warning chime"),
    cue("xiangqi-turn", "xiangqi", XIANGQI_SCENE, "the player's turn begins with one soft, high wooden bell ping"),
    cue("xiangqi-illegal", "xiangqi", XIANGQI_SCENE, "an invalid move is rejected with two quiet, low, muted wooden knocks"),
    cue("xiangqi-checkmate", "xiangqi", XIANGQI_SCENE, "the match reaches checkmate with a short, clear, serious but gentle two-note chime"),
    cue("xiangqi-capture-heavy", "xiangqi", XIANGQI_SCENE, "a powerful piece capture lands with one especially weighty wooden clack"),
    cue("xiangqi-decisive-move", "xiangqi", XIANGQI_SCENE, "a decisive winning move resolves with a small, restrained bell flourish"),
    cue("xiangqi-draw", "xiangqi", XIANGQI_SCENE, "a drawn match resolves with a balanced, neutral two-note chime"),
    cue("xiangqi-game-win", "xiangqi", XIANGQI_SCENE, "the red side wins a careful match with a calm, short victory flourish"),
    cue("tien-len-deal", "tien-len", TIEN_LEN_SCENE, "four playing cards are dealt quickly onto felt in one compact sequence of crisp paper flicks"),
    cue("tien-len-card-select", "tien-len", TIEN_LEN_SCENE, "one playing card is lifted from the hand with a light dry paper scrape and tap"),
    cue("tien-len-card-play", "tien-len", TIEN_LEN_SCENE, "one playing card is played face-up with a firm papery slap on felt"),
    cue("tien-len-pass", "tien-len", TIEN_LEN_SCENE, "two quiet knuckle taps land on the wooden edge beside the felt"),
    cue("tien-len-turn", "tien-len", TIEN_LEN_SCENE, "a player's turn begins with one short, bright wooden ping"),
    cue("tien-len-last-card", "tien-len", TIEN_LEN_SCENE, "one card turns face-up on the felt with a single light alert chime and card tap"),
    cue("tien-len-combo", "tien-len", TIEN_LEN_SCENE, "a neat five-card straight lands in one quick ripple of paper taps"),
    cue("tien-len-special-cut", "tien-len", TIEN_LEN_SCENE, "a stronger special combination cuts the play with one confident, heavier card slap"),
    cue("tien-len-special-hand", "tien-len", TIEN_LEN_SCENE, "a special hand is revealed with a tidy, resonant double paper slap"),
    cue("tien-len-trick-clear", "tien-len", TIEN_LEN_SCENE, "the played cards sweep off the center of the felt with one quick, soft papery swish"),
    cue("tien-len-bomb", "tien-len", TIEN_LEN_SCENE, "four matching cards are played as a bomb with one low, weighty but friendly double slap"),
    cue("tien-len-win", "tien-len", TIEN_LEN_SCENE, "the round winner is celebrated by a compact, joyful instrumental fanfare"),
    cue("ludo-dice-roll", "co-ca-ngua", LUDO_SCENE, "one wooden die rattles and rolls once across the board, then settles naturally"),
    cue("ludo-dice-six", "co-ca-ngua", LUDO_SCENE, "the die stops showing six with one bright, short result chime"),
    cue("ludo-token-leave", "co-ca-ngua", LUDO_SCENE, "one colored horse leaves its stable with a small wooden click and light lift"),
    cue("ludo-token-select", "co-ca-ngua", LUDO_SCENE, "a horse token is selected with one light, rounded plastic tap"),
    cue("ludo-token-step", "co-ca-ngua", LUDO_SCENE, "one little horse token takes one space with a quick hollow wooden step"),
    cue("ludo-token-safe", "co-ca-ngua", LUDO_SCENE, "a horse reaches a protected safe tile with one small warm confirmation ping"),
    cue("ludo-token-bump", "co-ca-ngua", LUDO_SCENE, "one horse gently bumps an opponent token with a playful clack and quick bounce"),
    cue("ludo-token-return", "co-ca-ngua", LUDO_SCENE, "a bumped token rolls back to its colored stable with soft wooden taps"),
    cue("ludo-token-finish", "co-ca-ngua", LUDO_SCENE, "a horse reaches its home slot with a warm solid wooden click and tiny sparkle"),
    cue("ludo-turn", "co-ca-ngua", LUDO_SCENE, "the turn passes to the next color with one short, friendly wooden ping"),
    cue("ludo-game-start", "co-ca-ngua", LUDO_SCENE, "a new race begins with one gentle die rattle and an upbeat wooden tick"),
    cue("ludo-win", "co-ca-ngua", LUDO_SCENE, "the winning horse reaches home with a brief, bright instrumental fanfare"),
    cue("ludo-pawn-jump", "co-ca-ngua", LUDO_SCENE, "one horse token makes a playful short jump and lands with a round wooden clack"),
    cue("ludo-final-lap", "co-ca-ngua", LUDO_SCENE, "a horse enters the final home stretch with a short rising two-note cue"),
    cue("ludo-tie", "co-ca-ngua", LUDO_SCENE, "two horses reach the finish together with a light, balanced two-note result chime"),
    cue("ludo-no-move", "co-ca-ngua", LUDO_SCENE, "a die result leaves every horse in place, followed by one soft, neutral wooden tick"),
]


def access_token():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def find_videos(value):
    if isinstance(value, dict):
        videos = value.get("videos")
        if isinstance(videos, list):
            return [video for video in videos if isinstance(video, dict)]
        for child in value.values():
            found = find_videos(child)
            if found:
                return found
    elif isinstance(value, list):
        for child in value:
            found = find_videos(child)
            if found:
                return found
    return []


def post_json(url, body, token):
    global AUTH_TOKEN
    for attempt in range(6):
        request = urllib.request.Request(
            url,
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {AUTH_TOKEN or token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            if error.code == 401 and attempt < 5:
                AUTH_TOKEN = access_token()
                continue
            if error.code in (429, 500, 502, 503, 504) and attempt < 5:
                time.sleep(min(60, 3 * (2**attempt)))
                continue
            raise RuntimeError(f"Google API HTTP {error.code}: {details[:1800]}") from error
    raise RuntimeError("Google API retry limit exceeded")


def output_dir(owner):
    root = "shared" if owner == "shared" else f"games/{owner}"
    return ROOT / "assets" / root / "audio/sfx-candidates"


def run_cue(item, project, token, force, model_key, target_count):
    dest_dir = output_dir(item["owner"])
    model_prefix = {"standard": "", "fast": "fast-", "lite": "lite-"}[model_key]
    prefix = f"{model_prefix}{item['name']}-candidate-"
    existing = sorted(dest_dir.glob(f"{prefix}*.mp4"))
    if force:
        for output in existing:
            output.unlink()
        existing = []
    remaining = target_count - len(existing)
    if remaining <= 0:
        return f"Reuse {item['name']} ({target_count} candidates)"

    base = BASE_URL.format(project=project, model=MODELS[model_key])
    dest_dir.mkdir(parents=True, exist_ok=True)
    outputs = []
    for index in range(len(existing) + 1, target_count + 1):
        body = {
            "instances": [{"prompt": item["prompt"]}],
            "parameters": {
                "aspectRatio": "16:9",
                "durationSeconds": 8,
                "generateAudio": True,
                "sampleCount": 1,
                "resolution": "720p",
                "personGeneration": "dont_allow",
                "negativePrompt": "music, soundtrack, lyrics, singing, speech, narration, crowd, wind, ambience, extra impacts, explosions",
            },
        }
        operation = post_json(f"{base}:predictLongRunning", body, token)
        operation_name = operation.get("name")
        if not operation_name:
            raise RuntimeError(f"{item['name']}: Veo returned no operation name: {json.dumps(operation)[:1200]}")

        deadline = time.monotonic() + 25 * 60
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError(f"{item['name']}: timed out waiting for {operation_name}")
            time.sleep(10)
            result = post_json(f"{base}:fetchPredictOperation", {"operationName": operation_name}, token)
            if result.get("error"):
                raise RuntimeError(f"{item['name']}: Veo failed: {json.dumps(result['error'])[:1500]}")
            if result.get("done"):
                break

        videos = find_videos(result.get("response", result))
        if not videos:
            raise RuntimeError(f"{item['name']}: Veo returned no video candidate")
        video = videos[0]
        output = dest_dir / f"{prefix}{index:02d}.mp4"
        data = video.get("bytesBase64Encoded")
        if data:
            output.write_bytes(base64.b64decode(data))
        elif video.get("gcsUri"):
            copied = subprocess.run(["gcloud", "storage", "cp", video["gcsUri"], str(output)], check=False)
            if copied.returncode:
                raise RuntimeError(f"{item['name']}: could not download {video['gcsUri']}")
        else:
            raise RuntimeError(f"{item['name']}: candidate {index} had no MP4 data")
        outputs.append(f"{output.name} {output.stat().st_size / 1_000_000:.1f}MB")
    return f"Saved {item['name']}: " + ", ".join(outputs)


def run_cue_with_retry(item, project, token, force, model_key, target_count):
    for attempt in range(5):
        try:
            return run_cue(item, project, token, force and attempt == 0, model_key, target_count)
        except RuntimeError as error:
            message = str(error).lower()
            retryable = any(
                part in message
                for part in (
                    "currently experiencing high load",
                    "service is currently unavailable",
                    "partial candidate batch saved",
                    "veo returned no video candidate",
                )
            )
            if not retryable or attempt == 4:
                raise
            delay = min(120, 15 * (attempt + 1))
            print(f"↻ {item['name']}: retrying in {delay}s ({message[:100]})", flush=True)
            time.sleep(delay)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", PROJECT_DEFAULT))
    parser.add_argument("--jobs", type=int, default=2, help="Parallel Veo operations (default: 2)")
    parser.add_argument("--model", choices=MODELS, default="standard", help="standard, fast, or lite Veo 3.1")
    parser.add_argument("--candidates", type=int, default=SAMPLE_COUNT, help="Candidate takes per cue (1–4)")
    parser.add_argument("--force", action="store_true", help="Regenerate existing candidates")
    parser.add_argument("--only", help="Comma-separated sound IDs to generate")
    args = parser.parse_args()
    if not 1 <= args.jobs <= 6:
        parser.error("--jobs must be between 1 and 6")
    if not 1 <= args.candidates <= SAMPLE_COUNT:
        parser.error(f"--candidates must be between 1 and {SAMPLE_COUNT}")
    cues = CUES
    if args.only:
        wanted = set(args.only.split(","))
        cues = [item for item in CUES if item["name"] in wanted]
        missing = wanted - {item["name"] for item in cues}
        if missing:
            parser.error(f"unknown sound id(s): {', '.join(sorted(missing))}")

    token = access_token()
    global AUTH_TOKEN
    AUTH_TOKEN = token
    errors = []
    print(
        f"Requesting {len(cues)} isolated SFX × up to {args.candidates} "
        f"Veo 3.1 {args.model} 720p videos "
        f"in project {args.project} (up to {args.jobs} concurrent)…",
        flush=True,
    )
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as executor:
        futures = {
            executor.submit(run_cue_with_retry, item, args.project, token, args.force, args.model, args.candidates): item["name"]
            for item in cues
        }
        for future in concurrent.futures.as_completed(futures):
            name = futures[future]
            try:
                print(f"✓ {future.result()}", flush=True)
            except Exception as error:
                errors.append((name, str(error)))
                print(f"✗ {name}: {error}", file=sys.stderr, flush=True)
    if errors:
        print(f"{len(errors)} cue(s) failed; rerun to retry missing cues.", file=sys.stderr)
        sys.exit(1)
    print(f"Completed up to {len(cues) * args.candidates} source videos.", flush=True)


if __name__ == "__main__":
    main()
