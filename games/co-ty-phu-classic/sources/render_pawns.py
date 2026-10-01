"""Render four angled enamel pawns for the 2.5D board.

Run from the repository root:
  blender -b -t 4 --python games/co-ty-phu-classic/sources/render_pawns.py

The editable Blender scene and PNG previews stay in .blender/; game-ready WebP files go in assets/.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
PREVIEW = REPO / ".blender"
ASSETS = ROOT / "assets"
PREVIEW.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, rgba, metallic=0.0, roughness=0.28):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgba, 1)
    mat.use_nodes = True
    surface = mat.node_tree.nodes.get("Principled BSDF")
    surface.inputs["Base Color"].default_value = (*rgba, 1)
    surface.inputs["Metallic"].default_value = metallic
    surface.inputs["Roughness"].default_value = roughness
    surface.inputs["Coat Weight"].default_value = 0.38
    surface.inputs["Coat Roughness"].default_value = 0.14
    return mat


brass = material("Warm brass rings", (0.63, 0.37, 0.09), 0.72, 0.22)
ivory = material("Ivory inlay", (0.93, 0.82, 0.61), 0.1, 0.25)
colors = [
    ("red", (0.72, 0.105, 0.075)),
    ("blue", (0.075, 0.28, 0.65)),
    ("green", (0.06, 0.42, 0.20)),
    ("yellow", (0.90, 0.56, 0.04)),
]
enamel = material("Colored enamel", colors[0][1], 0.2, 0.18)


def lathe(name, profile, mat):
    sides = 48
    verts = [
        (radius * math.cos(2 * math.pi * side / sides),
         radius * math.sin(2 * math.pi * side / sides), z)
        for radius, z in profile
        for side in range(sides)
    ]
    faces = []
    for ring in range(len(profile) - 1):
        for side in range(sides):
            next_side = (side + 1) % sides
            a = ring * sides + side
            b = ring * sides + next_side
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(profile) - 1) * sides + side for side in range(sides)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


lathe("Sculpted pawn body", [
    (0.0, 0.03), (0.42, 0.03), (0.50, 0.055), (0.55, 0.10),
    (0.55, 0.16), (0.50, 0.22), (0.39, 0.28), (0.32, 0.35),
    (0.26, 0.48), (0.22, 0.67), (0.20, 0.86), (0.24, 0.99),
    (0.30, 1.05), (0.31, 1.10), (0.26, 1.15), (0.0, 1.17),
], enamel)

for name, major, minor, z, mat in [
    ("Brass foot", 0.525, 0.024, 0.155, brass),
    ("Ivory foot line", 0.455, 0.016, 0.245, ivory),
    ("Brass collar", 0.29, 0.022, 1.08, brass),
]:
    bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=12,
                                     location=(0, 0, z), major_radius=major, minor_radius=minor)
    bpy.context.object.name = name
    bpy.context.object.data.materials.append(mat)
    for face in bpy.context.object.data.polygons:
        face.use_smooth = True

bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=0.34,
                                     location=(0, 0, 1.43))
head = bpy.context.object
head.name = "Enamel pawn head"
head.data.materials.append(enamel)
for face in head.data.polygons:
    face.use_smooth = True

# Match the board camera's direction while keeping the pawn centered in its sprite crop.
bpy.ops.object.camera_add(location=(0, -5.7, 9.46))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 0.78)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.15
bpy.context.scene.camera = camera

for name, position, energy, size in [
    ("large warm key", (-3.5, -4.0, 7.0), 500, 4.0),
    ("cool rim", (2.0, 3.0, 5.0), 340, 3.0),
]:
    bpy.ops.object.light_add(type="AREA", location=position)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 256
scene.render.resolution_y = 320
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "Standard"
scene.world.color = (0.32, 0.32, 0.32)

blend = PREVIEW / "co-ty-phu-classic-pawns.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend))

for name, rgb in colors:
    enamel.diffuse_color = (*rgb, 1)
    enamel.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (*rgb, 1)
    png = PREVIEW / f"pawn-{name}.png"
    webp = ASSETS / f"pawn-{name}.webp"
    scene.render.filepath = str(png)
    bpy.ops.render.render(write_still=True)
    Image.open(png).crop((32, 32, 224, 288)).save(webp, "WEBP", quality=94, method=6)
    print(f"Rendered {webp}")
