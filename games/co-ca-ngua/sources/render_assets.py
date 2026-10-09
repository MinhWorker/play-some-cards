"""Bake a wooden Vietnamese horse-race set with the shared xomdao_bake rig.
Run: npm run blender -- co-ca-ngua [board horses dice-1 cloth button]
"""
from pathlib import Path
import sys
import math
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'tools' / 'blender'))
from xomdao_bake import setup, material, wood, cube, sphere, lathe, render, atlas, cloth_tile

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
OUT = ROOT.parents[1] / '.blender' / 'co-ca-ngua'
SELECTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
COLORS = [('red', (.68, .025, .038)), ('blue', (.018, .26, .63)),
          ('yellow', (.96, .57, .035)), ('green', (.02, .40, .19))]


def wanted(name):
    return not SELECTED or name in SELECTED


def rotate(x, y, turns):
    for _ in range(turns):
        x, y = 14-y, x
    return x, y


def xy(x, y):
    return ((x-7)*.4, (7-y)*.4)


def disk(name, x, y, radius, mat, z=.15):
    obj = lathe(name, [(0, radius*.94), (.02, radius), (.035, radius*.96)], mat, 48)
    obj.location = (x, y, z)
    return obj


def ring(x, y, radius, mat, z=.19, thickness=.014):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=thickness,
                                  major_segments=64, minor_segments=8, location=(x, y, z))
    bpy.context.object.data.materials.append(mat)


def text(value, x, y, mat, size=.25):
    curve = bpy.data.curves.new('Printed stable number', 'FONT')
    curve.body = str(value)
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = size
    obj = bpy.data.objects.new('Printed stable number', curve)
    bpy.context.collection.objects.link(obj)
    obj.location = (x, y, .205)
    obj.data.materials.append(mat)


def horse(mat):
    lathe('Turned base', [(0,.24),(.035,.29),(.08,.29),(.11,.25),(.14,.23),(.18,.20)], mat)
    # An extruded knight silhouette, including muzzle, forehead, ears and flowing neck.
    outline = [(-.21,.16),(.20,.16),(.15,.34),(.07,.48),(.17,.59),(.32,.56),
               (.39,.64),(.34,.72),(.17,.84),(.10,.91),(.08,1.04),(.01,.95),
               (-.05,1.02),(-.08,.90),(-.20,.78),(-.23,.59),(-.22,.38)]
    n = len(outline)
    verts = [(x, y, z) for y in (-.105,.105) for x,z in outline]
    faces = [tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh = bpy.data.meshes.new('Horse silhouette')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Sculpted horse', mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Rounded toy edges', 'BEVEL')
    bevel.width, bevel.segments = .045, 4
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    mane = material('Darker mane', tuple(c*.48 for c in mat.diffuse_color[:3]), .42)
    for i in range(7):
        sphere('Mane ridge', (-.20,0,.40+i*.064), (.052,.12,.05), mane, 24, 12)
    eye = material('Black eyes', (.006,.009,.012), .18)
    for y in (-.123,.123):
        sphere('Eye', (.14,y,.79), (.023,.014,.023), eye, 24, 12)
        sphere('Nostril', (.31,y,.66), (.018,.009,.015), eye, 24, 12)


if wanted('board'):
    setup((1664,1664), 6.5, samples=24)
    walnut = wood('Walnut edge', (.045,.018,.012), (.23,.10,.045))
    ivory = wood('Maple playing surface', (.69,.52,.31), (.94,.83,.63))
    cream = material('Ivory insets', (.92,.82,.63), .68, 0)
    rim = material('Engraved outlines', (.28,.16,.09), .65, 0)
    white = material('Stable lettering', (1,.92,.73), .6, 0)
    cube('Thin walnut board', (6.35,6.35,.22), (0,0,-.035), walnut,.10)
    cube('Maple surface', (6.12,6.12,.08), (0,0,.11), ivory,.035)
    mats = [material(name+' enamel', color,.44,.12) for name,color in COLORS]
    segment = [(0,6),(1,6),(2,6),(3,6),(4,6),(5,6),(6,5),(6,4),(6,3),
               (6,2),(6,1),(6,0),(7,0)]
    for color, mat in enumerate(mats):
        # Four paddocks and their sculpted inset rings.
        px, py = xy(*rotate(2.5,2.5,color))
        cube('Colored paddock', (2.22,2.22,.018), (px,py,.166),mat,.12)
        ring(px,py,.98,white,thickness=.01)
        ring(px,py,1.02,white,thickness=.006)
        for x,y in [(1.6,1.6),(3.4,1.6),(1.6,3.4),(3.4,3.4)]:
            x,y = xy(*rotate(x,y,color))
            disk('Paddock rest',x,y,.21,cream)
        for i,(x,y) in enumerate(segment):
            x,y = xy(*rotate(x,y,color))
            disk('Track spot',x,y,.17,mat if i==0 else cream)
            ring(x,y,.17,rim,thickness=.007)
        for number in range(1,7):
            x,y = xy(*rotate(number,7,color))
            cube('Stable square',(.375,.375,.02),(x,y,.175),mat,.035)
            ring(x,y,.157,white,thickness=.005)
            text(number,x,y,white)
        # The center is a four-color pinwheel, outside the playable route.
        coords = [(-.58,.58),(.58,.58),(0,0)]
        verts = []
        for x,y in coords:
            for _ in range(color): x,y=y,-x
            verts.append((x,y,.19))
        mesh=bpy.data.meshes.new('Center quadrant')
        mesh.from_pydata(verts,[],[(0,1,2)])
        obj=bpy.data.objects.new('Center quadrant',mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(mat)
    disk('Center medallion',0,0,.27,rim,z=.195)
    ring(0,0,.24,white,z=.24)
    text('★',0,0,white,.31)
    render('board',ASSETS,OUT)

if wanted('horses'):
    frames=[]
    for name,color in COLORS:
        setup((256,256),1.42,target=(.04,0,.49),camera=(0,-7,12),samples=32)
        horse(material(name+' polished toy',color,.28,.36))
        frame='horse-'+name
        render(frame,ASSETS,OUT,normal=True,webp=False)
        frames.append(frame)
    atlas('horses',frames,ASSETS,OUT,columns=4)

PIPS = {1:[(0,0)],2:[(-1,1),(1,-1)],3:[(-1,1),(0,0),(1,-1)],
        4:[(-1,-1),(-1,1),(1,-1),(1,1)],
        5:[(-1,-1),(-1,1),(0,0),(1,-1),(1,1)],
        6:[(-1,-1),(-1,0),(-1,1),(1,-1),(1,0),(1,1)]}
for value, pips in PIPS.items():
    name='dice-'+str(value)
    if not wanted(name): continue
    setup((320,320),1.55,target=(0,0,.12),camera=(0,-3,12),samples=32)
    ivory=material('Ivory die',(.95,.87,.69),.3,.25)
    ink=material('Recessed pips',(.014,.025,.03),.55,0)
    cube('Rounded die',(1.12,1.12,.40),(0,0,0),ivory,.15,6)
    for x,y in pips:
        sphere('Pip',(x*.285,y*.285,.203),(.081,.081,.018),ink)
    render(name,ASSETS,OUT)

if wanted('button'):
    setup((384,160),3.84, samples=24)
    border=material('Dark honey edge',(.35,.13,.025),.42)
    gold=wood('Honey button',(.64,.32,.05),(.96,.70,.24))
    cube('Button edge',(3.75,1.50,.12),(0,0,0),border,.16,6)
    cube('Button face',(3.58,1.32,.08),(0,0,.10),gold,.13,6)
    render('button',ASSETS,OUT)

if wanted('cloth'):
    cloth_tile('cloth',ASSETS,OUT,(.008,.04,.046))
