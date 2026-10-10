"""Render Caro's tile and pieces with Blender, in the hub's toy-wood look (docs/art-direction.md):
a light honey-wood tile, a red-lacquer X and a blue-lacquer O, lit from the upper left.

Run: npm run blender -- tic-tac-toe [tile piece-x piece-o cloth]
PNG intermediates stay in .blender/tic-tac-toe. The pieces share a 320px canvas and anchor.
"""
from pathlib import Path
import sys
from functools import partial

import bpy

# Shared helpers resolve identically in Blender and Python with the bpy wheel.
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "blender"))
from xomdao_bake import material, wood, cube, cloth_tile, setup, render as bake

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / '.blender' / 'tic-tac-toe'
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
render = partial(bake, assets=ROOT / "assets", out=OUT, selected=SELECTED)


def linear(hex_color):
    """An sRGB hex colour as Blender's linear RGB."""
    def channel(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(channel(int(hex_color[i:i + 2], 16)) for i in (1, 3, 5))


def wanted(name):
    return not SELECTED or name in SELECTED


# A soft square of light honey wood with a rounded rim, seen from above.
if wanted('tile'):
    setup((320, 320), 1.06, target=(0, 0, 0), camera=(0, -1.2, 12), samples=48)
    face = wood('Light honey wood', linear('#E5A458'), linear('#F2CC8A'))
    rim = wood('Honey wood rim', linear('#B87A3A'), linear('#D9963F'))
    cube('Tile rim', (1.0, 1.0, .12), (0, 0, 0), rim, .09, 5)
    cube('Tile face', (.84, .84, .06), (0, 0, .07), face, .05, 4)
    render('tile')

# The pieces: thick, rounded toy shapes in lacquer, standing a little proud of the tile.
if wanted('piece-x'):
    setup((320, 320), 1.15, target=(0, 0, .1), camera=(0, -1.2, 12), samples=48)
    red = material('Red lacquer', linear('#C21A20'), .3, .35)
    # One outline (no overlapping bars, so no seam where they cross), extruded and rounded.
    w, a = .2, .5
    outline = [(0, w), (a - w, a + w - w), (a, a - w), (w, 0), (a, -a + w), (a - w, -a),
               (0, -w), (-a + w, -a), (-a, -a + w), (-w, 0), (-a, a - w), (-a + w, a)]
    outline = [(x * .92, y * .92) for x, y in outline]
    n = len(outline)
    verts = [(x, y, z) for z in (0, .22) for x, y in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new('X')
    mesh.from_pydata(verts, [], faces)
    cross = bpy.data.objects.new('X', mesh)
    bpy.context.collection.objects.link(cross)
    cross.data.materials.append(red)
    bevel = cross.modifiers.new('Soft bevel', 'BEVEL')
    bevel.width, bevel.segments, bevel.limit_method = .1, 8, 'NONE'
    cross.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    render('piece-x')

if wanted('piece-o'):
    setup((320, 320), 1.15, target=(0, 0, .1), camera=(0, -1.2, 12), samples=48)
    blue = material('Blue lacquer', linear('#1752A8'), .3, .35)
    bpy.ops.mesh.primitive_torus_add(major_radius=.33, minor_radius=.13, major_segments=96,
                                     minor_segments=32, location=(0, 0, .13))
    ring = bpy.context.object
    ring.scale = (1, 1, .85)
    ring.data.materials.append(blue)
    for polygon in ring.data.polygons:
        polygon.use_smooth = True
    render('piece-o')

# The table's cloth: a calm sea-deep weave under the tiles.
if wanted('cloth'):
    cloth_tile('cloth', ROOT / 'assets', OUT, linear('#14687A'))
