"""Bake parchment and red-lacquer xiangqi buttons with walnut frames for nine-slice UI.

Run: npm run blender -- xiangqi button-draw button-resign.
Text stays in Phaser so offer/accept draw and surrender confirmation share the same assets.
"""
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'tools' / 'blender'))
from xomdao_bake import cube, material, render, setup, wood

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / '.blender' / 'xiangqi'
SELECTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

for name in ('button-draw', 'button-resign'):
    if SELECTED and name not in SELECTED:
        continue
    setup((640, 200), 4.16, samples=32)
    frame = wood('Walnut button frame', (0.065, 0.023, 0.011), (0.21, 0.078, 0.026))
    brass = material('Aged brass hairline', (0.49, 0.29, 0.08), 0.65, 0)
    if name == 'button-draw':
        face = material('Warm parchment', (0.78, 0.68, 0.48), 0.9, 0)
        shader = face.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Specular IOR Level'].default_value = 0.08
        nodes, links = face.node_tree.nodes, face.node_tree.links
        grain = nodes.new('ShaderNodeTexNoise')
        grain.inputs['Scale'].default_value = 90
        grain.inputs['Detail'].default_value = 2
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.15
        bump.inputs['Distance'].default_value = 0.005
        links.new(grain.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    else:
        face = material('Deep cinnabar lacquer', (0.23, 0.017, 0.012), 0.55, 0.09)
    cube('Walnut frame', (3.96, 1.13, 0.12), (0, 0, 0), frame, 0.035, 2)
    cube('Fine brass inset', (3.82, 0.99, 0.022), (0, 0, 0.063), brass, 0.025, 2)
    cube('Inset face', (3.77, 0.94, 0.032), (0, 0, 0.08), face, 0.02, 2)
    # Square fret corners echo the board and paper scroll; the nine-slice preserves them.
    for sx in (-1, 1):
        for sy in (-1, 1):
            cube('Fret horizontal', (0.17, 0.012, 0.008),
                 (sx * 1.71, sy * 0.375, 0.1), brass, 0)
            cube('Fret vertical', (0.012, 0.13, 0.008),
                 (sx * 1.79, sy * 0.315, 0.1), brass, 0)
    render(name, ROOT / 'assets', OUT)
