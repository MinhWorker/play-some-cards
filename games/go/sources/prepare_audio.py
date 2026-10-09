"""Edit existing project audio into dry stone-on-wood clicks, without synthesized drums.

python games/go/sources/prepare_audio.py (requires ffmpeg, numpy and scipy).
Fetch the source recording with git lfs pull --include=assets/audio/sfx/xomdao-wood-marker-place-veo.mp3.
"""

from pathlib import Path
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "games" / "go" / "assets"
RATE = 48000


def read(path):
    with tempfile.TemporaryDirectory() as folder:
        decoded = Path(folder) / "decoded.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-ac", "1", "-ar", str(RATE), str(decoded)], check=True)
        _, samples = wavfile.read(decoded)
        return samples.astype(float) / 32768


def write(name, samples, peak=0.34):
    samples = samples - np.mean(samples)
    samples *= peak / max(np.max(np.abs(samples)), 0.001)
    fade = min(len(samples) // 2, int(RATE * 0.035))
    samples[:96] *= np.linspace(0, 1, 96)
    samples[-fade:] *= np.linspace(1, 0, fade)
    wavfile.write(OUT / f"{name}.wav", RATE, (samples * 32767).astype(np.int16))


source = read(ROOT / "assets" / "audio" / "sfx" / "xomdao-wood-marker-place-veo.mp3")
clicks = []
for index, (start, speed) in enumerate([(1.26, 1.04), (1.89, 1.0), (1.26, 0.98)], 1):
    sample = source[int(start * RATE):int((start + 0.35) * RATE)]
    # Keep the recorded broadband contact. Remove low room/board boom and long hollow tails.
    sample = sosfilt(butter(2, [240, 8500], "bandpass", fs=RATE, output="sos"), sample)
    onset = np.flatnonzero(np.abs(sample) > 0.017)[0]
    sample = sample[max(0, onset - 48):][:int(0.25 * RATE)]
    sample = np.interp(np.arange(0, len(sample), speed), np.arange(len(sample)), sample)
    clicks.append(sample)
    write(f"go-place-{index}", sample, 0.37 - index * 0.018)

# A few tiny contacts as captured stones are lifted, rather than a dramatic crash.
capture = np.zeros(int(RATE * 0.42))
for start, gain, click in zip([0, 0.067, 0.143], [1, 0.66, 0.38], clicks):
    click = click[:int(RATE * 0.15)].copy()
    click[-960:] *= np.linspace(1, 0, 960)
    offset = int(start * RATE)
    capture[offset:offset + len(click)] += click * gain
write("go-capture", capture, 0.26)
write("go-pass", clicks[1][:int(RATE * 0.12)].copy(), 0.12)

for name, game, asset, peak in [
    ("go-start", "tic-tac-toe", "caro-start", 0.22),
    ("go-count", "tic-tac-toe", "caro-line-complete", 0.24),
    ("go-end", "tic-tac-toe", "caro-win", 0.3),
]:
    write(name, read(ROOT / "games" / game / "assets" / f"{asset}.wav"), peak)

# Already encoded at 128 kbps; keep this calm existing soundtrack without another lossy encode.
(OUT / "music-go.mp3").write_bytes((ROOT / "games" / "xiangqi" / "assets" / "music-xiangqi-a.mp3").read_bytes())
