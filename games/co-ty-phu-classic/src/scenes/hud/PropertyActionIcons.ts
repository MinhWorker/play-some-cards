import type Phaser from 'phaser';

export type PropertyActionIcon = 'auction' | 'mortgage' | 'buy' | 'build';

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
  } else if (icon === 'buy') {
    // A deed sheet with a folded corner, property lines and a wax seal.
    ink.fillStyle = '#f4dfaa';
    ink.beginPath();
    ink.moveTo(24, 14);
    ink.lineTo(78, 14);
    ink.lineTo(104, 40);
    ink.lineTo(104, 114);
    ink.lineTo(24, 114);
    ink.closePath();
    ink.fill();
    ink.stroke();
    ink.fillStyle = '#d8ad61';
    ink.beginPath();
    ink.moveTo(78, 14);
    ink.lineTo(78, 40);
    ink.lineTo(104, 40);
    ink.closePath();
    ink.fill();
    ink.stroke();
    ink.lineWidth = 6;
    for (const [y, end] of [
      [49, 67],
      [63, 87],
      [77, 63],
    ]) {
      ink.beginPath();
      ink.moveTo(37, y!);
      ink.lineTo(end!, y!);
      ink.stroke();
    }
    ink.fillStyle = '#9b572b';
    ink.beginPath();
    ink.arc(77, 94, 15, 0, Math.PI * 2);
    ink.fill();
    ink.stroke();
    ink.fillStyle = '#ffe5a5';
    ink.beginPath();
    ink.arc(77, 94, 7, 0, Math.PI * 2);
    ink.fill();
  } else if (icon === 'build') {
    // A solid house silhouette with a small construction hammer across its right side.
    ink.fillStyle = '#d8ad61';
    block(17, 55, 69, 59);
    ink.fillStyle = '#684422';
    ink.beginPath();
    ink.moveTo(8, 59);
    ink.lineTo(51, 19);
    ink.lineTo(95, 59);
    ink.closePath();
    ink.fill();
    ink.stroke();
    block(45, 83, 17, 31);
    ink.fillStyle = '#fff0c6';
    block(27, 70, 13, 15);
    ink.save();
    ink.translate(94, 65);
    ink.rotate(Math.PI / 5);
    ink.fillStyle = '#684422';
    block(-5, -3, 10, 48);
    ink.fillStyle = '#9c9b8a';
    block(-20, -19, 40, 18);
    ink.fillStyle = '#f4dfaa';
    ink.fillRect(-16, -16, 30, 4);
    ink.restore();
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
