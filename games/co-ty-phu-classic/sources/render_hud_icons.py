"""Render the flat SVG originals into the existing game asset pipeline."""
from pathlib import Path
import subprocess
import sys
from PIL import Image

sources = Path(__file__).resolve().parent
for name, max_size in (("hud-money", 192), ("hud-location", 128), ("tile-button", 320), ("tile-button-primary", 320), ("roll-button", 640)):
    if sys.argv[1:] and name not in sys.argv[1:]:
        continue
    png = sources / f"{name}.png"
    subprocess.run(
        ["magick", "-background", "none", "-density", "288", str(sources / f"{name}.svg"), str(png)],
        check=True,
    )
    with Image.open(png) as image:
        image = image.convert("RGBA")
        if not name.startswith("tile-button") and name != "roll-button":
            image = image.crop(image.getchannel("A").getbbox())
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        image.save(sources.parent / "assets" / f"{name}.webp", lossless=True)
