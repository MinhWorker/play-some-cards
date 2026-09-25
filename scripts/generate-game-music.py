#!/usr/bin/env python3
"""Create image-guided Lyria music variants for the hub and each island game."""

import argparse
import base64
import concurrent.futures
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT_DEFAULT = "rcloud-507417"
MODEL = "lyria-3-clip-preview"
URL = "https://aiplatform.googleapis.com/v1beta1/projects/{project}/locations/global/interactions"


def track(name, owner, image, mood):
    game = {
        "shared": "the whole cheerful floating-island board-game hub",
        "tic-tac-toe": "the bright Caro 3×3 island with chunky red X and blue O pieces",
        "tien-len": "the green-felt Tiến Lên card island with a red lantern and oversized cards",
        "co-ca-ngua": "the colorful Cờ Cá Ngựa race island with four painted paths, a big die, and little horse tokens",
        "xiangqi": "the quiet Cờ Tướng island with round red and black wooden pieces, a bonsai, and a stone lantern",
    }[owner]
    prompt = (
        f"Use the reference image as the visual mood for {game}. Create a 30-second, "
        f"fully instrumental background music loop for a polished, cheerful Vietnamese "
        f"casual mobile board-game hub. {mood} Keep the melody memorable but unobtrusive, "
        "with a clear pulse and a gentle ending that can return to the opening. No vocals, "
        "lyrics, spoken words, sound effects, or recognizable borrowed melody."
    )
    return {"name": name, "owner": owner, "image": image, "prompt": prompt}


TRACKS = [
    track("music-sky-a", "shared", "sky.webp", "Soft open-sky ambience, warm pads, delicate piano, and a few airy flute notes; slow and spacious for login and room-list screens."),
    track("music-sky-b", "shared", "sky.webp", "A calm morning above the clouds with gentle kalimba, soft strings, and a light bell motif; reassuring, unhurried, and low in intensity."),
    track("music-hub-a", "shared", "sky.webp", "An inviting adventure theme with pizzicato strings, bright woodwinds, hand percussion, and little bell accents; buoyant and welcoming at about 100 BPM."),
    track("music-hub-b", "shared", "sky.webp", "A sunny orchestral journey with plucked strings, bamboo flute, marimba, and warm bass; playful discovery across floating islands at about 106 BPM."),
    track("music-hub-c", "shared", "sky.webp", "A gentle Vietnamese folk-inspired game theme using đàn tranh-like plucks, wooden percussion, and airy flute over a friendly orchestral bed; colorful and light."),
    track("music-hub-d", "shared", "sky.webp", "A relaxed evening in a floating-island village with soft guitar, rounded mallets, gentle strings, and a simple hopeful melody; no dramatic build."),
    track("music-caro-a", "tic-tac-toe", "island.webp", "Bright, simple puzzle music with marimba, pizzicato strings, and soft hand taps; small playful melodic phrases, about 92 BPM."),
    track("music-caro-b", "tic-tac-toe", "island.webp", "A clever and bouncy strategy-board tune with plucked strings, toy-piano notes, and light bass; cheerful, focused, and easy to play beneath conversation."),
    track("music-caro-c", "tic-tac-toe", "island.webp", "A cozy wood-and-candy puzzle theme: warm piano, tiny bells, and gentle pizzicato; very light percussion and a tidy repeating motif."),
    track("music-caro-d", "tic-tac-toe", "island.webp", "A lively but soft three-in-a-row board-game theme with bright mallets, rounded bass, and a few short string flourishes; upbeat without sounding competitive."),
    track("music-tien-len-a", "tien-len", "island.webp", "A lively Vietnamese card-table theme with đàn tranh-inspired plucks, pizzicato strings, and crisp but quiet wooden percussion; social, nimble, about 112 BPM."),
    track("music-tien-len-b", "tien-len", "island.webp", "A friendly card-night groove with plucked strings, bamboo flute, muted hand drum, and warm bass; playful turns and a catchy instrumental hook."),
    track("music-tien-len-c", "tien-len", "island.webp", "A breezy lantern-lit card game theme with bright zithery plucks, light shakers, and short melodic replies; celebratory but never loud."),
    track("music-tien-len-d", "tien-len", "island.webp", "A focused late-round card-game loop: syncopated low plucks, restrained wooden percussion, and a rising but friendly string motif; tension without menace."),
    track("music-tien-len-e", "tien-len", "island.webp", "A relaxed alternate card-table loop with acoustic guitar, warm strings, and subtle Vietnamese folk color; keep the rhythm gently moving and the arrangement sparse."),
    track("music-tien-len-f", "tien-len", "island.webp", "A more energetic table-party instrumental with quick pizzicato, bright bamboo flute, and hand percussion; a light festive feel, no vocals."),
    track("music-co-ca-ngua-a", "co-ca-ngua", "island.webp", "A joyful race-board theme with galloping pizzicato strings, marimba, small brass accents, and soft hand drums; bouncy, colorful, about 116 BPM."),
    track("music-co-ca-ngua-b", "co-ca-ngua", "island.webp", "A playful horse-racing board-game loop with bright mallets, plucked strings, and a quick skipping rhythm; cheerful and family-friendly."),
    track("music-co-ca-ngua-c", "co-ca-ngua", "island.webp", "A warm Vietnamese festival-inspired race theme with đàn tranh-like plucks, bamboo flute, and buoyant wooden percussion; lively without vocals."),
    track("music-co-ca-ngua-d", "co-ca-ngua", "island.webp", "A suspenseful final lap for a colorful race board: quicker light percussion, climbing marimba notes, and playful strings; exciting but still gentle."),
    track("music-co-ca-ngua-e", "co-ca-ngua", "island.webp", "A softer afternoon game on a floating island with toy piano, acoustic plucks, and a lilting melody; relaxed, bright, and easy to loop."),
    track("music-co-ca-ngua-f", "co-ca-ngua", "island.webp", "An adventurous route around a four-color race board with hand drums, lively strings, and short brass calls; steady pulse, optimistic finish."),
    track("music-xiangqi-a", "xiangqi", "island.webp", "A calm Chinese chamber-inspired board-game theme with guzheng and pipa-like plucks, soft bamboo flute, and restrained wooden percussion; thoughtful, about 74 BPM."),
    track("music-xiangqi-b", "xiangqi", "island.webp", "A quiet strategy loop for a garden chess island: delicate plucked strings, warm low notes, and sparse bell tones; composed and patient, never ominous."),
    track("music-xiangqi-c", "xiangqi", "island.webp", "A focused endgame instrumental with measured wooden percussion, low string pulses, and a precise plucked melody; subtle tension without a dramatic trailer sound."),
    track("music-xiangqi-d", "xiangqi", "island.webp", "A serene morning garden melody for Chinese chess with guzheng-like strings, airy flute, and soft mallets; graceful, restrained, and warm."),
    track("music-xiangqi-e", "xiangqi", "island.webp", "A friendly casual strategy-game theme blending light Chinese traditional plucks with rounded orchestral strings; thoughtful, inviting, and not too formal."),
    track("music-xiangqi-f", "xiangqi", "island.webp", "A more active mid-game Chinese chess loop with crisp plucked notes, gentle frame drum, and a confident string motif; poised, not aggressive."),
]


def access_token():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def png_reference(owner, image_name):
    # The app's art is in apps/web/public/shared/images/; a game's in games/<id>/assets/.
    if owner == "shared":
        source = ROOT / "apps" / "web" / "public" / "shared" / "images" / image_name
    else:
        source = ROOT / "games" / owner / "assets" / image_name
    if not source.is_file():
        raise FileNotFoundError(f"Missing music reference image: {source}")
    temp = tempfile.NamedTemporaryFile(prefix="psc-music-ref-", suffix=".png", delete=False)
    temp.close()
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-frames:v", "1", temp.name],
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"Could not convert {source} to PNG")
    try:
        return base64.b64encode(Path(temp.name).read_bytes()).decode("ascii")
    finally:
        Path(temp.name).unlink(missing_ok=True)


def find_audio(value):
    if isinstance(value, dict):
        if value.get("type") == "audio" and isinstance(value.get("data"), str) and value["data"]:
            return value["data"], value.get("mime_type", "audio/mpeg")
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


def generate_one(item, project, token, force):
    source_dir = (
        ROOT / "assets" / "shared" / "audio" / "music" / "generated"
        if item["owner"] == "shared"
        else ROOT / "assets" / "games" / item["owner"] / "audio"
    )
    output = source_dir / f"{item['name']}.mp3"
    if output.exists() and not force:
        return f"Reuse {output.relative_to(ROOT)}"

    body = {
        "model": MODEL,
        "input": [
            {"type": "text", "text": item["prompt"]},
            {"type": "image", "mime_type": "image/png", "data": png_reference(item["owner"], item["image"])},
        ],
    }
    url = URL.format(project=project)
    for attempt in range(5):
        request = urllib.request.Request(
            url,
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=900) as response:
                result = json.load(response)
            break
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            if error.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(5 * (attempt + 1))
                continue
            raise RuntimeError(f"{item['name']}: Google API HTTP {error.code}: {details[:1500]}") from error
    else:
        raise RuntimeError(f"{item['name']}: request retries exhausted")

    audio = find_audio(result)
    if not audio:
        raise RuntimeError(f"{item['name']}: no audio data in response: {json.dumps(result)[:1500]}")
    data, mime_type = audio
    if mime_type not in ("audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"):
        raise RuntimeError(f"{item['name']}: unexpected audio type {mime_type}")
    source_dir.mkdir(parents=True, exist_ok=True)
    output.write_bytes(base64.b64decode(data))
    probe = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(output)],
        text=True,
    ).strip()
    return f"Saved {output.relative_to(ROOT)} ({float(probe):.1f}s, {mime_type})"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", PROJECT_DEFAULT))
    parser.add_argument("--jobs", type=int, default=3, help="Parallel Lyria requests (default: 3)")
    parser.add_argument("--force", action="store_true", help="Regenerate existing tracks")
    parser.add_argument("--only", help="Comma-separated track names to generate")
    args = parser.parse_args()
    if not 1 <= args.jobs <= 5:
        parser.error("--jobs must be between 1 and 5")
    tracks = TRACKS
    if args.only:
        wanted = set(args.only.split(","))
        tracks = [item for item in TRACKS if item["name"] in wanted]
        missing = wanted - {item["name"] for item in tracks}
        if missing:
            parser.error(f"unknown track name(s): {', '.join(sorted(missing))}")

    token = access_token()
    errors = []
    print(f"Generating {len(tracks)} tracks with {MODEL} in {args.project}…", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as executor:
        futures = {
            executor.submit(generate_one, item, args.project, token, args.force): item["name"]
            for item in tracks
        }
        for future in concurrent.futures.as_completed(futures):
            name = futures[future]
            try:
                print(f"✓ {future.result()}", flush=True)
            except Exception as error:  # Keep generating the remaining catalog after one failure.
                errors.append((name, str(error)))
                print(f"✗ {name}: {error}", file=sys.stderr, flush=True)
    if errors:
        print(f"{len(errors)} track(s) failed; rerun the script to retry missing outputs.", file=sys.stderr)
        sys.exit(1)
    print(f"Completed {len(tracks)} music tracks.")


if __name__ == "__main__":
    main()
