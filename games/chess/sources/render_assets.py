"""Render consistent Staunton sprites and an exact 8x8 board with Blender.

Run: npm run blender -- chess [board piece-white-knight]
PNG intermediates stay in .blender/chess. Transparent sprites share a 384px canvas and anchor.
"""
from pathlib import Path
import math
import sys
import bpy
from functools import partial

# Shared helpers resolve identically in Blender and Python with the bpy wheel.
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "blender"))
from xomdao_bake import LEGACY_RIG, material, wood, cube, sphere, lathe, setup, cloth_tile, atlas, render as bake

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / '.blender' / 'chess'
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
render = partial(bake, assets=ROOT / "assets", out=OUT, selected=SELECTED)


def piece(kind, mat, trim, eye):
    base = [(0, 0.36), (0.04, 0.43), (0.11, 0.43), (0.16, 0.39),
            (0.20, 0.37), (0.24, 0.39), (0.28, 0.36), (0.33, 0.30)]
    heights = {'pawn': 0.86, 'rook': 1.12, 'knight': 0.70, 'bishop': 1.18, 'queen': 1.36, 'king': 1.44}
    h = heights[kind]
    lathe('Weighted base and tapered stem', base + [(0.42, 0.24), (h - 0.12, 0.14),
          (h - 0.05, 0.24), (h, 0.25), (h + 0.05, 0.22)], mat)
    lathe('Base inlay', [(0.105, 0.432), (0.123, 0.425)], trim)
    if kind == 'pawn':
        sphere('Pawn ball', (0, 0, h + 0.22), (0.24, 0.24, 0.24), mat)
    elif kind == 'king':
        lathe('King crown', [(h, 0.20), (h + 0.12, 0.28), (h + 0.20, 0.28), (h + 0.26, 0.15)], mat)
        cube('King cross upright', (0.12, 0.13, 0.36), (0, 0, h + 0.40), mat, 0.016)
        cube('King cross arms', (0.36, 0.13, 0.11), (0, 0, h + 0.44), mat, 0.016)
    elif kind == 'queen':
        lathe('Queen crown', [(h, 0.19), (h + 0.18, 0.31), (h + 0.25, 0.32), (h + 0.25, 0.21)], mat)
        for i in range(7):
            a = i * math.tau / 7
            sphere('Crown pearl', (0.285 * math.cos(a), 0.285 * math.sin(a), h + 0.28), (0.065,) * 3, mat)
        sphere('Queen finial', (0, 0, h + 0.33), (0.09, 0.09, 0.13), mat)
    elif kind == 'rook':
        lathe('Castle tower', [(h, 0.22), (h + 0.12, 0.31), (h + 0.27, 0.31), (h + 0.27, 0.22)], mat)
        for i in range(6):
            a = i * math.tau / 6
            block = cube('Battlement', (0.16, 0.17, 0.18), (0.255 * math.cos(a), 0.255 * math.sin(a), h + 0.32), mat)
            block.rotation_euler.z = a
    elif kind == 'bishop':
        # Broad pointed mitre and a deep open slit remain legible from the high camera.
        # The pawn has a round ball; the bishop's shoulders and apex form a teardrop.
        lathe('Bishop double collar', [(h - 0.025, 0.23), (h + 0.025, 0.28),
              (h + 0.07, 0.28), (h + 0.10, 0.17)], mat)
        head = lathe('Bishop pointed mitre', [(h + 0.07, 0.12), (h + 0.16, 0.25),
                    (h + 0.26, 0.30), (h + 0.34, 0.28), (h + 0.51, 0.15),
                    (h + 0.66, 0.018)], mat)
        cut = cube('Mitre slit cutter', (0.105, 0.9, 0.63), (0.045, 0, h + 0.49), mat, 0)
        cut.rotation_euler.y = -0.55
        mod = head.modifiers.new('Diagonal mitre slit', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = cut
        bpy.context.view_layer.objects.active = head
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cut, do_unlink=True)
    else:
        # Sculpted side-profile silhouette, facing right; same orientation for both colors.
        outline = [(-0.26, 0.73), (-0.31, 0.95), (-0.27, 1.23), (-0.20, 1.49),
                   (-0.12, 1.61), (-0.09, 1.83), (0.03, 1.76), (0.12, 1.82),
                   (0.15, 1.61), (0.30, 1.51), (0.48, 1.39), (0.50, 1.25),
                   (0.42, 1.18), (0.22, 1.25), (0.13, 1.18), (0.12, 1.02), (0.28, 0.76)]
        verts = [(x, y, z) for y in (-0.13, 0.13) for x, z in outline]
        n = len(outline)
        faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
        faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
        mesh = bpy.data.meshes.new('Carved horse head')
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new('Carved horse head', mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(mat)
        bevel = obj.modifiers.new('Rounded carved head', 'BEVEL')
        bevel.width, bevel.segments = 0.07, 4
        obj.modifiers.new('Sculpted head normals', 'WEIGHTED_NORMAL')
        sphere('Near eye', (0.17, -0.157, 1.52), (0.036,) * 3, eye)
        sphere('Far eye', (0.17, 0.157, 1.52), (0.036,) * 3, eye)


if not SELECTED or 'board' in SELECTED:
    setup((1800, 1800), 10, lights=LEGACY_RIG)
    rim = wood('Walnut rim', (0.07, 0.024, 0.009), (0.20, 0.075, 0.023))
    gold = material('Thin brass inlay', (0.55, 0.31, 0.07), 0.36)
    light = wood('Maple squares', (0.56, 0.38, 0.18), (0.73, 0.55, 0.29))
    dark = wood('Walnut squares', (0.10, 0.032, 0.011), (0.19, 0.077, 0.03))
    cube('Thin board rim', (10, 10, 0.18), (0, 0, 0), rim, 0.07)
    cube('Hairline brass inlay', (9.55, 9.55, 0.02), (0, 0, 0.10), gold, 0.016)
    # The playable area is exactly 94% of the image, matching ChessView's 3% inset.
    cell = 9.4 / 8
    for row in range(8):
        for col in range(8):
            cube(f'Square {row}:{col}', (cell, cell, 0.025),
                 (-4.7 + (col + 0.5) * cell, 4.7 - (row + 0.5) * cell, 0.12),
                 light if (row + col) % 2 == 0 else dark, 0)
    render('board')

KINDS = ('king', 'queen', 'rook', 'bishop', 'knight', 'pawn')
FRAMES = [f'piece-{side}-{kind}' for side in ('white', 'black') for kind in KINDS]
render_pieces = not SELECTED or 'pieces' in SELECTED or any(name in FRAMES for name in SELECTED)
for side, color in [('white', (0.82, 0.76, 0.61)), ('black', (0.018, 0.025, 0.035))]:
    for kind in KINDS:
        name = f'piece-{side}-{kind}'
        if not render_pieces:
            continue
        if SELECTED and 'pieces' not in SELECTED and name not in SELECTED and all(
                (OUT / f'{name}{suffix}.png').exists() for suffix in ('', '.normal')):
            continue
        setup((384, 384), 1.85, target=(0, 0, 0.6), camera=(0, -4.5, 12))
        mat = material(f'{side} satin stone', color)
        trim = material('Subtle warm base inlay', (0.35, 0.20, 0.06), 0.36)
        eye = material('Horse eye', (0.035, 0.025, 0.012) if side == 'white' else (0.65, 0.40, 0.12))
        piece(kind, mat, trim, eye)
        bake(name, OUT, OUT, normal=True, webp=False)

if render_pieces:
    atlas('pieces', FRAMES, ROOT / 'assets', OUT)

if not SELECTED or 'cloth' in SELECTED:
    cloth_tile("cloth", ROOT / "assets", OUT, (0.026, 0.042, 0.056))

# Shallow lacquer/ivory faces with a fine brass inset, sized for nine-slice UI.
for name, color in [('button', (0.014, 0.045, 0.075)),
                    ('button-secondary', (0.77, 0.65, 0.45))]:
    if SELECTED and name not in SELECTED:
        continue
    setup((640, 200), 4.16, lights=LEGACY_RIG)
    brass = material('Satin brass button edge', (0.52, 0.30, 0.085), 0.58)
    face = material('Lacquer' if name == 'button' else 'Ivory', color, 0.68)
    face.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value = 0.06
    cube('Button body', (3.96, 1.13, 0.10), (0, 0, 0), brass, 0.09)
    cube('Inset button face', (3.88, 1.05, 0.035), (0, 0, 0.065), face, 0.075)
    render(name)
