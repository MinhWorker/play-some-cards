import type Phaser from 'phaser';

export type PropertyActionIcon = 'auction' | 'mortgage';

/** Bake each small control icon once; button redraws only reposition an image. */
export function propertyActionIcon(scene: Phaser.Scene, icon: PropertyActionIcon) {
  const key = `co-ty-phu-classic.control.${icon}`;
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ink = canvas.getContext('2d')!;
  ink.fillStyle = '#684422';
  ink.strokeStyle = '#3d2b20';
  ink.lineWidth = 5;
  ink.lineJoin = 'round';
  const block = (x: number, y: number, width: number, height: number) => {
    ink.beginPath();
    ink.roundRect(x, y, width, height, 4);
    ink.fill();
    ink.stroke();
  };
  if (icon === 'auction') {
    // A diagonal wooden gavel above a separate striking block.
    ink.save();
    ink.translate(55, 42);
    ink.rotate(-Math.PI / 4);
    block(-6, 4, 12, 66);
    block(-27, -14, 54, 29);
    block(-32, -18, 9, 37);
    block(23, -18, 9, 37);
    ink.fillStyle = '#d8ad61';
    ink.fillRect(-20, -9, 39, 5);
    ink.restore();
    block(20, 101, 67, 12);
    block(29, 92, 49, 10);
  } else {
    // Classical bank: pediment, three columns and stepped base.
    ink.beginPath();
    ink.moveTo(12, 43);
    ink.lineTo(64, 14);
    ink.lineTo(116, 43);
    ink.closePath();
    ink.fill();
    ink.stroke();
    block(16, 45, 96, 10);
    for (const x of [24, 56, 88]) block(x, 57, 16, 40);
    block(16, 99, 96, 9);
    block(10, 111, 108, 9);
    ink.fillStyle = '#d8ad61';
    ink.beginPath();
    ink.arc(64, 34, 6, 0, Math.PI * 2);
    ink.fill();
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}
