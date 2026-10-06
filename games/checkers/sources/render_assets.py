"""Render ridged draughts discs and a floating checkers island with Blender.

Run: blender -b -t 4 --python games/checkers/sources/render_assets.py
PNG intermediates stay in .blender/checkers. Transparent sprites share a 384px canvas and anchor.
"""
from pathlib import Path
import math
import sys
import bpy
from mathutils import Vector
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / '.blender' / 'checkers'
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def material(name, color, roughness=0.32):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Coat Weight'].default_value = 0.22
    return mat


def wood(name, dark, light):
    mat = material(name, light, 0.68)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Coat Weight'].default_value = 0
    shader.inputs['Specular IOR Level'].default_value = 0.12
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    coords = nodes.new('ShaderNodeTexCoord')
    scale = nodes.new('ShaderNodeVectorMath')
    scale.operation = 'MULTIPLY'
    scale.inputs[1].default_value = (3, 0.16, 1)
    links.new(coords.outputs['Generated'], scale.inputs[0])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 12
    noise.inputs['Detail'].default_value = 2
    links.new(scale.outputs[0], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].color = (*light, 1)
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
    return mat


def setup(size, scale, target=(0, 0, 0), camera=(0, 0, 12), transparent=True):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.65, 0.72, 0.8, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.45
    bpy.ops.object.camera_add(location=camera)
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = scale
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    for pos, energy, light_size in [((-3, -4, 7), 520, 4), ((4, 2, 5), 280, 3)]:
        bpy.ops.object.light_add(type='AREA', location=pos)
        lamp = bpy.context.object
        lamp.data.energy, lamp.data.size = energy, light_size
        lamp.rotation_euler = (Vector(target) - lamp.location).to_track_quat('-Z', 'Y').to_euler()


def cube(name, dimensions, position, mat, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new('Soft bevel', 'BEVEL')
    mod.width, mod.segments = bevel, 3
    obj.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    return obj


def lathe(name, profile, mat, segments=96):
    vertices = [(r * math.cos(i * math.tau / segments), r * math.sin(i * math.tau / segments), z)
                for z, r in profile for i in range(segments)]
    faces = []
    for ring in range(len(profile) - 1):
        for i in range(segments):
            a = ring * segments + i
            b = ring * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces += [tuple(reversed(range(segments))), tuple(range((len(profile) - 1) * segments, len(vertices)))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj


def sphere(name, pos, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def render(name):
    bpy.context.scene.render.filepath = str(OUT / f'{name}.png')
    bpy.ops.render.render(write_still=True)
    Image.open(OUT / f'{name}.png').save(ROOT / 'assets' / f'{name}.webp', quality=94, method=6)



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
