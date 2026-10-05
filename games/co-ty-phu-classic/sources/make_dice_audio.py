"""Synthesize short ivory-dice cues; presentation schedules them along each trajectory.

Run from the repository root: python3 games/co-ty-phu-classic/sources/make_dice_audio.py
The legacy tumble recording is deliberately left intact.
"""

import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
ASSETS = Path(__file__).resolve().parents[1] / "assets"


def render(name, duration, peak, synth):
    rng = random.Random(name)
    samples = [synth(i / RATE, rng) for i in range(round(duration * RATE))]
    # Remove DC and taper both ends, keeping crisp contacts without digital clicks.
    dc = sum(samples) / len(samples)
    samples = [(s - dc) * min(1, i / (RATE * .002)) *
               min(1, (len(samples) - 1 - i) / (RATE * .008))
               for i, s in enumerate(samples)]
    scale = peak / max(abs(s) for s in samples)
    path = ASSETS / f"tycoon-dice-{name}.wav"
    with wave.open(str(path), "wb") as audio:
        audio.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        audio.writeframes(b"".join(struct.pack("<h", round(s * scale * 32767)) for s in samples))
    print(f"{path.name}: {duration:.3f}s, peak {20 * math.log10(peak):.1f}dBFS")


def contact(t, rng, pitch=560):
    # Two slightly separated dice: a dry ivory click plus a damped wooden-table body.
    value = 0
    for delay, gain, shift in [(0, 1, 1), (.012, .72, 1.17)]:
        dt = t - delay
        if dt < 0:
            continue
        click = rng.uniform(-1, 1) * math.exp(-dt * 230)
        body = sum(math.sin(2 * math.pi * pitch * shift * f * dt) * math.exp(-dt * decay)
                   for f, decay in [(1, 85), (1.61, 115), (.34, 62)]) / 3
        value += gain * (click * .48 + body * .52)
    return value


def arc(t, rng):
    # A soft upward sweep, with faint edge clicks as the dice leave the hand.
    envelope = math.sin(math.pi * min(1, t / .32)) ** 1.4
    air = rng.uniform(-1, 1) * .27 * envelope
    roll = sum(contact(t - delay, rng, 880) * gain if t >= delay else 0
               for delay, gain in [(0, .12), (.027, .09), (.061, .05)])
    return air + roll


def spiral(t, rng):
    # A brief turning rattle. Spacing between repeats grows as rotation slows.
    envelope = math.sin(math.pi * min(1, t / .16)) ** 1.2
    air = rng.uniform(-1, 1) * envelope * .12
    edges = sum(contact(t - delay, rng, 1050) * gain if t >= delay else 0
                for delay, gain in [(0, .17), (.026, .13), (.058, .09), (.098, .05)])
    return air + edges


render("arc", .32, .28, arc)
render("skipping", .105, .48, lambda t, rng: contact(t, rng, 670))
render("spiral", .16, .30, spiral)
render("land", .13, .57, lambda t, rng: contact(t, rng, 470))
