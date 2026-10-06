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

# Transparent miniature naval harbour for the home island strip.
render("island", 1024, 768, '''
<defs><linearGradient id="rock" x2="0" y2="1"><stop stop-color="#938879"/><stop offset="1" stop-color="#33485d"/></linearGradient><linearGradient id="land" x2="0" y2="1"><stop stop-color="#7cad77"/><stop offset="1" stop-color="#305955"/></linearGradient></defs>
<ellipse cx="510" cy="620" rx="426" ry="80" fill="#30babc" opacity=".18"/>
<path d="M120 440 L880 420 852 546 700 628 328 638 166 548Z" fill="url(#rock)" stroke="#243d50" stroke-width="10"/>
<path d="M116 422 Q125 292 344 264 L604 258 Q832 258 890 386 L794 468 640 454 558 550 292 524Z" fill="#d8c49a" stroke="#f4dfb4" stroke-width="14"/>
<path d="M140 400 Q151 313 344 286 L604 280 Q798 282 853 384 L760 424 632 410 539 496 290 488Z" fill="url(#land)"/>
<path d="M500 514 L632 412 838 430 779 564 636 586Z" fill="#2d94a2" stroke="#79d2d0" stroke-width="8"/>
<path d="M541 511 L674 453 760 476" fill="none" stroke="#233e4b" stroke-width="29"/>
<path d="M541 505 L674 447 760 470" fill="none" stroke="#c5b190" stroke-width="23"/>
<g transform="translate(640 494) rotate(-18) scale(.38)">''' + ship(3) + '''</g>
<path d="M286 346 l38 -172 h77 l34 172Z" fill="#e4e4cb" stroke="#294655" stroke-width="8"/>
<path d="M304 260 h114 v38 H297Z" fill="#ca6550"/>
<path d="M318 176 v-42 h80 v42Z" fill="#83c9cf" stroke="#294655" stroke-width="8"/>
<path d="M300 134 l60 -54 58 54Z" fill="#d36b52" stroke="#294655" stroke-width="8"/>
<path d="M357 116 v-52" stroke="#294655" stroke-width="7"/>
<path d="M476 361 v-73 l121 -42 115 51 v63Z" fill="#b5c4b6" stroke="#294655" stroke-width="8"/>
<path d="M468 290 l130 -72 124 76 -124 22Z" fill="#466875" stroke="#294655" stroke-width="8"/>
<rect x="552" y="318" width="49" height="43" rx="4" fill="#284e62"/>
<circle cx="744" cy="335" r="46" fill="#315d55"/><circle cx="786" cy="361" r="38" fill="#3e7560"/>
<path d="M222 439 l-12 -76 m12 31 l-40 -35 m40 22 l30 -35" stroke="#594e3d" stroke-width="12"/>
<path d="M208 366 q-57 -54 -82 7 q47 -16 82 -7 q-10 -73 43 -72 q-27 26 -43 72 q46 -43 77 9 q-41 -18 -77 -9Z" fill="#4c8e64" stroke="#294e49" stroke-width="5"/>
''')

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
