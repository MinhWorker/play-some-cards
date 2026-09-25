#!/usr/bin/env python3
"""Generate the original Xiangqi board-game sound effects.

Requires Python's standard library. Generated sources go under assets/games/xiangqi/audio/
(gitignored); run npm run audio -- <sound-name> to build app-ready WAV files.
"""

import math
import random
import struct
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SFX_DIR = ROOT / "assets" / "games" / "xiangqi" / "audio"
RATE = 48_000
random.seed(9031)


def frames(seconds):
    return max(0, round(seconds * RATE))


def silence(seconds):
    return [0.0] * frames(seconds)


def wood_hit(target, start, pitch=720, strength=0.2, duration=0.16):
    offset = frames(start)
    count = frames(duration)
    modes = (
        (0.72, 0.32, 27),
        (1.0, 0.52, 35),
        (1.49, 0.28, 52),
        (2.07, 0.16, 74),
        (3.22, 0.07, 108),
    )
    noise_state = 0.0
    for index in range(count):
        frame = offset + index
        if frame >= len(target):
            break
        t = index / RATE
        attack = 1 - math.exp(-t * 1150)
        body = sum(
            amplitude * math.sin(2 * math.pi * pitch * ratio * t) * math.exp(-t * decay)
            for ratio, amplitude, decay in modes
        )
        noise_state += 0.24 * (random.uniform(-1, 1) - noise_state)
        click = noise_state * math.exp(-t * 125)
        target[frame] += strength * attack * (body + 0.16 * click)


def chime(target, frequency, start, duration=0.32, strength=0.12):
    offset = frames(start)
    count = frames(duration)
    for index in range(count):
        frame = offset + index
        if frame >= len(target):
            break
        t = index / RATE
        attack = min(1.0, t / 0.008)
        envelope = attack * math.exp(-4.2 * t / duration)
        partials = (
            math.sin(2 * math.pi * frequency * t)
            + 0.28 * math.sin(2 * math.pi * frequency * 2.72 * t)
            + 0.08 * math.sin(2 * math.pi * frequency * 4.16 * t)
        )
        target[frame] += strength * envelope * partials


def scrape(target, start, duration=0.09, strength=0.08):
    offset = frames(start)
    count = frames(duration)
    filtered = 0.0
    for index in range(count):
        frame = offset + index
        if frame >= len(target):
            break
        t = index / RATE
        ratio = t / duration
        filtered += 0.19 * (random.uniform(-1, 1) - filtered)
        envelope = math.sin(math.pi * ratio) ** 0.7
        target[frame] += strength * envelope * filtered


def cue_start():
    result = silence(0.92)
    for index, (start, pitch) in enumerate(
        ((0.03, 940), (0.16, 750), (0.29, 820), (0.42, 660), (0.55, 740))
    ):
        wood_hit(result, start, pitch=pitch, strength=0.15 - index * 0.012)
    chime(result, 587.33, 0.57, duration=0.35, strength=0.07)
    chime(result, 783.99, 0.69, duration=0.38, strength=0.07)
    return result


def cue_piece_select():
    result = silence(0.24)
    wood_hit(result, 0.01, pitch=1040, strength=0.22, duration=0.13)
    return result


def cue_move():
    result = silence(0.38)
    scrape(result, 0.005, duration=0.12, strength=0.09)
    wood_hit(result, 0.095, pitch=670, strength=0.2, duration=0.18)
    return result


def cue_capture():
    result = silence(0.48)
    scrape(result, 0.0, duration=0.1, strength=0.07)
    wood_hit(result, 0.035, pitch=560, strength=0.19, duration=0.21)
    wood_hit(result, 0.105, pitch=430, strength=0.28, duration=0.24)
    return result


def cue_check():
    result = silence(0.64)
    wood_hit(result, 0.01, pitch=490, strength=0.13, duration=0.17)
    chime(result, 784, 0.07, duration=0.34, strength=0.105)
    chime(result, 622.25, 0.25, duration=0.38, strength=0.09)
    return result


def cue_turn():
    result = silence(0.44)
    wood_hit(result, 0.015, pitch=850, strength=0.11, duration=0.11)
    chime(result, 880, 0.05, duration=0.32, strength=0.1)
    return result


def cue_illegal():
    result = silence(0.34)
    wood_hit(result, 0.015, pitch=360, strength=0.17, duration=0.17)
    wood_hit(result, 0.1, pitch=290, strength=0.11, duration=0.16)
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
    cues = (
        ("psc-xiangqi-start.wav", cue_start),
        ("psc-xiangqi-piece-select.wav", cue_piece_select),
        ("psc-xiangqi-move.wav", cue_move),
        ("psc-xiangqi-capture.wav", cue_capture),
        ("psc-xiangqi-check.wav", cue_check),
        ("psc-xiangqi-turn.wav", cue_turn),
        ("psc-xiangqi-illegal.wav", cue_illegal),
    )
    for name, render in cues:
        write_wav(name, render())


if __name__ == "__main__":
    main()
