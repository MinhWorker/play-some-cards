import type Phaser from 'phaser';
import type { StationAuction } from '../../game/model.js';
import { SurfaceMarks } from './SurfaceMarks.js';

/** Fixed seat sockets, with the latest contributor stamped as a triangle. */
export class StationBidMarks {
  readonly surface: SurfaceMarks;

  constructor(scene: Phaser.Scene) {
    this.surface = new SurfaceMarks(scene, -0.7);
  }

  layout(
    auctions: Record<number, StationAuction>,
    colors: readonly number[],
    left: number,
    top: number,
    width: number,
    height: number,
  ) {
    this.surface.layout(left, top, width, height);
    for (const [key, auction] of Object.entries(auctions)) {
      const square = Number(key);
      auction.bids.forEach((amount, seat) => {
        if (!amount) return;
        const along = 0.23 + seat * 0.18;
        const depth = 0.31;
        const color = colors[seat]!;
        const latest = auction.leader === seat;
        const stamp = (radius: number, ink: number, alpha = 1) => {
          if (latest)
            this.surface.shape(
              square,
              along,
              depth,
              [
                { x: 0, y: radius * 0.6 },
                { x: -radius, y: -radius * 0.46 },
                { x: radius, y: -radius * 0.46 },
              ],
              ink,
              alpha,
            );
          else this.surface.circle(square, along, depth, radius, ink, alpha);
        };
        stamp(0.068, 0x514b40, 0.85);
        stamp(0.053, color);
        // A restrained highlight sits inside the ink, rather than casting a raised shadow.
        stamp(0.032, 0xfff1ce, 0.2);
      });
    }
  }
}
