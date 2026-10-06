"""Render ridged draughts discs and a floating checkers island with Blender.

Run: npm run blender -- checkers [piece-white-king cloth]
PNG intermediates stay in .blender/checkers. Transparent sprites share a 384px canvas and anchor.
"""
from pathlib import Path
import math
import sys
import bpy
from functools import partial

# Shared helpers resolve identically in Blender and Python with the bpy wheel.
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "blender"))
from psc_bake import material, wood, cube, sphere, lathe, setup, cloth_tile, render as bake

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / '.blender' / 'checkers'
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
render = partial(bake, assets=ROOT / "assets", out=OUT, selected=SELECTED)


def disc(mat, gold, king=False):
    profile = [(0, .38), (.025, .46), (.065, .47), (.105, .44),
               (.14, .46), (.18, .46), (.21, .43), (.23, .39),
               (.235, .36), (.22, .34), (.22, .29), (.23, .27), (.23, .015)]
    lathe('Ridged playing disc', profile, mat)
    lathe('Inner carved ring', [(.232, .27), (.24, .28), (.246, .27)], mat)
    if king:
        bpy.ops.mesh.primitive_torus_add(major_radius=.33, minor_radius=.012, location=(0,0,.25))
        bpy.context.object.data.materials.append(gold)
        # A broad five-point crown remains legible at phone size.
        outline = [(-.20,-.11), (.20,-.11), (.23,.12), (.11,.035),
                   (0,.20), (-.11,.035), (-.23,.12)]
        verts = [(x,y,z) for z in (.245,.265) for x,y in outline]
        n=len(outline)
        faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
        faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        mesh=bpy.data.meshes.new('Crown emblem')
        mesh.from_pydata(verts,[],faces)
        obj=bpy.data.objects.new('Crown emblem',mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(gold)


for side, color in [('white',(.86,.79,.64)), ('black',(.028,.021,.018))]:
    for kind in ('man','king'):
        name=f'piece-{side}-{kind}'
        if SELECTED and name not in SELECTED: continue
        setup((384,384),1.15,target=(0,0,.1),camera=(0,-2,12))
        mat=material(f'{side} polished wood',color,.3)
        gold=material('Warm gold crown',(.8,.45,.09),.28)
        disc(mat,gold,kind=='king')
        render(name)

if not SELECTED or 'island' in SELECTED:
    setup((1024,1024),13,target=(0,0,-.2),camera=(8,-11,10))
    earth=material('Warm floating rock',(.24,.12,.045),.82)
    grass=material('Mossy grass',(.19,.39,.055),.95)
    grass.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=0
    grass.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=0.1
    rim=wood('Walnut rim',(.07,.024,.009),(.20,.075,.023))
    light=wood('Maple squares',(.56,.38,.18),(.73,.55,.29))
    dark=wood('Walnut squares',(.10,.032,.011),(.19,.077,.03))
    gold=material('Gold',(.8,.45,.09),.3)
    bpy.ops.mesh.primitive_cone_add(vertices=9,radius1=2.1,radius2=4.5,depth=3.4,location=(0,0,-1.9))
    bpy.context.object.data.materials.append(earth)
    sphere('Grassy island',(0,0,-.1),(4.7,4.5,.55),grass)
    cube('Board',(6.4,6.4,.25),(0,0,.55),rim,.12)
    cell=6/8
    for row in range(8):
        for col in range(8):
            cube(f'Square {row}:{col}',(cell,cell,.03),
                 (-3+(col+.5)*cell,3-(row+.5)*cell,.70),
                 light if (row+col)%2==0 else dark,0)
    for x,y,side,king in [(-1.125,-1.125,'black',True),(-.375,-1.875,'black',False),
                           (1.125,1.125,'white',True),(1.875,1.875,'white',False)]:
        before=set(bpy.data.objects)
        mat=material(side,(.86,.79,.64) if side=='white' else (.028,.021,.018))
        disc(mat,gold,king)
        for obj in set(bpy.data.objects)-before:
            obj.location.x+=x
            obj.location.y+=y
            obj.location.z+=.75
    for x,y in [(-3.5,2.1),(3.4,-2.2),(-3.2,-2.8)]:
        sphere('Rounded bush',(x,y,.5),(.55,.55,.65),grass)
    render('island')

# Match chess's small seamless midnight cloth, without loading its full-screen image.
if not SELECTED or "cloth" in SELECTED:
    cloth_tile("cloth", ROOT / "assets", OUT, (0.026, 0.042, 0.056))
