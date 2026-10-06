"""Render consistent Staunton sprites and an exact 8x8 board with Blender.

Run: blender -b -t 4 --python games/chess/sources/render_assets.py [-- board piece-white-knight]
PNG intermediates stay in .blender/chess. Transparent sprites share a 384px canvas and anchor.
"""
from pathlib import Path
import math
import sys
import bpy
from mathutils import Vector
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / '.blender' / 'chess'
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
    scene.cycles.samples = 24
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
        head = lathe('Bishop mitre', [(h, 0.13), (h + 0.11, 0.24), (h + 0.26, 0.23),
                    (h + 0.43, 0.06), (h + 0.46, 0.025)], mat)
        cut = cube('Mitre slit cutter', (0.075, 0.8, 0.42), (0.065, 0, h + 0.36), mat, 0)
        cut.rotation_euler.y = -0.48
        mod = head.modifiers.new('Diagonal mitre slit', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = cut
        bpy.context.view_layer.objects.active = head
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cut, do_unlink=True)
        sphere('Bishop finial', (0, 0, h + 0.48), (0.06,) * 3, mat)
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
    setup((1800, 1800), 10)
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

for side, color in [('white', (0.82, 0.76, 0.61)), ('black', (0.018, 0.025, 0.035))]:
    for kind in ('king', 'queen', 'rook', 'bishop', 'knight', 'pawn'):
        name = f'piece-{side}-{kind}'
        if SELECTED and name not in SELECTED:
            continue
        setup((384, 384), 1.85, target=(0, 0, 0.6), camera=(0, -4.5, 12))
        mat = material(f'{side} satin stone', color)
        trim = material('Subtle warm base inlay', (0.35, 0.20, 0.06), 0.36)
        eye = material('Horse eye', (0.035, 0.025, 0.012) if side == 'white' else (0.65, 0.40, 0.12))
        piece(kind, mat, trim, eye)
        render(name)

if not SELECTED or 'cloth' in SELECTED:
    setup((2560, 1800), 2, transparent=False)
    bpy.context.scene.cycles.samples = 8
    cloth = material('Midnight blue woven cloth', (0.008, 0.022, 0.041), 0.97)
    nodes, links = cloth.node_tree.nodes, cloth.node_tree.links
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 280
    noise.inputs['Detail'].default_value = 2
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.22
    bump.inputs['Distance'].default_value = 0.003
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], nodes.get('Principled BSDF').inputs['Normal'])
    cube('Quiet cloth', (3, 3, 0.01), (0, 0, 0), cloth, 0)
    render('cloth')
