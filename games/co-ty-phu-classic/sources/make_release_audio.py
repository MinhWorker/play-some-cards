"""Make a dry key turn, two latch clicks and steel gate rollers, without a pitched cry."""
import math
import random
import struct
import wave
from pathlib import Path

rng = random.Random(23)
rate, duration = 44100, 0.82
samples = []
filtered = 0.0
for i in range(round(rate * duration)):
    t = i / rate
    noise = rng.uniform(-1, 1)
    filtered += 0.16 * (noise - filtered)
    # Short low clunks with metallic overtones, separated like a released deadbolt.
    latch = 0.0
    for delay, gain in [(0.025, 0.48), (0.105, 0.36)]:
        dt = t - delay
        if dt >= 0:
            latch += gain * math.exp(-70 * dt) * (
                0.65 * math.sin(2 * math.pi * 180 * dt)
                + 0.22 * math.sin(2 * math.pi * 1270 * dt)
                + 0.25 * noise
            ) * min(1, dt * 1800)
    # A rolling scrape follows the latch while the two gate halves open.
    progress = max(0.0, min(1.0, (t - 0.13) / 0.62))
    envelope = math.sin(math.pi * progress) ** 0.8
    rollers = envelope * (filtered * 0.25 + noise * 0.025)
    for delay in [0.20, 0.31, 0.43, 0.56, 0.69]:
        dt = t - delay
        if dt >= 0:
            rollers += math.exp(-130 * dt) * math.sin(2 * math.pi * 320 * dt) * 0.035
    fade = min(1, t * 160, (duration - t) * 80)
    samples.append((latch + rollers) * fade)
path = Path(__file__).resolve().parents[1] / 'assets' / 'tycoon-release.wav'
with wave.open(str(path), 'wb') as audio:
    audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
    audio.writeframes(b''.join(struct.pack('<h', round(max(-1, min(1, s)) * 32767)) for s in samples))
