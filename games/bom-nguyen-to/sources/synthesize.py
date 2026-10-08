"""Original short synthesized game cues; run from the repository root."""
import math
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'assets'
RATE = 22050

def sound(name, duration, frequencies, noise=False):
    data = []
    for i in range(int(duration * RATE)):
        t = i / RATE
        envelope = min(1, t / 0.008) * max(0, 1 - t / duration) ** 2
        value = sum(math.sin(2 * math.pi * (f * t + (85 * t * t if noise else 0))) for f in frequencies) / len(frequencies)
        if noise:
            value = value * 0.6 + (math.sin(i * 127.1) * 43758.5453 % 1 - 0.5) * 0.4
        data.append(struct.pack('<h', int(value * envelope * 10500)))
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b''.join(data))

sound('place', 0.12, [230, 460])
sound('explode', 0.35, [65, 95, 145], True)
sound('skill', 0.30, [523.25, 659.25, 783.99])
sound('start', 0.65, [392, 523.25, 659.25])
