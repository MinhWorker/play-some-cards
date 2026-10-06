"""Top-down kaya board and polished stone assets, with matching upper-left lighting.

Run from the repo root: blender -b -t 4 --python games/go/sources/render_assets.py
Raw renders stay in .blender/go; app-ready WebP files are written to assets/.
"""

from pathlib import Path
import sys

import bpy
from PIL import Image
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / ".blender" / "go"
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def material(name, color, roughness=0.4):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    return mat


def wood(name, dark, light):
    mat = material(name, light, 0.48)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    coords = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeVectorMath")
    mapping.operation = "MULTIPLY"
    mapping.inputs[1].default_value = (5.5, 0.24, 1)
    links.new(coords.outputs["Generated"], mapping.inputs[0])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18
    noise.inputs["Detail"].default_value = 3
    noise.inputs["Roughness"].default_value = 0.65
    links.new(mapping.outputs[0], noise.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = 0.82
    ramp.color_ramp.elements[1].color = (*light, 1)
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.14
    bump.inputs["Distance"].default_value = 0.008
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


def cube(name, size, z, mat, bevel):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new("Soft milled edge", "BEVEL")
    mod.width, mod.segments = bevel, 5
    obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return obj


def setup(width, height, scale, transparent=True):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.7, 0.75, 0.8, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    bpy.ops.object.camera_add(location=(0, 0, 12))
    camera = bpy.context.object
    camera.data.type, camera.data.ortho_scale = "ORTHO", scale
    camera.rotation_euler = (0, 0, 0)
    scene.camera = camera
    for position, energy, size in [((-3, 4, 7), 650, 4), ((4, -2, 6), 100, 5)]:
        bpy.ops.object.light_add(type="AREA", location=position)
        light = bpy.context.object
        light.data.energy, light.data.shape, light.data.size = energy, "DISK", size
        light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()


def render(name):
    if SELECTED and name not in SELECTED:
        return
    bpy.context.scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    Image.open(OUT / f"{name}.png").save(ROOT / "assets" / f"{name}.webp", quality=94, method=6)


setup(1600, 1600, 10.02)
kaya = wood("Kaya straight grain", (0.32, 0.105, 0.020), (0.66, 0.295, 0.065))
edge = wood("Thin warm bevel", (0.24, 0.105, 0.029), (0.50, 0.27, 0.087))
cube("One-piece board", (10, 10, 0.18), 0, edge, 0.055)
cube("Kaya playing surface, no printed lines", (9.82, 9.82, 0.07), 0.087, kaya, 0.025)
render("board")

for name, color in [("stone-black", (0.003, 0.004, 0.006)), ("stone-white", (0.90, 0.865, 0.76))]:
    setup(320, 320, 2.19)
    mat = material(name, color, 0.29 if name.endswith("black") else 0.35)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Coat Weight"].default_value = 0.18
    shader.inputs["Coat Roughness"].default_value = 0.3
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 150
    noise.inputs["Detail"].default_value = 2
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.11
    bump.inputs["Distance"].default_value = 0.005
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=1, location=(0, 0, 0.22))
    stone = bpy.context.object
    stone.scale.z = 0.38
    stone.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    render(name)

setup(2560, 1800, 2, False)
bpy.context.scene.cycles.samples = 8
cloth = material("Forest teal woven cloth", (0.022, 0.073, 0.069), 0.95)
nodes, links = cloth.node_tree.nodes, cloth.node_tree.links
shader = nodes.get("Principled BSDF")
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 240
noise.inputs["Detail"].default_value = 2
ramp = nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.001, 0.008, 0.006, 1)
ramp.color_ramp.elements[1].color = (0.008, 0.03, 0.02, 1)
links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.3
bump.inputs["Distance"].default_value = 0.004
links.new(noise.outputs["Fac"], bump.inputs["Height"])
links.new(bump.outputs["Normal"], shader.inputs["Normal"])
cube("Cloth", (2.1, 2.1, 0.01), 0, cloth, 0)
render("cloth")

setup(512, 208, 4.06)
rim = material("Button thin amber edge", (0.47, 0.235, 0.055), 0.4)
button = wood("Walnut button", (0.08, 0.022, 0.005), (0.20, 0.07, 0.016))
cube("Button outline", (4, 1.57, 0.16), 0, rim, 0.14)
cube("Button face", (3.89, 1.46, 0.10), 0.1, button, 0.12)
render("button")
