"""Top-down kaya board and polished stone assets, with matching upper-left lighting.

Run from the repo root: npm run blender -- go [board stone-white cloth]
Raw renders stay in .blender/go; app-ready WebP files are written to assets/.
"""

from pathlib import Path
import sys

import bpy
from functools import partial

# Shared helpers resolve identically in Blender and Python with the bpy wheel.
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "blender"))
from psc_bake import cube, sphere, cloth_tile, render as bake
from psc_bake import material as base_material, setup as base_setup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / ".blender" / "go"
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
render = partial(bake, assets=ROOT / "assets", out=OUT, selected=SELECTED)
# Go's own rig: two soft disks and a cooler, dimmer world than the shared one.
GO_RIG = (((-3, 4, 7), 650, 4), ((4, -2, 6), 100, 5))
setup = partial(base_setup, lights=GO_RIG, light_shape="DISK", world=((0.7, 0.75, 0.8), 0.35))


def plain(name, color, roughness=0.4):
    return base_material(name, color, roughness, coat=0)


def kaya(name, dark, light):
    """Long straight grain with a faint bump, finer than the shared wood."""
    mat = plain(name, light, 0.48)
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


setup((1600, 1600), 10.02)
surface = kaya("Kaya straight grain", (0.32, 0.105, 0.020), (0.66, 0.295, 0.065))
edge = kaya("Thin warm bevel", (0.24, 0.105, 0.029), (0.50, 0.27, 0.087))
cube("One-piece board", (10, 10, 0.18), (0, 0, 0), edge, 0.055, segments=5)
cube("Kaya playing surface, no printed lines", (9.82, 9.82, 0.07), (0, 0, 0.087), surface, 0.025, segments=5)
render("board")

for name, color in [("stone-black", (0.003, 0.004, 0.006)), ("stone-white", (0.90, 0.865, 0.76))]:
    setup((320, 320), 2.19)
    mat = plain(name, color, 0.29 if name.endswith("black") else 0.35)
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
    sphere("Polished stone", (0, 0, 0.22), (1, 1, 0.38), mat, segments=96, rings=48)
    render(name)

if not SELECTED or "cloth" in SELECTED:
    cloth_tile("cloth", ROOT / "assets", OUT, (0.007, 0.024, 0.020))

setup((512, 208), 4.06)
rim = plain("Button thin amber edge", (0.47, 0.235, 0.055), 0.4)
button = kaya("Walnut button", (0.08, 0.022, 0.005), (0.20, 0.07, 0.016))
cube("Button outline", (4, 1.57, 0.16), (0, 0, 0), rim, 0.14, segments=5)
cube("Button face", (3.89, 1.46, 0.10), (0, 0, 0.1), button, 0.12, segments=5)
render("button")
