import type Phaser from 'phaser';

export interface TextureUse {
  /** Texture key (a game's are `<gameId>/<file name>`). */
  key: string;
  /** The frame's size in the image's own pixels. */
  source: { width: number; height: number };
  /** Screen pixels per image pixel where it is drawn biggest: above 1 it is stretched (blurry). */
  upscale: number;
}

/**
 * Every image drawn on the canvas right now, with how much it is stretched at its biggest: the
 * list of art that needs a bigger export (docs/ui-guide.md, "Hình và kích thước"). Text and
 * nine-slices are left out (text follows the zoom; a nine-slice's corners are its own business).
 * Dev only: `npm run shots -- --audit` prints it for each device.
 */
export function textureAudit(game: Phaser.Game): TextureUse[] {
  const uses = new Map<string, TextureUse>();
  const visit = (obj: Phaser.GameObjects.GameObject, zoom: number) => {
    const o = obj as Phaser.GameObjects.Image & { list?: Phaser.GameObjects.GameObject[] };
    if (o.visible === false || o.alpha === 0) return;
    if (o.list) {
      for (const child of o.list) visit(child, zoom);
      return;
    }
    if (o.type !== 'Image' && o.type !== 'Sprite') return;
    const key = o.texture?.key;
    if (!key || key.startsWith('__')) return;
    const m = o.getWorldTransformMatrix();
    const upscale = Math.hypot(m.a, m.b) * zoom;
    const seen = uses.get(key);
    if (!seen || upscale > seen.upscale) {
      uses.set(key, {
        key,
        source: { width: o.frame.width, height: o.frame.height },
        upscale,
      });
    }
  };
  for (const scene of game.scene.getScenes(true)) {
    const zoom = scene.cameras.main.zoom;
    for (const obj of scene.children.list) visit(obj, zoom);
  }
  return [...uses.values()].sort((a, b) => b.upscale - a.upscale);
}
