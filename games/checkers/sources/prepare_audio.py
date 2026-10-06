"""Copy the project's existing audio; no new external audio or licenses.

Run from the repository root: python3 games/checkers/sources/prepare_audio.py
Short effects are converted to mono PCM 16-bit WAV 48 kHz, music remains 128 kbps MP3.
"""
from pathlib import Path
import shutil
import subprocess

GAME = Path(__file__).resolve().parents[1]
GAMES = GAME.parent
SOUNDS = {
    'checkers-start': ('xiangqi', 'xiangqi-start'),
    'checkers-select': ('xiangqi', 'xiangqi-piece-select'),
    'checkers-move': ('go', 'go-place-1'),
    'checkers-capture': ('go', 'go-capture'),
    'checkers-promote': ('xiangqi', 'xiangqi-decisive-move'),
    'checkers-draw': ('xiangqi', 'xiangqi-draw'),
    'checkers-win': ('xiangqi', 'xiangqi-game-win'),
}
for target, (game, source) in SOUNDS.items():
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(GAMES / game / 'assets' / f'{source}.wav'),
                    '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', str(GAME / 'assets' / f'{target}.wav')], check=True)
shutil.copyfile(GAMES / 'go' / 'assets' / 'music-go.mp3', GAME / 'assets' / 'music-checkers.mp3')
