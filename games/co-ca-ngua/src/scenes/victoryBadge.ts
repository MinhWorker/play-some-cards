import Phaser from 'phaser';

/** A vector award plaque: crisp at the board's display density, with no extra asset load. */
export function victoryBadge(scene: Phaser.Scene, accent: number) {
  const g = scene.add.graphics();
  const polygon = (points: number[][], color: number) => {
    g.fillStyle(color).fillPoints(
      points.map(([x = 0, y = 0]) => new Phaser.Math.Vector2(x, y)),
      true,
    );
  };
  // Folded ribbon tails sit behind the beveled plaque.
  for (const side of [-1, 1]) {
    polygon(
      [
        [side * 194, 4],
        [side * 254, 20],
        [side * 236, 42],
        [side * 252, 68],
        [side * 196, 58],
      ],
      0x061d24,
    );
    polygon(
      [
        [side * 194, 0],
        [side * 250, 16],
        [side * 232, 38],
        [side * 248, 64],
        [side * 196, 54],
      ],
      accent,
    );
    polygon(
      [
        [side * 196, 36],
        [side * 222, 50],
        [side * 196, 54],
      ],
      0x08262b,
    );
  }
  g.fillStyle(0x001014, 0.55).fillRoundedRect(-224, -52, 448, 120, 24);
  g.fillStyle(0x9c6425).fillRoundedRect(-220, -62, 440, 124, 22);
  g.fillStyle(0xffdf8c).fillRoundedRect(-220, -62, 440, 116, 22);
  g.fillStyle(0x0a3438).fillRoundedRect(-214, -56, 428, 104, 18);
  g.lineStyle(2, 0xc99a50).strokeRoundedRect(-208, -50, 416, 92, 15);
  g.lineStyle(2, 0xffffff, 0.15).lineBetween(-185, -46, 185, -46);
  g.fillStyle(accent, 0.14).fillRoundedRect(-204, -46, 408, 22, 12);
  // The rank is embossed on its own gold ribbon.
  g.fillStyle(0x9c6425).fillRoundedRect(-57, 22, 236, 36, 10);
  g.fillStyle(0xffdf8c).fillRoundedRect(-57, 18, 236, 36, 10);
  g.lineStyle(1, 0xfff2c5).strokeRoundedRect(-52, 22, 226, 27, 7);

  // Gold medallion, laurel leaves and a hand-drawn cup instead of an emoji.
  const mx = -155;
  g.fillStyle(0x001014, 0.35).fillCircle(mx, 3, 55);
  g.fillStyle(0xffdf8c).fillCircle(mx, -3, 55);
  g.fillStyle(0x986226).fillCircle(mx, -3, 49);
  g.fillStyle(0x173b3b).fillCircle(mx, -3, 45);
  g.lineStyle(2, 0xffefb2, 0.8).strokeCircle(mx, -3, 51);
  for (const side of [-1, 1]) {
    for (let leaf = 0; leaf < 5; leaf++) {
      const angle = -0.9 + leaf * 0.4;
      const x = mx + side * (29 + 7 * Math.cos(angle));
      const y = -3 + 32 * Math.sin(angle);
      polygon(
        [
          [x, y - 8],
          [x + side * 7, y - 3],
          [x + side * 3, y + 8],
          [x - side * 3, y + 2],
        ],
        0xe7bd64,
      );
    }
  }
  g.lineStyle(5, 0xe7bd64).strokeRoundedRect(mx - 30, -23, 60, 25, 10);
  polygon(
    [
      [mx - 23, -28],
      [mx + 23, -28],
      [mx + 18, -3],
      [mx + 8, 9],
      [mx - 8, 9],
      [mx - 18, -3],
    ],
    0xf5c45c,
  );
  polygon(
    [
      [mx - 19, -24],
      [mx - 8, -24],
      [mx - 6, 3],
      [mx - 12, 0],
    ],
    0xfff1ad,
  );
  g.fillStyle(0xe7bd64)
    .fillRect(mx - 4, 8, 8, 14)
    .fillRoundedRect(mx - 18, 21, 36, 8, 3);
  // Small diamond glints finish the metalwork.
  for (const [x, y] of [
    [-212, -51],
    [210, -49],
    [185, 45],
  ]) {
    polygon(
      [
        [x ?? 0, (y ?? 0) - 6],
        [(x ?? 0) + 3, y ?? 0],
        [x ?? 0, (y ?? 0) + 6],
        [(x ?? 0) - 3, y ?? 0],
      ],
      0xfff6d5,
    );
  }
  return scene.add.container(0, 0, [g]).setDepth(9);
}
