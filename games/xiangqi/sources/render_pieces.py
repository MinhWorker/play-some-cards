"""Bake ivory xiangqi discs and aligned camera-space normals into one atlas.

Run: npm run blender -- xiangqi pieces [or piece-red-general].
PSC_XIANGQI_FONT can select another freely licensed CJK font installed on the machine.
"""
from pathlib import Path
import math
import os
import sys

import bpy
import bmesh

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
    curve = bpy.data.curves.new('Engraving cutter', 'FONT')
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


def annulus(name, inner, outer, bottom, top, mat, segments=128):
    profile = ((bottom, inner), (bottom, outer), (top, outer), (top, inner))
    vertices = [(r * math.cos(i * math.tau / segments), r * math.sin(i * math.tau / segments), z)
                for z, r in profile for i in range(segments)]
    faces = []
    for ring in range(4):
        next_ring = (ring + 1) % 4
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((ring * segments + i, ring * segments + j,
                          next_ring * segments + j, next_ring * segments + i))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for i, polygon in enumerate(mesh.polygons):
        polygon.use_smooth = (i // segments) % 2 == 1
    return obj


def engrave(body, cutter):
    bpy.ops.object.select_all(action='DESELECT')
    cutter.select_set(True)
    bpy.context.view_layer.objects.active = cutter
    if cutter.type != 'MESH':
        bpy.ops.object.convert(target='MESH')
        cutter = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # CJK glyphs contain touching/overlapping strokes: weld and orient the solid cutter,
    # then use Exact's self-intersection support rather than leaving inverted cut faces.
    mesh = bmesh.new()
    mesh.from_mesh(cutter.data)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-5)
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    mesh.to_mesh(cutter.data)
    mesh.free()
    mod = body.modifiers.new('Recessed engraving', 'BOOLEAN')
    mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', cutter
    mod.use_self = True
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


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
            setup((384, 384), 3.2, target=(0, 0, 0.275), camera=(0, -4.5, 12), samples=32)
            ivory = material('Warm ivory satin stone', (0.78, 0.64, 0.36), 0.48, 0.08)
            ink = material('Red cinnabar' if side == 'red' else 'Charcoal ink',
                           (0.48, 0.018, 0.012) if side == 'red' else (0.025, 0.023, 0.021), 0.65, 0)
            body = lathe('Thick ivory disc with sharp rims', [(0, 0.94), (0.55, 0.94)],
                         ivory, segments=128)
            engrave(body, glyph(character, font, ivory, 0.625, 0.14))
            engrave(body, annulus('Ring groove cutter', 0.742, 0.764, 0.525, 0.65, ivory))
            # The color is entirely below the face: ivory walls and real cavity normals
            # catch the dynamic light while the flat ink floor remains easy to read.
            lathe('Ink at the bottom of the lettering', [(0.486, 0.87), (0.487, 0.87)], ink)
            annulus('Ink at the bottom of the ring', 0.742, 0.764, 0.526, 0.527, ink)
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
            radius = math.hypot((x - size / 2) / 115, (y - size / 2 - 16) / 104)
            alpha = int(65 * max(0, min(1, (1.08 - radius) / 0.18)))
            pixels[x, y] = (38, 25, 12, alpha)
    image.save(ROOT / 'assets' / 'piece-shadow.webp', lossless=True, method=6)
