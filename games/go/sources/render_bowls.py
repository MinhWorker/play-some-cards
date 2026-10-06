"""Render open woven Go bowls and inside-up lids, lit like the existing board.

blender -b -t 4 --python games/go/sources/render_bowls.py
The client animates these separate props and the existing polished stone sprites.
"""

from math import cos, sin, pi
from pathlib import Path

import bpy
from PIL import Image
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / ".blender" / "go"
OUT.mkdir(parents=True, exist_ok=True)


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.66
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 170
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.18
    bump.inputs["Distance"].default_value = 0.007
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


def strand(name, points, radius, mat):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    line = curve.splines.new("POLY")
    line.points.add(len(points) - 1)
    for point, xyz in zip(line.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)


def ring(name, radius, z, thickness, mat, wave=0):
    points = []
    for i in range(257):
        angle = i * 2 * pi / 256
        points.append((radius * cos(angle), radius * sin(angle), z + wave * sin(angle * 48)))
    strand(name, points, thickness, mat)


def shell(profile, mat):
    vertices, faces = [], []
    steps = 128
    for radius, z in profile:
        vertices.extend((radius * cos(i * 2 * pi / steps), radius * sin(i * 2 * pi / steps), z)
                        for i in range(steps))
    for row in range(len(profile) - 1):
        for i in range(steps):
            a = row * steps + i
            b = row * steps + (i + 1) % steps
            faces.append((a, b, b + steps, a + steps))
    mesh = bpy.data.meshes.new("Woven vessel core")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Woven vessel core", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in mesh.polygons:
        face.use_smooth = True


def setup():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 40
    scene.cycles.use_denoising = False
    scene.render.resolution_x = scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.72, 0.78, 0.83, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.25
    bpy.ops.object.camera_add(location=(0, 0, 12))
    camera = bpy.context.object
    camera.data.type, camera.data.ortho_scale = "ORTHO", 2.65
    camera.rotation_euler = (0, 0, 0)
    scene.camera = camera
    for position, energy, size in [((-3, 4, 7), 650, 4), ((4, -2, 6), 80, 5)]:
        bpy.ops.object.light_add(type="AREA", location=position)
        light = bpy.context.object
        light.data.energy, light.data.shape, light.data.size = energy, "DISK", size
        light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()


for name, depth in [("bowl", 0.72), ("bowl-lid", 0.20)]:
    setup()
    fibers = [material(f"Natural rattan {i}", color) for i, color in enumerate([
        (0.43, 0.25, 0.105), (0.58, 0.36, 0.17), (0.68, 0.46, 0.25), (0.76, 0.55, 0.32)])]
    base = material("Warm woven backing", (0.40, 0.22, 0.09))
    floor = 0.10
    inner_base = 0.61 if name == "bowl" else 0.87
    inner_top = 0.96
    shell([(0, floor - 0.035), (inner_base, floor - 0.035), (inner_top, depth - 0.04),
           (1.04, depth - 0.03), (0.66 if name == "bowl" else 0.96, 0), (0, 0)], base)
    # Woven circular base. Crossing radial reeds alternate above and below the coil.
    for i in range(1, int(inner_base / 0.028) + 1):
        ring(f"Base coil {i}", i * 0.028, floor, 0.016, fibers[i % 4], 0.003)
    for i in range(96):
        angle = i * 2 * pi / 96
        points = []
        for j in range(40):
            r = 0.035 + (inner_base - 0.035) * j / 39
            points.append((r * cos(angle), r * sin(angle), floor + 0.012 * sin(r * pi / 0.028 + i * pi)))
        strand(f"Base crossing {i}", points, 0.009, fibers[(i + 1) % 4])
    # Closely interlaced rings and vertical reeds on both sides of the curved wall.
    courses = 25 if name == "bowl" else 7
    for outer in [False, True]:
        for j in range(courses):
            t = (j + 0.5) / courses
            radius = inner_base + (inner_top - inner_base) * t + (0.065 if outer else 0)
            ring(f"Wall course {outer} {j}", radius, floor + (depth - floor) * t,
                 0.018, fibers[(j + int(outer)) % 4], 0.008)
        for i in range(96):
            angle = i * 2 * pi / 96
            points = []
            for j in range(65):
                t = j / 64
                radius = inner_base + (inner_top - inner_base) * t + (0.065 if outer else 0)
                radius += 0.012 * sin(t * courses * pi * 2 + i * pi)
                points.append((radius * cos(angle), radius * sin(angle), floor + (depth - floor) * t))
            strand(f"Wall reed {outer} {i}", points, 0.013, fibers[(i + 2) % 4])
    for j in range(4):
        ring(f"Bound lip {j}", 0.96 + j * 0.028, depth + 0.006 * sin(j * pi / 3), 0.023, fibers[(j + 1) % 4])
    for i in range(192):
        angle = i * 2 * pi / 192
        points = []
        for j in range(17):
            a = j * 2 * pi / 16
            r = 1.005 + 0.058 * cos(a)
            points.append((r * cos(angle), r * sin(angle), depth + 0.026 * sin(a)))
        strand(f"Lip lashing {i}", points, 0.006, fibers[i % 4])
    bpy.context.scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    Image.open(OUT / f"{name}.png").save(ROOT / "assets" / f"{name}.webp", quality=94, method=6)
