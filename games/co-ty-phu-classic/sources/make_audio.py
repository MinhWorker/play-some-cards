"""Generate the game's original sound effects and a short looping music track."""

from __future__ import annotations

import math
import random
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

RATE = 44100
ASSETS = Path(__file__).resolve().parents[1] / "assets"
random.seed(41)


def tone(freq: float, t: float, kind: str = "sine") -> float:
    phase = 2 * math.pi * freq * t
    if kind == "triangle":
        return 2 / math.pi * math.asin(math.sin(phase))
    return math.sin(phase)


def bell(freq: float, t: float, decay: float = 8) -> float:
    return (
        tone(freq, t) * 0.6
        + tone(freq * 2.01, t) * 0.24
        + tone(freq * 3.93, t) * 0.12
    ) * math.exp(-decay * t)


def wav(name: str, samples: list[float]) -> None:
    peak = max(1, max(abs(value) for value in samples) / 0.88)
    data = b"".join(struct.pack("<h", int(32767 * value / peak)) for value in samples)
    with wave.open(str(ASSETS / f"{name}.wav"), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(data)


def effect(name: str, duration: float, voices: list[tuple[float, float, float, float]]) -> None:
    """A voice is (start second, frequency, amplitude, decay)."""
    samples = []
    for i in range(int(duration * RATE)):
        t = i / RATE
        value = sum(
            amplitude * bell(freq, t - start, decay)
            for start, freq, amplitude, decay in voices
            if t >= start
        )
        samples.append(value * min(1, t * 90) * min(1, (duration - t) * 35))
    wav(name, samples)


effect("tycoon-turn", 0.32, [(0, 660, 0.5, 12), (0.075, 880, 0.4, 14)])
effect("tycoon-coin", 0.48, [(0, 1047, 0.44, 9), (0.11, 1319, 0.44, 10)])
effect("tycoon-buy", 0.68, [(0, 523, 0.4, 9), (0.1, 659, 0.4, 9), (0.2, 784, 0.55, 7)])
effect("tycoon-rent", 0.58, [(0, 587, 0.4, 9), (0.1, 494, 0.4, 9), (0.2, 392, 0.5, 8)])
effect("tycoon-build", 0.55, [(0, 330, 0.5, 22), (0.12, 392, 0.5, 22), (0.24, 784, 0.45, 10)])
effect("tycoon-jail", 0.75, [(0, 220, 0.7, 6), (0.07, 233, 0.4, 7), (0.18, 146.8, 0.6, 5)])
effect("tycoon-card", 0.48, [(0, 784, 0.2, 16), (0.08, 1047, 0.3, 13), (0.17, 1175, 0.3, 9)])
effect(
    "tycoon-win",
    1.8,
    [(0, 523, 0.36, 4), (0.2, 659, 0.36, 4), (0.4, 784, 0.36, 4),
     (0.6, 1047, 0.45, 3), (0.8, 1319, 0.5, 2.8)],
)


def noise_effect(name: str, duration: float, hits: list[float], pitch: float) -> None:
    samples = []
    for i in range(int(duration * RATE)):
        t = i / RATE
        value = 0.0
        for hit in hits:
            age = t - hit
            if 0 <= age < 0.18:
                envelope = math.exp(-age * 38)
                value += envelope * (0.38 * random.uniform(-1, 1) + 0.36 * tone(pitch, age))
        samples.append(value * min(1, (duration - t) * 35))
    wav(name, samples)


noise_effect("tycoon-dice", 0.76, [0, 0.09, 0.19, 0.29, 0.42, 0.56], 185)
noise_effect("tycoon-step", 0.16, [0], 230)


def music() -> None:
    # Sixteen bars of light marimba, bass and soft pads. The last bar resolves into the first.
    tempo = 112
    beat = 60 / tempo
    bars = 16
    duration = bars * 4 * beat
    chords = [
        (261.63, 329.63, 392.0), (220.0, 261.63, 329.63),
        (174.61, 220.0, 261.63), (196.0, 246.94, 392.0),
    ] * 4
    melody = [
        523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 493.88, 392.0,
        440.0, 523.25, 659.25, 523.25, 392.0, 493.88, 587.33, 493.88,
    ]
    samples = []
    for i in range(int(duration * RATE)):
        t = i / RATE
        bar = min(bars - 1, int(t / (beat * 4)))
        bar_t = t - bar * beat * 4
        chord = chords[bar]
        pad = sum(tone(freq, t, "triangle") for freq in chord) / 3 * 0.075
        bass = tone(chord[0] / 2, t) * 0.11 * (0.65 + 0.35 * math.cos(math.pi * bar_t / (beat * 4)))
        eighth = int(bar_t / (beat / 2))
        note_t = bar_t - eighth * beat / 2
        note = melody[(bar * 2 + eighth // 4) % len(melody)]
        pluck = (tone(note, note_t) + 0.3 * tone(note * 2, note_t)) * math.exp(-note_t * 8) * 0.15
        tick_age = bar_t % beat
        tick = random.uniform(-1, 1) * math.exp(-tick_age * 95) * 0.025
        fade = min(1, t / 0.2, (duration - t) / 0.2)
        samples.append((pad + bass + pluck + tick) * fade)
    with tempfile.TemporaryDirectory() as temp:
        temp_wav = Path(temp) / "music.wav"
        peak = max(1, max(abs(value) for value in samples) / 0.85)
        with wave.open(str(temp_wav), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(b"".join(struct.pack("<h", int(32767 * s / peak)) for s in samples))
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(temp_wav), "-b:a", "128k",
             str(ASSETS / "music-tycoon.mp3")],
            check=True,
        )


music()

# Keep the selected preview choices as the app-ready game assets when rebuilding this pack.
PREVIEW = Path(__file__).resolve().parent / "audio-preview"
selected = {
    "01-turn.wav": "tycoon-turn.wav",
    "02-dice.wav": "tycoon-dice.wav",
    "03-step.wav": "tycoon-step.wav",
    "04-money-in.wav": "tycoon-coin.wav",
    "05-money-out.wav": "tycoon-rent.wav",
    "06-purchase.wav": "tycoon-buy.wav",
    "07-build.wav": "tycoon-build.wav",
    "08-card.wav": "tycoon-card.wav",
    "09-auction.wav": "tycoon-auction.wav",
    "10-jail.wav": "tycoon-jail.wav",
    "11-bankrupt.wav": "tycoon-bankrupt.wav",
}
for source, destination in selected.items():
    shutil.copyfile(PREVIEW / source, ASSETS / destination)
shutil.copyfile(PREVIEW / "tien-len-standings.mp3", ASSETS / "tycoon-win.mp3")
(ASSETS / "tycoon-win.wav").unlink(missing_ok=True)

# Preserve the selected Tiến Lên card effects when rebuilding the audio pack.
TIEN_LEN = ASSETS.parents[1] / "tien-len" / "assets"
shutil.copyfile(TIEN_LEN / "tien-len-card-select.wav", ASSETS / "tycoon-card.wav")
shutil.copyfile(TIEN_LEN / "tien-len-card-play.wav", ASSETS / "tycoon-card-flip.wav")

NOTIFICATIONS = ASSETS.parents[2] / "assets" / "audio" / "sfx"
shutil.copyfile(NOTIFICATIONS / "freesound_gamestudio-material-buy-success-394517.mp3",
                ASSETS / "tycoon-trade-request.mp3")
shutil.copyfile(NOTIFICATIONS / "freesound_community-item-pick-up-38258.mp3",
                ASSETS / "tycoon-item-receive.mp3")
