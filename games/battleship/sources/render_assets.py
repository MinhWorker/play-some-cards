"""Reproducible original naval art and audio. Run from the repository root.

Requires Node/sharp (npm install) and ffmpeg. No downloaded or sampled material.
"""
import math
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "games/battleship/assets"
OUT.mkdir(exist_ok=True)
RNG = random.Random(55)


def render(name, width, height, body):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">{body}</svg>'
    with tempfile.NamedTemporaryFile(suffix=".svg") as source:
        source.write(svg.encode())
        source.flush()
        subprocess.run([
            "node", "--input-type=module", "-e",
            "import sharp from 'sharp'; await sharp(process.argv[1], {density:Number(process.argv[3])}).webp({quality:92}).toFile(process.argv[2]);",
            source.name, str(OUT / f"{name}.webp"), "144" if name == "ocean" else "72"
        ], cwd=ROOT, check=True)


def ship(length):
    width = length * 160
    deck = f'<path d="M20 80 Q40 24 95 22 H{width-85} Q{width-32} 24 {width-14} 80 Q{width-32} 136 {width-85} 138 H95 Q40 136 20 80Z" fill="url(#hull)" stroke="#102b3a" stroke-width="7"/>'
    deck += f'<path d="M48 80 Q60 40 105 38 H{width-92} Q{width-58} 40 {width-38} 80 Q{width-58} 120 {width-92} 122 H105 Q60 120 48 80Z" fill="#9aaeb2" stroke="#d5e8e2" stroke-width="3"/>'
    if length == 5:
        deck += f'<rect x="80" y="48" width="{width-166}" height="64" rx="12" fill="#435b65"/>'
        deck += f'<path d="M94 80 H{width-102}" stroke="#f4df9b" stroke-width="4" stroke-dasharray="16 10"/>'
        for x in [155, 295, 435, 575]:
            deck += f'<path d="M{x} 69 l34 -9 -9 12 9 12 -34 -9 -13 10 0 -26Z" fill="#d2e6df" stroke="#213e4e" stroke-width="2"/>'
        deck += '<rect x="360" y="23" width="145" height="24" rx="6" fill="#78939b" stroke="#e2eeee" stroke-width="3"/>'
    else:
        for x in [100, width - 100]:
            deck += f'<rect x="{x-24}" y="56" width="48" height="48" rx="16" fill="#66828d" stroke="#d6e6e5" stroke-width="3"/><path d="M{x} 80 h45" stroke="#203b4a" stroke-width="10"/><path d="M{x} 77 h45" stroke="#b4cbd0" stroke-width="4"/>'
        deck += f'<rect x="{width/2-42}" y="48" width="84" height="64" rx="10" fill="#c4d3d0" stroke="#526e79" stroke-width="4"/><rect x="{width/2-28}" y="60" width="56" height="16" rx="3" fill="#203f55"/><circle cx="{width/2}" cy="94" r="10" fill="#405969"/><path d="M{width/2} 48 v-22 m-20 11 h40" stroke="#d5e6e5" stroke-width="4"/>'
    for x in range(88, width - 60, 56):
        deck += f'<circle cx="{x}" cy="32" r="3" fill="#e7e8d7"/><circle cx="{x}" cy="128" r="3" fill="#e7e8d7"/>'
    return f'<defs><linearGradient id="hull" x2="0" y2="1"><stop stop-color="#d2e1db"/><stop offset=".5" stop-color="#7799a4"/><stop offset="1" stop-color="#3b586c"/></linearGradient></defs>{deck}'


for length in [2, 3, 4, 5]:
    render(f"ship-{length}", length * 160, 160, ship(length))

render("button", 384, 128, '<defs><linearGradient id="button" x2="0" y2="1"><stop stop-color="#32828c"/><stop offset="1" stop-color="#164354"/></linearGradient></defs><rect x="4" y="4" width="376" height="120" rx="30" fill="#071f31"/><rect x="6" y="4" width="372" height="112" rx="28" fill="url(#button)" stroke="#dfc595" stroke-width="4"/><path d="M38 17 H346" stroke="#b4e6dd" stroke-opacity=".4" stroke-width="3"/>')

waves = "".join(
    f'<path d="M{x} {y} q20 -7 40 0 t40 0" fill="none" stroke="#8be0e0" stroke-opacity=".12" stroke-width="2"/>'
    for y in range(20, 1024, 44) for x in range(-20 + (y % 3) * 30, 1600, 125)
)
render("ocean", 1600, 1024, '<defs><radialGradient id="sea"><stop stop-color="#226b80"/><stop offset=".6" stop-color="#144a63"/><stop offset="1" stop-color="#082437"/></radialGradient></defs><rect width="1600" height="1024" fill="url(#sea)"/>' + waves)

# The hub island is generated separately: sources/island.png and prompts.json.

render("splash", 256, 256, '''<ellipse cx="128" cy="187" rx="99" ry="39" fill="none" stroke="#9be4ed" stroke-width="8"/><ellipse cx="128" cy="183" rx="65" ry="24" fill="#7ed1e4" opacity=".65"/><path d="M76 180 Q98 130 72 73 Q119 96 126 33 Q147 100 186 73 Q161 142 188 178 Q130 210 76 180Z" fill="#d7f7f7"/><path d="M109 171 Q125 112 126 77 Q145 133 154 176Z" fill="#80d3e8"/><circle cx="52" cy="113" r="10" fill="#e2ffff"/><circle cx="204" cy="133" r="9" fill="#e2ffff"/><circle cx="167" cy="44" r="6" fill="#e2ffff"/>''')
render("burst", 256, 256, '''<path d="M128 10 l22 64 64 -40 -17 67 56 30 -65 24 29 68 -63 -34 -25 65 -24 -65 -67 29 29 -65 -64 -25 66 -24 -30 -64 65 28Z" fill="#ed6236"/><path d="M128 49 l22 50 47 -16 -23 45 31 31 -50 5 -27 45 -15 -47 -57 -3 39 -32 -14 -45 34 22Z" fill="#ffb849"/><circle cx="129" cy="133" r="28" fill="#fff2bc"/>''')

RATE = 44100


def wav(name, duration, sample):
    with wave.open(str(OUT / f"{name}.wav"), "wb") as audio:
        audio.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        values = []
        for i in range(int(duration * RATE)):
            t = i / RATE
            fade = min(1, t / .006, (duration-t) / .025)
            values.append(struct.pack("<h", int(max(-.95, min(.95, sample(t))) * fade * 32767)))
        audio.writeframes(b"".join(values))


def tone(t, freq):
    return math.sin(math.tau * freq * t)


def noise():
    return RNG.uniform(-1, 1)


wav("battleship-place", .16, lambda t: (.24*tone(t, 750)+.17*tone(t, 1125))*math.exp(-t*28))
wav("battleship-ready", .52, lambda t: .24*tone(t, [392, 494, 587][min(2, int(t*6))])*math.exp(-(t % (1/6))*12))
wav("battleship-fire", .35, lambda t: (.45*noise()+.32*tone(t, 110-80*t))*math.exp(-t*17))
wav("battleship-miss", .52, lambda t: (.16*noise()+.3*tone(t, 540-700*t))*math.exp(-t*8))
wav("battleship-hit", .65, lambda t: (.5*noise()+.3*tone(t, 72))*math.exp(-t*9))
wav("battleship-sunk", 1.3, lambda t: (.4*noise()+.3*tone(t, 65-26*t))*math.exp(-t*3.6))
wav("battleship-win", 1.8, lambda t: sum(.10*tone(t, f) for f in [392,494,587,784])*math.exp(-(t % .45)*4))

# Gentle, slow C-minor pads and sonar-like arpeggios, with a smooth seam.
chords = [[130.81,155.56,196], [103.83,130.81,155.56], [116.54,146.83,174.61], [98,130.81,155.56]]


def music(t):
    total = 0
    for k, chord in enumerate(chords):
        local = t-k*8
        if 0 <= local < 8:
            envelope = math.sin(math.pi * local / 8)**2
            total += envelope * sum(.035*tone(t, f) + .012*tone(t, f*2) for f in chord)
            beat = local % 1
            total += .045*tone(t, chord[int(local) % 3]*4)*math.exp(-beat*5)*envelope
    return total


wav("music-battleship", 32, music)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(OUT / "music-battleship.wav"), "-codec:a", "libmp3lame", "-b:a", "128k", str(OUT / "music-battleship.mp3")], check=True)
(OUT / "music-battleship.wav").unlink()
