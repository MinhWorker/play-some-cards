import type Phaser from 'phaser';
import { BOARD, isDeed, type Property } from '../../game/model.js';
import { DEED_LAYER_RECTS } from './deedLayerGeometry.js';

/** Blender-lit enamel and porcelain, baked in the exact board camera and packed once. */
export class DeedLayers {
  readonly badges = new Map<number, Phaser.GameObjects.Image>();
  readonly buildings = new Map<number, Phaser.GameObjects.Image>();

  constructor(scene: Phaser.Scene, texture: string) {
    BOARD.forEach((cell, square) => {
      if (!isDeed(cell)) return;
      this.badges.set(
        square,
        scene.add
          .image(0, 0, texture, `owner-0-${square}`)
          .setOrigin(0)
          .setDepth(0.5)
          .setVisible(false),
      );
      if (cell.kind === 'street')
        this.buildings.set(
          square,
          scene.add
            .image(0, 0, texture, `houses-1-${square}`)
            .setOrigin(0)
            .setDepth(0.6)
            .setVisible(false),
        );
    });
  }

  layout(left: number, top: number, width: number, height: number) {
    for (const images of [this.badges, this.buildings]) {
      for (const [square, image] of images) {
        const rect = DEED_LAYER_RECTS[square]!;
        image
          .setPosition(left + rect[0] * width, top + rect[1] * height)
          .setDisplaySize(rect[2] * width, rect[3] * height);
      }
    }
  }

  setProperty(square: number, property: Property) {
    const badge = this.badges.get(square);
    if (!badge) return;
    badge.setVisible(property.owner !== null);
    if (property.owner !== null) badge.setFrame(`owner-${property.owner}-${square}`);
    const buildings = this.buildings.get(square);
    if (!buildings) return;
    buildings.setVisible(property.owner !== null && property.houses > 0);
    if (property.houses > 0) buildings.setFrame(`houses-${property.houses}-${square}`);
  }
}
