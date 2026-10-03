"""Render the classic board at a fixed camera angle and export matching tile coordinates.

Run from the repository root:
  blender -b -t 4 --python games/co-ty-phu-classic/sources/render_board_25d.py
"""

from __future__ import annotations

import json
from pathlib import Path

import bpy
from PIL import Image, ImageDraw, ImageFilter
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "board.webp"
PNG = ROOT.parents[1] / ".blender" / "co-ty-phu-classic-board.png"
PRINT = ROOT.parents[1] / ".blender" / "co-ty-phu-classic-board-print.png"
WEBP = ROOT / "assets" / "board-25d.webp"
GEOMETRY = ROOT / "src" / "scenes" / "boardGeometry.ts"
BLEND = ROOT.parents[1] / ".blender" / "co-ty-phu-classic-board.blend"
WIDTH, HEIGHT = 1400, 1200
CROP_X, CROP_Y, CROP_WIDTH, CROP_HEIGHT = 35, 145, 1330, 1045
INK = (63, 49, 38, 255)
GROUP_COLORS = {
    "nau": (137, 81, 53, 255),
    "xanh-nhat": (115, 196, 223, 255),
    "hong": (224, 123, 186, 255),
    "cam": (232, 155, 67, 255),
    "do": (205, 82, 73, 255),
    "vang": (233, 206, 99, 255),
    "xanh-la": (93, 169, 104, 255),
    "xanh-dam": (65, 111, 189, 255),
}
# The players' panel: the tile ring widened into the field's upper part, with sockets the game
# fills in (the turn player's picture, name, cash and clock; each seat's ball and cash). In board
# units (0–1 across the printed board); exported with the projection to boardGeometry.ts.
FIELD = (0.18, 0.18, 0.82, 0.79)  # the inner field's edges: left, top, right, bottom
PANEL_BOTTOM = 0.412  # where the field now starts
PANEL = {
    "avatar": {"u": 0.262, "v": 0.296, "r": 0.058},
    "name": {"u": 0.34, "v": 0.243},
    "cash": {"u": 0.34, "v": 0.292},
    "bar": {"u0": 0.34, "u1": 0.565, "v": 0.344, "h": 0.016},
    "rule": {"u": 0.589, "v0": 0.2, "v1": 0.392},
    "seats": [{"u": 0.618, "v": round(0.217 + i * 0.0485, 4), "r": 0.019} for i in range(4)],
    "seatCash": {"u": 0.646},
    "field": {"top": PANEL_BOTTOM, "bottom": FIELD[3]},
}
INLAY = {"ring": (215, 164, 67, 255), "edge": (107, 58, 16, 255), "shine": (246, 216, 140, 255), "well": (201, 180, 140, 255), "deep": (74, 56, 40, 255)}

# Keep this order and the group colors in sync with BOARD and GROUP_COLORS in game/model.ts.
SQUARES = [
    ("start", None),
    ("street", "nau"),
    ("chest", None),
    ("street", "nau"),
    ("tax", None),
    ("station", None),
    ("street", "xanh-nhat"),
    ("chance", None),
    ("street", "xanh-nhat"),
    ("street", "xanh-nhat"),
    ("jail", None),
    ("street", "hong"),
    ("power", None),
    ("street", "hong"),
    ("street", "hong"),
    ("station", None),
    ("street", "cam"),
    ("chest", None),
    ("street", "cam"),
    ("street", "cam"),
    ("airport", None),
    ("street", "do"),
    ("chance", None),
    ("street", "do"),
    ("street", "do"),
    ("station", None),
    ("street", "vang"),
    ("street", "vang"),
    ("water", None),
    ("street", "vang"),
    ("go-jail", None),
    ("street", "xanh-la"),
    ("street", "xanh-la"),
    ("chest", None),
    ("street", "xanh-la"),
    ("station", None),
    ("chance", None),
    ("street", "xanh-dam"),
    ("tax", None),
    ("street", "xanh-dam"),
]


def axis(n, horizontal):
    if horizontal:
        margin, corner, far_start, far_corner = 0.044, 0.136, 0.82, 0.136
    else:
        margin, corner, far_start, far_corner = 0.044, 0.136, 0.79, 0.125
    middle = (far_start - corner - margin) / 9
    if n == 0:
        return margin, corner
    if n == 10:
        return far_start, far_corner
    return margin + corner + (n - 1) * middle, middle


def square_bounds(i):
    if i <= 10:
        col, row = 10 - i, 10
    elif i <= 20:
        col, row = 0, 20 - i
    elif i <= 30:
        col, row = i - 20, 0
    else:
        col, row = 10, i - 30
    u, w = axis(col, True)
    v, h = axis(row, False)
    return u, v, u + w, v + h


def tile_side(i):
    if 1 <= i <= 9:
        return "bottom"
    if 11 <= i <= 19:
        return "left"
    if 21 <= i <= 29:
        return "top"
    if 31 <= i <= 39:
        return "right"
    return "corner"


def draw_icon(draw, kind, size):
    """Draw a single-ink tile symbol into a square, transparent vector-style canvas."""
    center = size / 2
    unit = size * 0.9

    def point(x, y):
        return (center + (x - 50) * unit / 100, center + (y - 50) * unit / 100)

    def poly(points, fill=INK):
        draw.polygon([point(x, y) for x, y in points], fill=fill)

    def rect(box, radius=0, fill=INK):
        x0, y0 = point(box[0], box[1])
        x1, y1 = point(box[2], box[3])
        if radius:
            draw.rounded_rectangle((x0, y0, x1, y1), radius=unit * radius / 100, fill=fill)
        else:
            draw.rectangle((x0, y0, x1, y1), fill=fill)

    def ellipse(box, fill=INK):
        x0, y0 = point(box[0], box[1])
        x1, y1 = point(box[2], box[3])
        draw.ellipse((x0, y0, x1, y1), fill=fill)

    clear = (0, 0, 0, 0)
    if kind == "street":
        poly([(10, 44), (50, 12), (90, 44)])
        rect((20, 40, 80, 87), radius=5)
        rect((43, 59, 57, 87), fill=clear)
        rect((28, 50, 40, 62), fill=clear)
        rect((60, 50, 72, 62), fill=clear)
    elif kind == "station":
        rect((12, 48, 88, 72), radius=7)
        rect((24, 31, 53, 51), radius=4)
        rect((69, 36, 76, 49), radius=2)
        ellipse((22, 68, 43, 88))
        ellipse((62, 68, 83, 88))
        rect((28, 75, 37, 82), fill=clear)
        rect((68, 75, 77, 82), fill=clear)
    elif kind == "power":
        poly([(57, 8), (30, 53), (46, 53), (38, 92), (72, 42), (55, 42)])
    elif kind == "water":
        poly(
            [
                (50, 8), (25, 43), (18, 56), (19, 69), (26, 82), (38, 90),
                (50, 93), (62, 90), (74, 82), (81, 69), (82, 56), (75, 43),
            ]
        )
    elif kind == "start":
        poly([(88, 42), (35, 42), (35, 24), (6, 50), (35, 76), (35, 58), (88, 58)])
    elif kind == "chance":
        poly([(50, 6), (61, 38), (94, 50), (61, 61), (50, 94), (39, 61), (6, 50), (39, 38)])
    elif kind == "chest":
        rect((12, 37, 88, 52), radius=6)
        rect((17, 49, 83, 83), radius=5)
        rect((44, 53, 56, 66), radius=2)
        rect((46, 55, 54, 64), fill=clear)
    elif kind == "tax":
        ellipse((19, 22, 56, 48))
        rect((19, 35, 56, 48))
        ellipse((19, 28, 56, 51), fill=INK)
        ellipse((43, 42, 80, 68))
        rect((43, 55, 80, 68))
        ellipse((43, 48, 80, 71), fill=INK)
        ellipse((22, 62, 77, 90))
        rect((22, 76, 77, 90))
        ellipse((22, 62, 77, 84), fill=INK)
        ellipse((29, 67, 70, 79), fill=clear)
    elif kind in ("jail", "go-jail"):
        rect((16, 16, 84, 24), radius=3)
        rect((16, 76, 84, 84), radius=3)
        for x in (23, 39, 55, 71):
            rect((x, 22, x + 7, 78), radius=3)
        if kind == "go-jail":
            poly([(6, 47), (26, 34), (26, 42), (44, 42), (44, 52), (26, 52), (26, 61)])
    elif kind == "airport":
        poly([
            (46, 8), (54, 8), (59, 39), (91, 60), (91, 68),
            (58, 56), (56, 78), (70, 88), (70, 94), (50, 88),
            (30, 94), (30, 88), (44, 78), (42, 56), (9, 68),
            (9, 60), (41, 39),
        ])


def widen_track(image):
    """Deepen the tile faces while preserving their actual outer edges in the source art."""
    source_edges = {
        True: (0.0, 0.044, 0.15, 0.85, 0.956, 1.0),
        False: (0.0, 0.044, 0.15, 0.82, 0.915, 1.0),
    }
    target_edges = {
        True: (0.0, 0.044, 0.18, 0.82, 0.956, 1.0),
        False: (0.0, 0.044, 0.18, 0.79, 0.915, 1.0),
    }

    def remap_axis(source, horizontal):
        length = source.width if horizontal else source.height
        result = Image.new("RGBA", source.size, (0, 0, 0, 0))
        for source_start, source_end, target_start, target_end in zip(
            source_edges[horizontal],
            source_edges[horizontal][1:],
            target_edges[horizontal],
            target_edges[horizontal][1:],
        ):
            s0, s1 = round(source_start * length), round(source_end * length)
            t0, t1 = round(target_start * length), round(target_end * length)
            if horizontal:
                strip = source.crop((s0, 0, s1, source.height))
                strip = strip.resize((t1 - t0, source.height), Image.Resampling.LANCZOS)
                result.paste(strip, (t0, 0))
            else:
                strip = source.crop((0, s0, source.width, s1))
                strip = strip.resize((source.width, t1 - t0), Image.Resampling.LANCZOS)
                result.paste(strip, (0, t0))
        return result

    return remap_axis(remap_axis(image, True), False)


def make_print_texture():
    source = Image.open(SOURCE).convert("RGBA")
    scale = 2
    image = source.resize((source.width * scale, source.height * scale), Image.Resampling.LANCZOS)
    image = widen_track(image)
    # Reuse the illustration's blank ivory faces, but rebuild every divider. The source
    # has only eight spaces on each vertical side; stretching it cannot make a 40-cell board.
    def source_patch(bounds):
        return source.crop(tuple(round(value * source.width) for value in bounds))

    face = source_patch((0.151, 0.049, 0.225, 0.145))
    corner = source_patch((0.044, 0.044, 0.15, 0.15))
    for i in range(len(SQUARES)):
        u0, v0, u1, v1 = square_bounds(i)
        x0, y0 = round(u0 * image.width), round(v0 * image.height)
        x1, y1 = round(u1 * image.width), round(v1 * image.height)
        patch = corner if tile_side(i) == "corner" else face
        if tile_side(i) in ("left", "right"):
            patch = patch.transpose(Image.Transpose.ROTATE_90)
        image.paste(patch.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS), (x0, y0))
    draw = ImageDraw.Draw(image)
    for i, (kind, group) in enumerate(SQUARES):
        u0, v0, u1, v1 = square_bounds(i)
        x0, y0 = round(u0 * image.width), round(v0 * image.height)
        x1, y1 = round(u1 * image.width), round(v1 * image.height)
        width, height = x1 - x0, y1 - y0
        side = tile_side(i)
        pad_x = max(2, round(width * 0.055))
        pad_y = max(2, round(height * 0.055))
        center_x = (x0 + x1) / 2
        center_y = (y0 + y1) / 2
        band_color = None
        if band_color:
            if side == "bottom":
                band = (x0 + pad_x, y0 + pad_y, x1 - pad_x, y0 + round(height * 0.18))
            elif side == "top":
                band = (x0 + pad_x, y1 - round(height * 0.18), x1 - pad_x, y1 - pad_y)
            elif side == "left":
                band = (x1 - round(width * 0.18), y0 + pad_y, x1 - pad_x, y1 - pad_y)
            elif side == "right":
                band = (x0 + pad_x, y0 + pad_y, x0 + round(width * 0.18), y1 - pad_y)
            else:
                band = (x0, y0, x0, y0)
            if side != "corner":
                draw.rounded_rectangle(
                    tuple(round(value) for value in band),
                    radius=max(2, round(min(width, height) * 0.035)),
                    fill=band_color,
                )
        icon_canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        draw_icon(ImageDraw.Draw(icon_canvas, "RGBA"), kind, 512)
        icon_size = round(min(width, height) * (0.42 if side == "corner" else 0.54))
        # Leave the inner half of every face for the live Vietnamese place label.
        if side == "bottom":
            center_y = y0 + height * 0.6
        elif side == "top":
            center_y = y0 + height * 0.4
        elif side == "left":
            center_x = x0 + width * 0.4
        elif side == "right":
            center_x = x0 + width * 0.6
        else:
            center_y = y0 + height * 0.38
        icon_canvas = icon_canvas.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        image.alpha_composite(
            icon_canvas,
            (round(center_x - icon_size / 2), round(center_y - icon_size / 2)),
        )
    image = widen_into_field(image)
    PRINT.parent.mkdir(parents=True, exist_ok=True)
    image.save(PRINT)


def widen_into_field(image):
    """The tile ring's top band reaches down into the field as one big tile (the players' panel).

    The field's border, with its corner pieces, moves down to the panel's foot; the side columns
    of tiles are left untouched, so the two corners where panel and field meet stay clean.
    """
    W, H = image.size
    px = lambda u: round(u * W)
    py = lambda v: round(v * H)
    # The field's border band runs from 14 px outside its edge to 11 px inside it.
    left, right, top, bottom = px(FIELD[0]) - 14, px(FIELD[2]) + 9, py(FIELD[1]) - 14, py(FIELD[3]) + 1
    foot = py(PANEL_BOTTOM) - 14
    # One top-row tile (square 25: its face and bevel); its inner half is blank paper. The dark
    # line just left of it is the groove between tiles.
    u0, v0, u1, v1 = square_bounds(25)
    tile = image.crop((px(u0) + 3, py(v0) + 12, px(u1) - 3, py(v1) - 18))
    groove = image.getpixel((px(u0) - 1, py((v0 + v1) / 2)))
    tw, th = tile.size
    raw = tile.crop((26, th - 140, tw - 26, th - 26))
    import numpy as np  # bundled with Blender

    # Keep only the paper's fine grain over one even tone, so laid side by side it shows no seams.
    grain = np.asarray(raw, np.float32) - np.asarray(raw.filter(ImageFilter.GaussianBlur(10)), np.float32)
    tone = np.asarray(raw, np.float32).reshape(-1, 4).mean(axis=0)
    paper = Image.fromarray(np.clip(grain + tone, 0, 255).astype(np.uint8), "RGBA")

    def big_tile(w, h, m=30):
        out = Image.new("RGBA", (w, h))
        pw, ph = paper.size
        for y in range(0, h, ph):
            for x in range(0, w, pw):
                patch = paper
                if (x // pw + y // ph) % 2:
                    patch = patch.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                if (x // pw) % 3 == 1:
                    patch = patch.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                out.paste(patch, (x, y))
        out.paste(tile.crop((m, 0, tw - m, m)).resize((w - 2 * m, m)), (m, 0))
        out.paste(tile.crop((m, th - m, tw - m, th)).resize((w - 2 * m, m)), (m, h - m))
        out.paste(tile.crop((0, m, m, th - m)).resize((m, h - 2 * m)), (0, m))
        out.paste(tile.crop((tw - m, m, tw, th - m)).resize((m, h - 2 * m)), (w - m, m))
        for sx, sy, dx, dy in ((0, 0, 0, 0), (tw - m, 0, w - m, 0), (0, th - m, 0, h - m), (tw - m, th - m, w - m, h - m)):
            out.paste(tile.crop((sx, sy, sx + m, sy + m)), (dx, dy))
        return out

    # The border's top run and its two corner pieces, taken from inside the side columns only.
    strip = image.crop((left, top - 2, right, top + 110))
    # Its outer line carries a gold tab under every top-row tile seam; under the big tile there
    # are no seams, so the line is relaid from a seamless stretch (mid-tile) end to end. At the
    # two ends it then meets the field's side lines in a clean corner.
    mid = px(sum(square_bounds(25)[0::2]) / 2) - left
    clean = strip.crop((mid - 20, 0, mid + 20, 16))
    for x in range(0, strip.width, clean.width):
        strip.paste(clean, (x, 0))
    image.paste(Image.new("RGBA", (right - left, foot - top + 4), groove), (left, top - 2))
    image.alpha_composite(strip, (left, foot - 2))
    image.alpha_composite(big_tile(right - left - 4, foot - top - 4), (left + 2, top))
    # A soft shadow on the field under the raised paper.
    shade = np.asarray(image, np.float32).copy()
    for i in range(28):
        shade[foot + 28 + i, left + 26 : right - 26, :3] *= 1 - 0.18 * (1 - i / 28)
    image = Image.fromarray(shade.astype(np.uint8), "RGBA")
    return inlay_sockets(image)


def inlay_sockets(image):
    """Cartoon inlays on the panel: gold-rimmed wells for the pictures and balls, the clock's groove
    and a rule before the seats' list. Drawn 3× and scaled down for smooth edges."""
    W, H = image.size
    x0, y0, x1, y1 = round(FIELD[0] * W), round(FIELD[1] * H), round(FIELD[2] * W), round(PANEL_BOTTOM * H)
    S = 3
    layer = Image.new("RGBA", ((x1 - x0) * S, (y1 - y0) * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    at = lambda u, v: ((u * W - x0) * S, (v * H - y0) * S)

    def well(u, v, r, rim):
        cx, cy = at(u, v)
        R = r * W * S
        rim *= S
        d.ellipse((cx - R - rim, cy - R - rim, cx + R + rim, cy + R + rim), fill=INLAY["edge"])
        d.ellipse((cx - R - rim * 0.8, cy - R - rim * 0.8, cx + R + rim * 0.8, cy + R + rim * 0.8), fill=INLAY["ring"])
        d.arc((cx - R - rim * 0.55, cy - R - rim * 0.55, cx + R + rim * 0.55, cy + R + rim * 0.55), 200, 320, fill=INLAY["shine"], width=max(2, round(rim * 0.25)))
        d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=INLAY["edge"])
        d.ellipse((cx - R * 0.94, cy - R * 0.94, cx + R * 0.94, cy + R * 0.94), fill=INLAY["well"])

    a = PANEL["avatar"]
    well(a["u"], a["v"], a["r"], 22)
    for seat in PANEL["seats"]:
        well(seat["u"], seat["v"], seat["r"], 9)
    b = PANEL["bar"]
    (bx0, by0), (bx1, by1) = at(b["u0"], b["v"] - b["h"] / 2), at(b["u1"], b["v"] + b["h"] / 2)
    radius = (by1 - by0) / 2
    d.rounded_rectangle((bx0 - 7 * S, by0 - 7 * S, bx1 + 7 * S, by1 + 7 * S), radius=radius + 7 * S, fill=INLAY["edge"])
    d.rounded_rectangle((bx0 - 5 * S, by0 - 5 * S, bx1 + 5 * S, by1 + 5 * S), radius=radius + 5 * S, fill=INLAY["ring"])
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=radius, fill=INLAY["deep"])
    r = PANEL["rule"]
    (rx, ry0), (_, ry1) = at(r["u"], r["v0"]), at(r["u"], r["v1"])
    d.rounded_rectangle((rx - 4 * S, ry0, rx + 4 * S, ry1), radius=4 * S, fill=INLAY["edge"])
    d.rounded_rectangle((rx - 2 * S, ry0 + 2 * S, rx + 1 * S, ry1 - 2 * S), radius=2 * S, fill=INLAY["ring"])
    image.alpha_composite(layer.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS), (x0, y0))
    return image

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0.0, roughness=0.55):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return mat


wood = material("Honey lacquered wood", (0.30, 0.105, 0.038), 0.05, 0.28)
dark_wood = material("Carved lower edge", (0.11, 0.038, 0.018), 0.02, 0.4)
gold = material("Warm brass reveal", (0.72, 0.38, 0.065), 0.68, 0.23)


def rounded_slab(name, size, z, height, bevel, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.082, z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size, size - 0.164, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Soft carved edge", "BEVEL")
    modifier.width = bevel
    modifier.segments = 5
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    obj.data.materials.append(mat)
    return obj


rounded_slab("lower wood tier", 3.74, -0.10, 0.10, 0.025, dark_wood)
rounded_slab("brass inset", 3.72, -0.035, 0.025, 0.012, gold)
rounded_slab("upper wood tier", 3.70, -0.005, 0.05, 0.012, wood)

# The base illustration keeps the board's material detail; monochrome symbols and group bands
# are printed into its UV texture before Blender renders the perspective.
mesh = bpy.data.meshes.new("board surface")
mesh.from_pydata(
    [(-1.848, -1.684, 0.035), (1.848, -1.684, 0.035), (1.848, 1.848, 0.035), (-1.848, 1.848, 0.035)],
    [],
    [(0, 1, 2, 3)],
)
mesh.update()
uv = mesh.uv_layers.new(name="board UV")
for loop, coord in zip(mesh.polygons[0].loop_indices, [(0.038, 0.079), (0.962, 0.079), (0.962, 0.962), (0.038, 0.962)]):
    uv.data[loop].uv = coord
surface = bpy.data.objects.new("printed board", mesh)
bpy.context.collection.objects.link(surface)
make_print_texture()
image = bpy.data.images.load(str(PRINT))
image.pack()
print_mat = bpy.data.materials.new("Original printed board")
print_mat.use_nodes = True
nodes = print_mat.node_tree.nodes
nodes.clear()
output = nodes.new("ShaderNodeOutputMaterial")
mix = nodes.new("ShaderNodeMixShader")
transparent = nodes.new("ShaderNodeBsdfTransparent")
emission = nodes.new("ShaderNodeEmission")
texture = nodes.new("ShaderNodeTexImage")
texture.image = image
links = print_mat.node_tree.links
links.new(texture.outputs["Color"], emission.inputs["Color"])
links.new(texture.outputs["Alpha"], mix.inputs[0])
links.new(transparent.outputs[0], mix.inputs[1])
links.new(emission.outputs[0], mix.inputs[2])
links.new(mix.outputs[0], output.inputs["Surface"])
surface.data.materials.append(print_mat)

# A mild pitch makes the board feel like an object on a table without compressing the far row.
bpy.ops.object.camera_add(location=(0, -5.7, 8.7))
camera = bpy.context.object
direction = Vector((0, 0, -0.02)) - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
camera.data.type = "PERSP"
camera.data.lens = 75
bpy.context.scene.camera = camera

bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.0, 7.0))
key = bpy.context.object
key.data.energy = 850
key.data.shape = "DISK"
key.data.size = 6
bpy.ops.object.light_add(type="AREA", location=(4.0, 2.0, 5.0))
fill = bpy.context.object
fill.data.energy = 450
fill.data.size = 5

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = WIDTH
scene.render.resolution_y = HEIGHT
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(PNG)
scene.view_settings.view_transform = "Standard"
scene.world.color = (0.28, 0.28, 0.28)


def project(u, v):
    point = Vector(((u - 0.5) * 4, (0.5 - v) * 4, 0.035))
    image_point = world_to_camera_view(scene, camera, point)
    return [
        round((image_point.x * WIDTH - CROP_X) / CROP_WIDTH, 6),
        round(((1 - image_point.y) * HEIGHT - CROP_Y) / CROP_HEIGHT, 6),
    ]


cells = []
for i in range(40):
    if i <= 10:
        col, row = 10 - i, 10
    elif i <= 20:
        col, row = 0, 20 - i
    elif i <= 30:
        col, row = i - 20, 0
    else:
        col, row = 10, i - 30
    u, w = axis(col, True)
    v, h = axis(row, False)
    cells.append([project(u, v), project(u + w, v), project(u + w, v + h), project(u, v + h)])

# The board's plane seen by the camera: a projective map from board units to the image.
import numpy as np  # bundled with Blender

corners = [(0, 0), (1, 0), (1, 1), (0, 1)]
rows, rhs = [], []
for (u, v), (x, y) in zip(corners, [project(u, v) for u, v in corners]):
    rows.append([u, v, 1, 0, 0, 0, -u * x, -v * x])
    rows.append([0, 0, 0, u, v, 1, -u * y, -v * y])
    rhs += [x, y]
homography = [round(float(value), 8) for value in np.linalg.solve(np.array(rows), np.array(rhs))] + [1]

GEOMETRY.write_text(
    "// Generated by sources/render_board_25d.py; coordinates are normalized to board-25d.webp.\n"
    "export const BOARD_CELLS = [\n"
    + "".join(
        "  [\n" + "".join(f"    {json.dumps(point)},\n" for point in cell) + "  ],\n"
        for cell in cells
    )
    + "] as const;\n"
    + f"export const BOARD_IMAGE_RATIO = {CROP_WIDTH / CROP_HEIGHT} as const;\n"
    + "/** Board units (0–1 across the printed board) to the image: x = (h0 u + h1 v + h2) / w, … */\n"
    + f"export const BOARD_HOMOGRAPHY = {json.dumps(homography)} as const;\n"
    + "/** The players' panel in board units: sockets the game fills in, and the field below it. */\n"
    + f"export const PLAYER_PANEL = {json.dumps(PANEL, indent=2)} as const;\n"
)

BLEND.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.render.render(write_still=True)
# Crop to the board and save as WebP (Pillow, so no ffmpeg is needed).
Image.open(PNG).crop((CROP_X, CROP_Y, CROP_X + CROP_WIDTH, CROP_Y + CROP_HEIGHT)).save(WEBP, "WEBP", quality=92)
print(f"Wrote {WEBP} and {GEOMETRY}")
