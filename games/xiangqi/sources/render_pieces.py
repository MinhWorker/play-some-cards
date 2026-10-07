"""Bake ivory xiangqi discs and aligned camera-space normals into one atlas.

Run: npm run blender -- xiangqi pieces [or piece-red-general].
PSC_XIANGQI_FONT can select another freely licensed CJK font installed on the machine.
"""
from pathlib import Path
import math
import os
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'tools' / 'blender'))
from psc_bake import atlas, lathe, material, render, setup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / '.blender' / 'xiangqi'
SELECTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
KINDS = ('general', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier')
CHARACTERS = {'red': '帥仕相傌俥炮兵', 'black': '將士象馬車砲卒'}
FRAMES = [f'piece-{side}-{kind}' for side in CHARACTERS for kind in KINDS]
FONT = Path(os.environ.get('PSC_XIANGQI_FONT', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'))


def glyph(character, font, mat, z, extrusion):
    curve = bpy.data.curves.new('Colored character inlay', 'FONT')
    curve.body, curve.font = character, font
    curve.align_x, curve.align_y = 'CENTER', 'CENTER'
    curve.size, curve.extrude, curve.resolution_u = 1.1, extrusion, 8
    obj = bpy.data.objects.new(character, curve)
    bpy.context.collection.objects.link(obj)
    obj.location.z = z
    obj.data.materials.append(mat)
    bpy.context.view_layer.update()
    # Fit every glyph in the same circle, including the wide traditional characters.
    factor = 1.12 / max(obj.dimensions.x, obj.dimensions.y)
    obj.scale.x = obj.scale.y = factor
    return obj


if not SELECTED or 'pieces' in SELECTED or any(name in FRAMES for name in SELECTED):
    if not FONT.is_file():
        raise FileNotFoundError('Install Noto Sans CJK Bold or set PSC_XIANGQI_FONT to a CJK font')
    font = bpy.data.fonts.load(str(FONT))
    for side, characters in CHARACTERS.items():
        for kind, character in zip(KINDS, characters):
            name = f'piece-{side}-{kind}'
            if SELECTED and 'pieces' not in SELECTED and name not in SELECTED and all(
                    (OUT / f'{name}{suffix}.png').exists() for suffix in ('', '.normal')):
                continue
            setup((384, 384), 3.2, target=(0, 0, 0.13), camera=(0, -4.5, 12), samples=32)
            ivory = material('Warm ivory satin stone', (0.78, 0.64, 0.36), 0.48, 0.08)
            ink = material('Red cinnabar' if side == 'red' else 'Charcoal ink',
                           (0.48, 0.018, 0.012) if side == 'red' else (0.025, 0.023, 0.021), 0.65, 0)
            lathe('Bevelled ivory disc', [(0, 0.92), (0.025, 0.98), (0.06, 1),
                         (0.19, 1), (0.235, 0.98), (0.255, 0.94), (0.25, 0.89)], ivory)
            bpy.ops.mesh.primitive_torus_add(major_radius=0.79, minor_radius=0.014,
                                            major_segments=96, minor_segments=12,
                                            location=(0, 0, 0.252))
            ring = bpy.context.object
            ring.name = 'Inset colored ring'
            ring.data.materials.append(ink)
            # A thin colored inlay avoids Boolean artifacts in overlapping CJK strokes.
            glyph(character, font, ink, 0.252, 0.001)
            render(name, OUT, OUT, normal=True, webp=False)
    atlas('pieces', FRAMES, ROOT / 'assets', OUT)

if not SELECTED or 'piece-shadow' in SELECTED:
    # Contact shadow only: no ground plane or cast shadow baked into the lit pieces.
    from PIL import Image
    size = 384
    image = Image.new('RGBA', (size, size))
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            radius = math.hypot((x - size / 2) / 122, (y - size / 2 - 7) / 110)
            alpha = int(65 * max(0, min(1, (1.08 - radius) / 0.18)))
            pixels[x, y] = (38, 25, 12, alpha)
    image.save(ROOT / 'assets' / 'piece-shadow.webp', lossless=True, method=6)
