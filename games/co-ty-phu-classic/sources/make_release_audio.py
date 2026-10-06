"""Synthesize an unlocking latch, sliding steel bars and a bright release chime."""
import math
import random
import struct
import wave
from pathlib import Path

rng = random.Random(23)
rate, duration = 44100, 1.05
samples = []
for i in range(round(rate * duration)):
    t = i / rate
    latch = math.exp(-45 * t) * (math.sin(2 * math.pi * 740 * t) + rng.uniform(-1, 1)) * 0.22
    slide = rng.uniform(-1, 1) * 0.14 * max(0, math.sin(math.pi * min(1, t / 0.72)))
    chime = sum(math.sin(2 * math.pi * f * max(0, t - delay)) *
                math.exp(-9 * max(0, t - delay)) * 0.15 if t >= delay else 0
                for f, delay in [(660, 0.25), (880, 0.36), (1320, 0.49)])
    samples.append((latch + slide + chime) * min(1, t * 180) * min(1, (duration - t) * 30))
path = Path(__file__).resolve().parents[1] / 'assets' / 'tycoon-release.wav'
with wave.open(str(path), 'wb') as audio:
    audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
    audio.writeframes(b''.join(struct.pack('<h', round(max(-1, min(1, s)) * 32767)) for s in samples))
