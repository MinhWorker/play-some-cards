"""Run with Python+bpy or blender -b --python tools/blender/test_bake.py."""
from pathlib import Path
import tempfile
import unittest
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy
from PIL import Image
from xomdao_bake import cube, material, render, setup, sphere


class NormalBakeTest(unittest.TestCase):
    def test_raw_flat_normal_and_render_state(self):
        with tempfile.TemporaryDirectory() as directory:
            setup((64, 64), 2)
            cube('Facing the camera', (1.8, 1.8, 0.1), (0, 0, 0), material('Ivory', (1, 1, 1)), 0)
            render('flat', directory, directory, normal=True)
            with Image.open(Path(directory) / 'flat.normal.webp') as normal:
                # Opaque: a premultiplied upload of image alpha would shrink edge normals.
                self.assertEqual(normal.mode, 'RGB')
                self.assertEqual(normal.getpixel((32, 32)), (128, 128, 255))
                with Image.open(Path(directory) / 'flat.webp') as diffuse:
                    self.assertEqual(diffuse.size, normal.size)
            self.assertEqual(bpy.context.scene.view_settings.view_transform, 'AgX')
            self.assertIsNone(bpy.context.view_layer.material_override)

    def test_right_and_upper_surface_normals(self):
        with tempfile.TemporaryDirectory() as directory:
            setup((64, 64), 2.2)
            sphere('Curved surface', (0, 0, 0), (1, 1, 1), material('Ivory', (1, 1, 1)))
            render('sphere', directory, directory, normal=True)
            with Image.open(Path(directory) / 'sphere.normal.webp') as normal:
                self.assertLess(normal.getpixel((16, 32))[0], 128)
                self.assertGreater(normal.getpixel((48, 32))[0], 128)
                self.assertGreater(normal.getpixel((32, 16))[1], 128)
                self.assertGreater(normal.getpixel((32, 32))[2], 250)
                # Empty canvas reads as the flat normal, not black.
                self.assertEqual(normal.getpixel((0, 0)), (128, 128, 255))


if __name__ == '__main__':
    unittest.main(argv=[__file__])
