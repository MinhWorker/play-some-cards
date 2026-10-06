"""Shared Blender sprite baking. Works with Blender's Python or the PyPI bpy module.

Normal maps are camera-space (+X right, +Y up, +Z toward the viewer), stored raw,
losslessly, with the same size and alpha as their diffuse image. No sRGB conversion.
"""
import math
import json
from pathlib import Path

import bpy
from mathutils import Vector
from PIL import Image


# World +Y projects toward the top of the board; the key is upper-left.
LIGHT_RIG = (((-3, 4, 7), 520, 4), ((4, -2, 5), 180, 3))


def material(name, color, roughness=0.32):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
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
    links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    return mat


def cube(name, dimensions, position, mat, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft bevel', 'BEVEL')
        mod.width, mod.segments = bevel, 3
        obj.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    return obj


def sphere(name, pos, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
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
    faces += [tuple(reversed(range(segments))),
              tuple(range((len(profile) - 1) * segments, len(vertices)))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj


def setup(size, scale, target=(0, 0, 0), camera=(0, 0, 12), transparent=True, samples=24):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Free data from the preceding bake when rendering a whole set in one process.
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.dither_intensity = 0
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.65, 0.72, 0.8, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.45
    bpy.ops.object.camera_add(location=camera)
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = scale
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    for pos, energy, light_size in LIGHT_RIG:
        bpy.ops.object.light_add(type='AREA', location=pos)
        lamp = bpy.context.object
        lamp.data.energy, lamp.data.size = energy, light_size
        lamp.rotation_euler = (Vector(target) - lamp.location).to_track_quat('-Z', 'Y').to_euler()


def normal_material():
    mat = bpy.data.materials.new('Raw camera-space normals')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    geometry = nodes.new('ShaderNodeNewGeometry')
    camera = nodes.new('ShaderNodeVectorTransform')
    camera.vector_type = 'NORMAL'
    camera.convert_from, camera.convert_to = 'WORLD', 'CAMERA'
    links.new(geometry.outputs['Normal'], camera.inputs['Vector'])
    encode = nodes.new('ShaderNodeVectorMath')
    encode.operation = 'MULTIPLY_ADD'
    # Blender's shader CAMERA space points +Z into the screen; Phaser expects +Z out.
    encode.inputs[1].default_value = (0.5, 0.5, -0.5)
    encode.inputs[2].default_value = (0.5, 0.5, 0.5)
    links.new(camera.outputs['Vector'], encode.inputs[0])
    emission = nodes.new('ShaderNodeEmission')
    links.new(encode.outputs['Vector'], emission.inputs['Color'])
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(emission.outputs['Emission'], output.inputs['Surface'])
    return mat


def render(name, assets, out, normal=False, selected=()):
    if selected and name not in selected:
        return
    assets, out = Path(assets), Path(out)
    assets.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.filepath = str(out / f'{name}.png')
    bpy.ops.render.render(write_still=True)
    with Image.open(scene.render.filepath) as diffuse:
        diffuse.save(assets / f'{name}.webp', quality=94, method=6)
        alpha = diffuse.getchannel('A').copy()
    if not normal:
        return
    view_layer = bpy.context.view_layer
    previous = view_layer.material_override
    transform = scene.view_settings.view_transform
    samples = scene.cycles.samples
    filepath = scene.render.filepath
    override = normal_material()
    try:
        view_layer.material_override = override
        # Standard still applies the sRGB transfer curve. Raw writes encoded vectors directly.
        scene.view_settings.view_transform = 'Raw'
        scene.cycles.samples = 8
        scene.render.filepath = str(out / f'{name}.normal.png')
        bpy.ops.render.render(write_still=True)
        with Image.open(scene.render.filepath) as normals:
            normals = normals.convert('RGBA')
            normals.putalpha(alpha)
            normals.save(assets / f'{name}.normal.webp', lossless=True, exact=True, method=6)
    finally:
        view_layer.material_override = previous
        scene.view_settings.view_transform = transform
        scene.cycles.samples = samples
        scene.render.filepath = filepath
        bpy.data.materials.remove(override)


def cloth_tile(name, assets, out, color):
    """A seamless 256px POT weave. Emission avoids a baked light gradient at tile edges."""
    setup((256, 256), 2, transparent=False, samples=8)
    mat = bpy.data.materials.new('Seamless woven cloth')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    coords = nodes.new('ShaderNodeTexCoord')
    waves = []
    for axis in ('X', 'Y'):
        wave = nodes.new('ShaderNodeTexWave')
        wave.bands_direction = axis
        # Wave Texture's phase is 20 * scale * coordinate: exactly 64 periods per tile.
        wave.inputs['Scale'].default_value = math.tau * 64 / 20 * 1.01
        links.new(coords.outputs['Generated'], wave.inputs['Vector'])
        waves.append(wave)
    mix = nodes.new('ShaderNodeMath')
    mix.operation = 'MULTIPLY'
    links.new(waves[0].outputs['Fac'], mix.inputs[0])
    links.new(waves[1].outputs['Fac'], mix.inputs[1])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*(c * 0.93 for c in color), 1)
    ramp.color_ramp.elements[1].color = (*(c * 1.07 for c in color), 1)
    links.new(mix.outputs[0], ramp.inputs['Fac'])
    emission = nodes.new('ShaderNodeEmission')
    links.new(ramp.outputs['Color'], emission.inputs['Color'])
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(emission.outputs['Emission'], output.inputs['Surface'])
    # Overscan: camera-edge pixels must not sample the world or the side of the cube.
    cube('Cloth tile', (2.02, 2.02, 0.01), (0, 0, 0), mat, 0)
    render(name, assets, out)


def atlas(name, frames, assets, out, columns=4):
    """Pack aligned diffuse/normal canvases into one pair, avoiding lit texture switches."""
    assets, out = Path(assets), Path(out)
    padding = 4
    with Image.open(out / f'{frames[0]}.png') as first:
        width, height = first.size
    cell_w, cell_h = width + padding * 2, height + padding * 2
    size = (columns * cell_w, math.ceil(len(frames) / columns) * cell_h)
    diffuse = Image.new('RGBA', size)
    normals = Image.new('RGBA', size, (128, 128, 255, 0))
    metadata = {}
    for index, frame in enumerate(frames):
        x, y = (index % columns) * cell_w + padding, (index // columns) * cell_h + padding
        with Image.open(out / f'{frame}.png') as image, Image.open(out / f'{frame}.normal.png') as normal:
            if image.size != (width, height) or normal.size != image.size:
                raise ValueError(f'Atlas frame size differs: {frame}')
            normal = normal.convert('RGBA')
            normal.putalpha(image.getchannel('A'))
            diffuse.paste(image, (x, y))
            normals.paste(normal, (x, y))
        metadata[frame] = {'frame': {'x': x, 'y': y, 'w': width, 'h': height},
                           'rotated': False, 'trimmed': False,
                           'spriteSourceSize': {'x': 0, 'y': 0, 'w': width, 'h': height},
                           'sourceSize': {'w': width, 'h': height}}
    assets.mkdir(parents=True, exist_ok=True)
    diffuse.save(assets / f'{name}.webp', quality=94, method=6)
    normals.save(assets / f'{name}.normal.webp', lossless=True, exact=True, method=6)
    (assets / f'{name}.json').write_text(json.dumps({'frames': metadata}, indent=2) + '\n')
