"""Render open woven Go bowls and inside-up lids, lit like the existing board.

npm run blender -- go bowl bowl-lid
The client animates these separate props and the existing polished stone sprites.
"""

from math import cos, sin, pi
from pathlib import Path
import sys
from functools import partial

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "blender"))
from xomdao_bake import material, lathe, setup, render as bake

import bpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / ".blender" / "go"
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
render = partial(bake, assets=ROOT / "assets", out=OUT, selected=SELECTED)


def wicker(name, color):
    mat = material(name, color, 0.66, coat=0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
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


for name, depth in [("bowl", 0.72), ("bowl-lid", 0.20)]:
    if SELECTED and name not in SELECTED:
        continue
    # The bowls' own rig: go's disks with a softer fill and a dimmer world.
    setup((768, 768), 2.65, samples=40, lights=(((-3, 4, 7), 650, 4), ((4, -2, 6), 80, 5)),
          light_shape="DISK", world=((0.72, 0.78, 0.83), 0.25))
    fibers = [wicker(f"Natural rattan {i}", color) for i, color in enumerate([
        (0.43, 0.25, 0.105), (0.58, 0.36, 0.17), (0.68, 0.46, 0.25), (0.76, 0.55, 0.32)])]
    base = wicker("Warm woven backing", (0.40, 0.22, 0.09))
    floor = 0.10
    inner_base = 0.61 if name == "bowl" else 0.87
    inner_top = 0.96
    profile = [(0, floor - 0.035), (inner_base, floor - 0.035), (inner_top, depth - 0.04),
           (1.04, depth - 0.03), (0.66 if name == "bowl" else 0.96, 0), (0, 0)]
    lathe("Woven vessel core", [(z, radius) for radius, z in profile], base, segments=128)
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
    render(name)
