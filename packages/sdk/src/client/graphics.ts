import type Phaser from 'phaser';

export interface RasterBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const owned = new WeakMap<Phaser.Scene, Set<string>>();

/**
 * Bake rounded Graphics once with Canvas, rather than triangulating their arcs every frame.
 * Bounds are in the Graphics' local coordinates and must include outlines and shadows.
 * Call again only when the drawing changes; the same key refreshes the same CanvasTexture.
 */
export function rasterizeGraphics(
  scene: Phaser.Scene,
  graphics: Phaser.GameObjects.Graphics,
  key: string,
  bounds: RasterBounds,
  existingImage?: Phaser.GameObjects.Image,
): Phaser.GameObjects.Image {
  let keys = owned.get(scene);
  if (!keys) {
    const generated = new Set<string>();
    keys = generated;
    owned.set(scene, keys);
    const cleanup = () => {
      for (const textureKey of generated) {
        if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
      }
      owned.delete(scene);
      scene.events.off('shutdown', cleanup);
      scene.events.off('destroy', cleanup);
    };
    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
  }
  const textureKey = `${scene.sys.settings.key}:paper:${key}`;
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const resolution = Math.min(3, 4096 / Math.max(width, height));
  const pixelWidth = Math.min(4096, Math.ceil(width * resolution));
  const pixelHeight = Math.min(4096, Math.ceil(height * resolution));
  const texture = scene.textures.exists(textureKey)
    ? (scene.textures.get(textureKey) as Phaser.Textures.CanvasTexture)
    : scene.textures.createCanvas(textureKey, pixelWidth, pixelHeight);
  if (!texture) throw new Error('Unable to create game panel texture');
  keys.add(textureKey);
  texture.setSize(pixelWidth, pixelHeight);
  texture.getContext().clearRect(0, 0, pixelWidth, pixelHeight);
  const temporary = scene.add.graphics();
  try {
    temporary
      .scaleCanvas(pixelWidth / width, pixelHeight / height)
      .translateCanvas(-bounds.x, -bounds.y);
    for (const command of graphics.commandBuffer) temporary.commandBuffer.push(command);
    temporary.generateTexture(textureKey, pixelWidth, pixelHeight);
  } finally {
    temporary.destroy();
  }
  const image = existingImage?.scene
    ? existingImage.setTexture(textureKey)
    : scene.add.image(0, 0, textureKey);
  image
    .setOrigin(-bounds.x / width, -bounds.y / height)
    .setPosition(graphics.x, graphics.y)
    .setDisplaySize(width, height)
    .setScale((width / pixelWidth) * graphics.scaleX, (height / pixelHeight) * graphics.scaleY)
    .setRotation(graphics.rotation)
    .setAlpha(graphics.alpha)
    .setScrollFactor(graphics.scrollFactorX, graphics.scrollFactorY)
    .setDepth(graphics.depth);
  const parent = graphics.parentContainer;
  if (parent && image.parentContainer !== parent) {
    parent.addAt(image, parent.list.indexOf(graphics));
  }
  graphics.setVisible(false);
  return image;
}
