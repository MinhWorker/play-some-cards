"""Render the airport's cartoon plane, seen from above, for the flight across the board.

Run from the repository root:
  blender -b -t 4 --python games/co-ty-phu-classic/sources/render_plane.py
(or `python games/co-ty-phu-classic/sources/render_plane.py` with the `bpy` package and Pillow).

Only what shows from above is modelled: the fuselage, wings, tailplane and fin, the cockpit and the
nose. It points right (+x); the game turns it along its path. The editable scene stays in .blender/;
the game-ready WebP goes in assets/plane.webp.
"""

from __future__ import annotations

from pathlib import Path

import bpy
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
PREVIEW = REPO / ".blender"
PNG = PREVIEW / "co-ty-phu-classic-plane.png"
WEBP = ROOT / "assets" / "plane.webp"
SIZE = 512
PREVIEW.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, rgb, roughness=0.35, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    surface = mat.node_tree.nodes["Principled BSDF"]
    surface.inputs["Base Color"].default_value = (*rgb, 1)
    surface.inputs["Roughness"].default_value = roughness
    surface.inputs["Metallic"].default_value = metallic
    surface.inputs["Coat Weight"].default_value = 0.3
    return mat


body = material("Cream body", (0.93, 0.88, 0.78))
red = material("Red wings", (0.55, 0.05, 0.03), roughness=0.45)
glass = material("Cockpit glass", (0.08, 0.32, 0.55), roughness=0.05)
gold = material("Brass nose", (0.85, 0.55, 0.12), roughness=0.25, metallic=0.8)


def smooth(obj, mat):
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def ellipsoid(name, location, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return smooth(obj, mat)


def slab(name, outline, thickness, z, mat):
    """A flat, bevelled plate from a top-view outline (x, y points, counter-clockwise)."""
    verts = [(x, y, z - thickness / 2) for x, y in outline] + [
        (x, y, z + thickness / 2) for x, y in outline
    ]
    n = len(outline)
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bevel = obj.modifiers.new("Rounded edges", "BEVEL")
    bevel.width = thickness * 0.45
    bevel.segments = 4
    return smooth(obj, mat)


def mirrored(points):
    """A left-right symmetric outline from its upper half (nose to tail along +y)."""
    return points + [(x, -y) for x, y in reversed(points)]


ellipsoid("Fuselage", (0, 0, 0), (2.0, 0.42, 0.38), body)
ellipsoid("Cockpit", (0.75, 0, 0.26), (0.55, 0.26, 0.18), glass)
ellipsoid("Nose", (1.98, 0, 0), (0.22, 0.22, 0.22), gold)
slab(
    "Wings",
    mirrored([(0.55, 0.0), (0.45, 1.6), (0.2, 2.45), (-0.15, 2.5), (-0.45, 1.6), (-0.6, 0.0)]),
    0.12,
    0.02,
    red,
)
slab(
    "Tailplane",
    mirrored([(-1.45, 0.0), (-1.55, 0.6), (-1.75, 0.95), (-1.98, 0.95), (-2.0, 0.0)]),
    0.08,
    0.1,
    red,
)
slab("Fin", [(-1.4, 0.03), (-2.05, 0.03), (-2.05, -0.03), (-1.4, -0.03)], 0.5, 0.35, red)
# The propeller, a blur of two blades across the nose.
slab("Propeller", [(2.12, 0.75), (2.18, 0.75), (2.18, -0.75), (2.12, -0.75)], 0.04, 0.0, gold)

# Soft studio light from the upper left, so the top reads bright and the edges round off.
bpy.ops.object.light_add(type="SUN", location=(-3, 3, 10))
sun = bpy.context.object
sun.data.energy = 3.2
sun.rotation_euler = (0.35, -0.35, 0)
bpy.ops.object.light_add(type="AREA", location=(2, -3, 6))
fill = bpy.context.object
fill.data.energy = 300
fill.data.size = 6

bpy.ops.object.camera_add(location=(0, 0, 10))
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 5.4
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.world.color = (0.45, 0.45, 0.45)
# A dark cartoon outline round every part.
scene.render.use_freestyle = True
scene.render.line_thickness = 2.2
lineset = scene.view_layers[0].freestyle_settings.linesets[0]
lineset.linestyle.color = (0.23, 0.13, 0.07)
scene.render.filepath = str(PNG)
bpy.ops.wm.save_as_mainfile(filepath=str(PREVIEW / "co-ty-phu-classic-plane.blend"))
bpy.ops.render.render(write_still=True)
Image.open(PNG).save(WEBP, "WEBP", quality=92)
print(f"Wrote {WEBP}")
