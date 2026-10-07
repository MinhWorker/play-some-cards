import type Phaser from 'phaser';

/**
 * Texture key of `picture` with `ring` drawn over it, made once and shared by every scene.
 * Avatars and frames are separate images (an avatar is a round picture, a frame the ring that
 * covers its edge), so any frame goes with any avatar.
 */
export function framedAvatar(
  textures: Phaser.Textures.TextureManager,
  picture: string,
  ring: string,
) {
  const key = `${picture}+${ring}`;
  if (textures.exists(key)) return key;
  const ringImage = textures.get(ring).getSourceImage() as CanvasImageSource & { width: number };
  const pictureImage = textures.get(picture).getSourceImage() as CanvasImageSource;
  const size = ringImage.width;
  const canvas = textures.createCanvas(key, size, size);
  if (!canvas) return picture;
  canvas.context.drawImage(pictureImage, 0, 0, size, size);
  canvas.context.drawImage(ringImage, 0, 0, size, size);
  canvas.refresh();
  return key;
}
