"""Prepare local project audio and two original effects; no external downloads.

Run from the repository root: python3 games/bai-cao/sources/prepare_audio.py
Effects: mono PCM 16-bit WAV, 48 kHz. Music: existing 128 kbps MP3.
"""
from pathlib import Path
import math
import random
import shutil
import struct
import subprocess
import wave

GAME = Path(__file__).resolve().parents[1]
SOUNDS = {
    'bai-cao-deal': ('tien-len', 'tien-len-deal'),
    'bai-cao-peek': ('tien-len', 'tien-len-card-select'),
    'bai-cao-reveal': ('mau-binh', 'mau-binh-reveal'),
    'bai-cao-win': ('mau-binh', 'mau-binh-win'),
    'bai-cao-ba-tay': ('mau-binh', 'mau-binh-special'),
    'bai-cao-end': ('tien-len', 'tien-len-win'),
    'bai-cao-tick': ('mau-binh', 'mau-binh-tick'),
}
for target, (game, source) in SOUNDS.items():
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i',
                    str(GAME.parent / game / 'assets' / f'{source}.wav'),
                    '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le',
                    str(GAME / 'assets' / f'{target}.wav')], check=True)

def write(name, duration, sample):
    rate = 48000
    with wave.open(str(GAME / 'assets' / f'{name}.wav'), 'wb') as out:
        out.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        out.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, sample(i / rate))) * 32767))
                                 for i in range(int(rate * duration))))

rng = random.Random(33)
write('bai-cao-chip', .22, lambda t: (math.sin(2 * math.pi * 2100 * t) * .13
                                    + rng.uniform(-1, 1) * .18) * math.exp(-t * 38)
                                    * min(1, t * 1500))
write('bai-cao-lose', .55, lambda t: .16 * math.sin(2 * math.pi * (260 * t - 90 * t * t))
                                    * math.sin(math.pi * t / .55) ** 2)
shutil.copyfile(GAME.parent / 'tien-len/assets/music-tien-len-a.mp3',
                GAME / 'assets/music-bai-cao.mp3')
