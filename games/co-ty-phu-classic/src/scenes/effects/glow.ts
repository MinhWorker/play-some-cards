import type Phaser from 'phaser';

/** Transient hover glow: four samples per ring, automatic padding. Persistent glows are baked. */
export function addGlow(
  object: Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice,
  color: number,
  strength = 2,
  distance = 8,
) {
  const glow = object
    .enableFilters()
    .filters?.internal.addGlow(color, strength, 0, 1, false, 4, distance);
  // enableFilters is a no-op on Canvas; the original object still renders there.
  glow?.setPaddingOverride(null);
  return glow;
}
