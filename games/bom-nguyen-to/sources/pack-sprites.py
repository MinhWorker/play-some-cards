"""Pack Bom Nguyên Tố's Codex sprite frames into JSON atlases (godot/atlas.gd reads them).

Codex draws every pose on its own canvas at its own scale, so each frame is trimmed, scaled to
the character's standing height (times a per-pose ratio), and placed with its feet on one
baseline and its weight centred. Facing left is the mirrored right side view.

    python games/bom-nguyen-to/sources/pack-sprites.py [actors | <element>…] [arena] [tiles]

Reads sources/<name>.png (raw Codex output, see prompts.json), or its copy in sources/frames/;
writes assets/actor-<element> and assets/arena-fx (.webp + .json), and previews into
.blender/bom-nguyen-to/.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

GAME = Path(__file__).resolve().parent.parent
SOURCES = GAME / 'sources'
ASSETS = GAME / 'assets'
PREVIEW = GAME.parent.parent / '.blender' / 'bom-nguyen-to'

ELEMENTS = ['fire', 'water', 'lightning', 'ice', 'wind']

# Actor canvas: the standing character is STAND px tall with its feet at FEET.
CANVAS = 256
STAND = 200
FEET = 244

# Height of each pose relative to standing (Codex fills its canvas whatever the pose).
POSE_HEIGHT = {
    'down': 1, 'blink': 1, 'walk1': 1, 'walk2': 1, 'frozen': 1,
    'up': 1, 'up-walk1': 1, 'up-walk2': 1,
    'right': 1, 'right-blink': 1, 'right-walk1': 1, 'right-walk2': 1,
    'place': 0.84, 'skill': 1, 'hit': 0.97, 'ko': 0.9,
}
# Per element/pose corrections where a pose's outline misleads the measure above.
OVERRIDE = {}
# The bunny's long ears count in its height: scale it up so its head matches the others.
ELEMENT_SCALE = {'lightning': 1.12}

# Each clip, per facing: the poses it shows in order (left mirrors right).
FRONT_ACTIONS = {
    'place': ['place'] * 4,
    'skill': ['skill'] * 5,
    'hit': ['hit'] * 4,
    'frozen': ['frozen', 'frozen'],
    'ko': ['hit', 'hit', 'ko', 'ko', 'ko', 'ko'],
    'spawn': ['place', 'skill', 'skill', 'down'],
}
CLIPS = {
    'down': {'idle': ['down'] * 5 + ['blink'], 'walk': ['walk1', 'down', 'walk2', 'down']},
    'up': {'idle': ['up'] * 6, 'walk': ['up-walk1', 'up', 'up-walk2', 'up']},
    'right': {
        'idle': ['right'] * 5 + ['right-blink'],
        'walk': ['right-walk1', 'right', 'right-walk2', 'right'],
    },
}


def source(name):
    """The raw Codex PNG (Git LFS), else its 512 px copy in sources/frames/ (plain git)."""
    raw = SOURCES / f'{name}.png'
    if raw.exists():
        return raw
    frame = SOURCES / 'frames' / f'{name}.webp'
    if frame.exists():
        return frame
    raise SystemExit(f'Missing sources/{name}.png: npm run gen:asset -- bom-nguyen-to/{name}')


def trimmed(name):
    image = Image.open(source(name)).convert('RGBA')
    box = image.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    return image.crop(box)


def centroid_x(image):
    """Horizontal centre of the opaque pixels (the body's weight, not the tail's reach)."""
    alpha = image.getchannel('A').point(lambda a: 255 if a > 128 else 0)
    width, height = image.size
    data = alpha.load()
    total = weighted = 0
    for y in range(0, height, 2):
        for x in range(0, width, 2):
            if data[x, y]:
                total += 1
                weighted += x
    return weighted / total if total else width / 2


def place_on_canvas(image, height, feet=FEET, size=CANVAS):
    scale = height / image.height
    image = image.resize((max(1, round(image.width * scale)), round(image.height * scale)),
                         Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size))
    x = round(size / 2 - centroid_x(image))
    canvas.alpha_composite(image, (max(0, min(size - image.width, x)), feet - image.height))
    return canvas


def actor_poses(element):
    poses = {}
    for pose, ratio in POSE_HEIGHT.items():
        ratio = OVERRIDE.get((element, pose), ratio) * ELEMENT_SCALE.get(element, 1)
        poses[pose] = place_on_canvas(trimmed(f'actor-{element}-{pose}'), round(STAND * ratio))
    for pose in [p for p in poses if p.startswith('right')]:
        poses['left' + pose[5:]] = poses[pose].transpose(Image.FLIP_LEFT_RIGHT)
    return poses


def actor_frames(element):
    poses = actor_poses(element)
    frames = {}
    for facing in ['down', 'up', 'left', 'right']:
        side = 'right' if facing == 'left' else facing
        clips = {**{k: v for k, v in CLIPS[side].items()}, **FRONT_ACTIONS}
        for clip, sequence in clips.items():
            for index, pose in enumerate(sequence):
                if facing == 'left' and pose.startswith('right'):
                    pose = 'left' + pose[5:]
                frames[f'{clip}-{facing}-{index:02d}'] = pose
    return poses, frames


def pack(name, images, frames, pivot, quality=90, max_width=2048):
    """Shelf-pack trimmed images; `frames` maps each frame name to an image id. `pivot` is the
    anchor of every frame, or a function of the frame name: a frame's pivot becomes the sprite's
    origin each time an animation changes frame."""
    padding = 3
    boxes = {}
    for key, image in images.items():
        box = image.getchannel('A').getbbox() or (0, 0, 1, 1)
        boxes[key] = (box, image.crop(box))
    order = sorted(images, key=lambda k: -boxes[k][1].height)
    placed, x, y, row, width = {}, padding, padding, 0, 0
    for key in order:
        crop = boxes[key][1]
        if x + crop.width + padding > max_width:
            x, y, row = padding, y + row + padding, 0
        placed[key] = (x, y)
        x += crop.width + padding
        row = max(row, crop.height)
        width = max(width, x)
    atlas = Image.new('RGBA', (width, y + row + padding))
    for key, (px, py) in placed.items():
        atlas.paste(boxes[key][1], (px, py))
    meta = {}
    for frame, key in frames.items():
        (left, top, right, bottom), crop = boxes[key]
        px, py = placed[key]
        size = images[key].size
        meta[frame] = {
            'frame': {'x': px, 'y': py, 'w': crop.width, 'h': crop.height},
            'rotated': False,
            'trimmed': True,
            'spriteSourceSize': {'x': left, 'y': top, 'w': crop.width, 'h': crop.height},
            'sourceSize': {'w': size[0], 'h': size[1]},
            'pivot': pivot(frame) if callable(pivot) else pivot,
        }
    ASSETS.mkdir(exist_ok=True)
    atlas.save(ASSETS / f'{name}.webp', quality=quality, method=6)
    (ASSETS / f'{name}.json').write_text(json.dumps({
        'frames': meta,
        'meta': {'app': 'pack-sprites.py', 'image': f'{name}.webp', 'format': 'RGBA8888',
                 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'},
    }, indent=2) + '\n')
    print(f'{name}: {len(images)} images, {len(frames)} frames, {atlas.width}x{atlas.height}')
    return atlas


def preview(name, images):
    PREVIEW.mkdir(parents=True, exist_ok=True)
    cell = max(image.width for image in images.values())
    sheet = Image.new('RGBA', (cell * len(images), cell), (84, 140, 84, 255))
    for i, image in enumerate(images.values()):
        sheet.alpha_composite(image, (i * cell, 0))
    sheet.save(PREVIEW / f'{name}.png')


def actors(elements=ELEMENTS):
    for element in elements:
        poses, frames = actor_frames(element)
        pack(f'actor-{element}', poses, frames, {'x': 0.5, 'y': FEET / CANVAS})
        preview(f'actor-{element}', poses)


# Arena effects share one canvas: bombs stand on its bottom, blasts fill its middle.
FX = 192


def arena():
    images, frames = {}, {}
    # bomb-spark2 repainted the sphere itself, so it would flicker: two sparks alternate.
    bomb = ['bomb', 'bomb-spark1']
    for i, name in enumerate(bomb * 2):
        frames[f'bomb-{i:02d}'] = name
    for name in bomb:
        image = trimmed(name)
        # The spark and fuse change the outline: measure the sphere's lower half instead.
        lower = image.crop((0, image.height // 2, image.width, image.height))
        left, _, right, _ = lower.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
        scale = 120 / (right - left)
        image = image.resize((round(image.width * scale), round(image.height * scale)),
                             Image.LANCZOS)
        centre = (left + right) / 2 * scale
        canvas = Image.new('RGBA', (FX, FX))
        canvas.alpha_composite(image, (round(FX / 2 - centre), FX - 12 - image.height))
        images[name] = canvas
    for element in ELEMENTS:
        for i, name in enumerate([f'blast-{element}', f'blast-{element}-2']):
            image = trimmed(name)
            scale = 172 / max(image.size)
            image = image.resize((round(image.width * scale), round(image.height * scale)),
                                 Image.LANCZOS)
            canvas = Image.new('RGBA', (FX, FX))
            canvas.alpha_composite(image, ((FX - image.width) // 2, (FX - image.height) // 2))
            images[name] = canvas
            frames[f'blast-{element}-{i:02d}'] = name
    for kind in ['heal', 'range', 'capacity', 'speed']:
        image = trimmed(f'item-{kind}')
        scale = 150 / max(image.size)
        image = image.resize((round(image.width * scale), round(image.height * scale)),
                             Image.LANCZOS)
        canvas = Image.new('RGBA', (FX, FX))
        canvas.alpha_composite(image, ((FX - image.width) // 2, FX - 16 - image.height))
        images[f'item-{kind}'] = canvas
        frames[f'item-{kind}-00'] = f'item-{kind}'
    # Bombs stand on their cell, items hover just above it, blasts sit on its middle.
    pack('arena-fx', images, frames, lambda frame: {
        'x': 0.5,
        'y': (FX - 12) / FX if frame.startswith('bomb') else
             (FX - 16) / FX if frame.startswith('item') else 0.5,
    })
    preview('arena-fx', images)


# Floor tiles: Codex paints them lush and detailed; muted and smoothed, they stay a calm ground
# that the stone blocks and gift boxes stand out from. (saturation, brightness)
TILES = {'tile-grass': (0.6, 1.05), 'tile-dirt': (0.65, 1.04)}


def tiles():
    for name, (saturation, brightness) in TILES.items():
        image = trimmed(name).resize((256, 256), Image.LANCZOS)
        alpha = image.getchannel('A')
        rgb = image.convert('RGB')
        rgb = Image.blend(rgb, rgb.filter(ImageFilter.GaussianBlur(6)), 0.7)
        rgb = ImageEnhance.Color(rgb).enhance(saturation)
        rgb = ImageEnhance.Contrast(rgb).enhance(0.8)
        rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
        out = rgb.convert('RGBA')
        out.putalpha(alpha)
        out.save(ASSETS / f'{name}.webp', quality=90, method=6)
        print(f'{name}: softened')


if __name__ == '__main__':
    targets = sys.argv[1:] or ['actors', 'arena', 'tiles']
    picked = [t for t in targets if t in ELEMENTS]
    if 'actors' in targets or picked:
        actors(picked or ELEMENTS)
    if 'arena' in targets:
        arena()
    if 'tiles' in targets:
        tiles()
