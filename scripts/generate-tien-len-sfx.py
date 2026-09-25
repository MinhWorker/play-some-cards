#!/usr/bin/env python3
"""Generate the small original, musical cues in the Tiến lên SFX pack.

Requires only Python's standard library and ffmpeg. Source files are written under
assets/games/tien-len/audio/ (gitignored); npm run audio -- <sound-name> builds app-ready WAVs.
"""

import math
import random
import struct
import subprocess
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SFX_DIR = ROOT / "assets" / "games" / "tien-len" / "audio"
CARD_SOURCE = SFX_DIR / "oxidvideos-taking-playing-card-2-522516.mp3"
RATE = 48_000
random.seed(2519)


def seconds(value):
    return max(0, int(value * RATE))


def silence(duration):
    return [0.0] * seconds(duration)


def read_card():
    raw = subprocess.check_output(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(CARD_SOURCE),
            "-ac",
            "1",
            "-ar",
            str(RATE),
            "-f",
            "f32le",
            "pipe:1",
        ]
    )
    return list(struct.unpack(f"<{len(raw) // 4}f", raw))


def mix(target, source, start, gain=1.0, speed=1.0):
    offset = seconds(start)
    output_count = math.ceil(len(source) / speed)
    for index in range(min(output_count, len(target) - offset)):
        source_index = min(len(source) - 1, int(index * speed))
        target[offset + index] += source[source_index] * gain


def note(target, frequency, start, duration, gain=0.2, bright=False):
    offset = seconds(start)
    count = seconds(duration)
    for index in range(count):
        frame = offset + index
        if frame >= len(target):
            break
        t = index / RATE
        attack = min(1.0, t / 0.006)
        envelope = attack * math.exp(-4.6 * t / duration)
        fundamental = math.sin(2 * math.pi * frequency * t)
        overtone = math.sin(2 * math.pi * frequency * 2.01 * t)
        third = math.sin(2 * math.pi * frequency * 3.98 * t)
        color = 0.43 if bright else 0.22
        target[frame] += gain * envelope * (fundamental + color * overtone + 0.08 * third)


def sweep(target, start, duration, low, high, gain=0.14):
    offset = seconds(start)
    count = seconds(duration)
    last = 0.0
    for index in range(count):
        frame = offset + index
        if frame >= len(target):
            break
        t = index / RATE
        ratio = t / duration
        frequency = low + (high - low) * ratio * ratio
        phase = 2 * math.pi * (low * t + (high - low) * t**3 / (3 * duration**2))
        noise = random.uniform(-1, 1)
        last += 0.12 * (noise - last)
        envelope = math.sin(math.pi * ratio) ** 0.6
        target[frame] += gain * envelope * (0.7 * math.sin(phase) + 0.3 * last)


def card_flutters(card):
    result = silence(1.6)
    # Short, staggered paper flicks turn the existing card recording into a light deal.
    for index, start in enumerate((0.03, 0.19, 0.35, 0.51, 0.67, 0.83)):
        mix(result, card, start, gain=0.26 - index * 0.012, speed=1.28)
    return result


def cue_pass():
    result = silence(0.55)
    note(result, 520, 0.015, 0.22, 0.16)
    note(result, 390, 0.13, 0.25, 0.13)
    return result


def cue_turn():
    result = silence(0.62)
    note(result, 659.25, 0.015, 0.42, 0.13, bright=True)
    note(result, 880, 0.11, 0.43, 0.12, bright=True)
    return result


def cue_last_card():
    result = silence(0.72)
    note(result, 880, 0.015, 0.32, 0.16, bright=True)
    note(result, 1174.66, 0.18, 0.4, 0.14, bright=True)
    return result


def cue_combo(card):
    result = silence(0.82)
    mix(result, card, 0.015, gain=0.17, speed=1.4)
    for index, frequency in enumerate((523.25, 659.25, 783.99, 1046.5)):
        note(result, frequency, 0.08 + index * 0.075, 0.36, 0.085, bright=True)
    return result


def cue_special_cut(card):
    result = silence(0.82)
    mix(result, card, 0.018, gain=0.23, speed=1.5)
    sweep(result, 0.01, 0.28, 150, 670, gain=0.2)
    note(result, 523.25, 0.23, 0.38, 0.15, bright=True)
    note(result, 783.99, 0.25, 0.42, 0.1, bright=True)
    return result


def cue_special_hand(card):
    result = silence(1.12)
    mix(result, card, 0.015, gain=0.15, speed=1.5)
    for index, frequency in enumerate((392, 493.88, 587.33, 783.99, 1046.5)):
        note(result, frequency, 0.1 + index * 0.08, 0.58, 0.075, bright=True)
    sweep(result, 0.02, 0.5, 330, 1050, gain=0.065)
    return result


def cue_trick_clear(card):
    result = silence(1.18)
    # Several quick card sweeps and a soft rising rush signal a fresh lead.
    for index, start in enumerate((0.02, 0.16, 0.30, 0.44)):
        mix(result, card, start, gain=0.2 - index * 0.025, speed=1.55)
    sweep(result, 0.06, 0.82, 280, 960, gain=0.075)
    note(result, 659.25, 0.66, 0.42, 0.075, bright=True)
    return result


def write_wav(name, samples):
    peak = max((abs(sample) for sample in samples), default=0)
    scale = 0.7 / peak if peak else 1.0
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    output = SFX_DIR / name
    with wave.open(str(output), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(
            b"".join(
                struct.pack("<h", max(-32768, min(32767, round(sample * scale * 32767))))
                for sample in samples
            )
        )
    print(f"Wrote {output.relative_to(ROOT)} ({len(samples) / RATE:.2f}s)")


def main():
    if not CARD_SOURCE.exists():
        raise SystemExit(f"Missing card recording: {CARD_SOURCE}")
    card = read_card()
    peak = max((abs(sample) for sample in card), default=0)
    if peak:
        card = [sample * 0.7 / peak for sample in card]
    write_wav("psc-tien-len-card-source.wav", card)
    write_wav("psc-tien-len-deal.wav", card_flutters(card))
    write_wav("psc-tien-len-pass.wav", cue_pass())
    write_wav("psc-tien-len-turn.wav", cue_turn())
    write_wav("psc-tien-len-last-card.wav", cue_last_card())
    write_wav("psc-tien-len-combo.wav", cue_combo(card))
    write_wav("psc-tien-len-special-cut.wav", cue_special_cut(card))
    write_wav("psc-tien-len-special-hand.wav", cue_special_hand(card))
    write_wav("psc-tien-len-trick-clear.wav", cue_trick_clear(card))


if __name__ == "__main__":
    main()
