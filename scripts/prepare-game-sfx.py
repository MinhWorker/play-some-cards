#!/usr/bin/env python3
"""Choose clean Veo SFX takes, detect trims, and register app-ready WAV sources."""

import argparse
import array
import json
import math
import runpy
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_RATE = 16_000
WINDOW_SECONDS = 0.04
WINDOW_SIZE = int(SAMPLE_RATE * WINDOW_SECONDS)
MAX_DURATION = {
    "button-click": 0.8,
    "button-hover": 0.8,
    "island-hover": 0.9,
    "island-click": 1.2,
    "island-locked": 1.5,
    "cloud-spread": 1.8,
    "mark-drop": 1.0,
    "caro-select": 0.8,
    "caro-o-place": 1.0,
    "xiangqi-piece-select": 0.8,
    "xiangqi-move": 1.1,
    "xiangqi-capture": 1.3,
    "tien-len-card-select": 0.9,
    "tien-len-card-play": 1.2,
    "tien-len-deal": 2.0,
    "tien-len-trick-clear": 1.4,
    "ludo-dice-roll": 2.0,
    "ludo-token-return": 1.5,
    "ludo-token-step": 0.9,
}
SOUND_CONFIG = ROOT / "assets/audio.json"
GENERATOR = runpy.run_path(str(ROOT / "scripts/generate-game-sfx.py"), run_name="_sfx_catalog")
CUES = GENERATOR["CUES"]


def candidate_dir(owner):
    return ROOT / "assets" / ("shared" if owner == "shared" else f"games/{owner}") / "audio/sfx-candidates"


def decode_pcm(path):
    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-vn",
            "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "pipe:1",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"ffmpeg could not extract {path}: {result.stderr.decode(errors='replace')[-500:]}")
    samples = array.array("h")
    samples.frombytes(result.stdout)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def dbfs(window):
    if not window:
        return -120.0
    rms = math.sqrt(sum(sample * sample for sample in window) / len(window))
    return 20 * math.log10(max(1.0, rms) / 32768)


def inspect(path):
    samples = decode_pcm(path)
    levels = [dbfs(samples[start : start + WINDOW_SIZE]) for start in range(0, len(samples), WINDOW_SIZE)]
    peak = max(levels, default=-120.0)
    peak_index = levels.index(peak) if levels else 0
    # Ignore a quiet generated room/air bed when finding the brief cue itself.
    threshold = max(-60.0, peak - 20.0)
    active = [index for index, level in enumerate(levels) if level >= threshold]
    if not active:
        return {
            "path": path,
            "score": -999.0,
            "peak": peak,
            "start": 0.0,
            "duration": 0.0,
            "segments": 0,
            "quiet_ratio": 1.0,
            "event_duration": 0.0,
        }

    max_gap = round(0.2 / WINDOW_SECONDS)
    groups = []
    group_start = group_end = active[0]
    for index in active[1:]:
        if index - group_end <= max_gap:
            group_end = index
        else:
            groups.append((group_start, group_end))
            group_start = group_end = index
    groups.append((group_start, group_end))
    event_start, event_end = max(groups, key=lambda group: group[1] - group[0])
    event_duration = (event_end - event_start + 1) * WINDOW_SECONDS
    quiet_ratio = sum(level < threshold for level in levels) / max(1, len(levels))
    too_many_segments = max(0, len(groups) - 1)
    duration_penalty = max(0.0, event_duration - 1.2) * 12.0
    score = peak + quiet_ratio * 35 - too_many_segments * 4 - duration_penalty
    start = max(0.0, event_start * WINDOW_SECONDS - 0.04)
    end = min(len(samples) / SAMPLE_RATE, (event_end + 1) * WINDOW_SECONDS + 0.13)
    # Crop around the loudest transient when there is a quiet bed or an overlong generated tail.
    duration_limit = MAX_DURATION.get(path.name.split("-candidate-", 1)[0].removeprefix("fast-").removeprefix("lite-"), 1.8)
    if end - start > duration_limit or quiet_ratio < 0.72:
        start = max(0.0, peak_index * WINDOW_SECONDS - min(0.15, duration_limit * 0.3))
    duration = min(duration_limit, max(0.15, end - start))
    return {
        "path": path,
        "score": score,
        "peak": peak,
        "start": round(start, 2),
        "duration": round(duration, 2),
        "segments": len(groups),
        "event_duration": round(event_duration, 2),
        "quiet_ratio": quiet_ratio,
    }


def prepare(item):
    folder = candidate_dir(item["owner"])
    candidates = sorted(
        path
        for prefix in (item["name"], f"fast-{item['name']}", f"lite-{item['name']}")
        for path in folder.glob(f"{prefix}-candidate-*.mp4")
    )
    if len(candidates) < 1:
        raise FileNotFoundError(f"No generated candidates for {item['name']}")
    takes = [inspect(path) for path in candidates]
    chosen = max(takes, key=lambda take: take["score"])
    if chosen["peak"] < -50 or chosen["quiet_ratio"] < 0.72 or chosen["segments"] > 4 or chosen.get("event_duration", 0) > 2.5:
        print(
            f"  ! {item['name']}: best take may need listening "
            f"(peak {chosen['peak']:.0f} dBFS, quiet {chosen['quiet_ratio']:.0%}, "
            f"segments {chosen['segments']})"
        )

    owner_dir = "shared" if item["owner"] == "shared" else f"games/{item['owner']}"
    selected_dir = ROOT / "assets" / owner_dir / "audio/sfx-selected"
    selected_dir.mkdir(parents=True, exist_ok=True)
    output = selected_dir / f"{item['name']}.mp4"
    shutil.copy2(chosen["path"], output)
    return item["name"], item["owner"], output.relative_to(ROOT / "assets").as_posix(), chosen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="Comma-separated sound IDs to prepare")
    args = parser.parse_args()
    cues = CUES
    if args.only:
        wanted = set(args.only.split(","))
        cues = [item for item in CUES if item["name"] in wanted]
        missing = wanted - {item["name"] for item in cues}
        if missing:
            parser.error(f"unknown sound id(s): {', '.join(sorted(missing))}")

    config = json.loads(SOUND_CONFIG.read_text())
    sounds = config["sounds"]
    prepared = []
    for item in cues:
        name, owner, src, take = prepare(item)
        mapping = {
            "src": src,
            "start": take["start"],
            "duration": take["duration"],
            "format": "wav",
        }
        if owner != "shared":
            mapping = {"game": owner, **mapping}
        sounds[name] = mapping
        prepared.append((name, take))

    SOUND_CONFIG.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n")
    print(f"Registered {len(prepared)} cues in assets/audio.json.")
    for name, take in prepared:
        print(
            f"✓ {name}: candidate {take['path'].stem.rsplit('-', 1)[-1]} · "
            f"trim {take['start']:.2f}s + {take['duration']:.2f}s · peak {take['peak']:.0f} dBFS · "
            f"silence {take['quiet_ratio']:.0%}"
        )


if __name__ == "__main__":
    main()
