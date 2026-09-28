/**
 * Look and words shared by the scenes. Piece images are renders (engraved characters and all):
 * assets/piece-<side>-<kind>.webp, the disc centered, DISC of the image wide.
 */
import type { EndReason, Kind, Side } from '../game/model.js';

/** The disc's width as a share of its image (the rest is room for its shadow and animations). */
export const DISC = 0.625;

/**
 * assets/board.webp (generated, sources/prompts.json): its size in px, where point (row 0,
 * col 0) goes and the gaps between columns (dx) and rows (dy), fitted inside its wooden field
 * (x 76–1016, y 86–1098). The game draws the lines. `lift` is how far above its point a
 * piece's center is drawn and `disc` a piece's width, both in column gaps (from the renders).
 */
export const BOARD = {
  width: 1090,
  height: 1200,
  x0: 167.68,
  y0: 166.39,
  dx: 94.58,
  dy: 94.58,
  lift: 0.048,
  disc: 0.9091,
};

/** The image of a piece: assets/piece-<side>-<kind>.webp. */
const ART: Record<Kind, string> = {
  k: 'general',
  a: 'advisor',
  b: 'elephant',
  n: 'horse',
  r: 'chariot',
  c: 'cannon',
  p: 'soldier',
};

export const SIDES: Record<Side, { name: string; art: string; text: string }> = {
  r: { name: 'Đỏ', art: 'red', text: '#ff8a80' },
  b: { name: 'Đen', art: 'black', text: '#e3e6ea' },
};

export const pieceImage = (side: Side, kind: Kind) => `piece-${SIDES[side].art}-${ART[kind]}`;

export const COLORS = {
  line: 0x5c2d12,
  last: 0xffe066,
  selected: 0x7fd4ff,
  target: 0x2e9d57,
  check: 0xff3b30,
} as const;

/**
 * Why the game ended, as the status line says it: `winner` and `loser` are names ("Bạn" for
 * this player). Draws have neither.
 */
export function endText(reason: EndReason, winner: string, loser: string): string {
  const how = reasonText(reason, loser);
  return winner ? `${winner} thắng · ${how}` : `Hoà · ${how}`;
}

/** How the game ended, in a few words (`loser`: the side's player name). */
export function reasonText(reason: EndReason, loser: string): string {
  switch (reason) {
    case 'checkmate':
      return 'Chiếu bí!';
    case 'stalemate':
      return `${loser} hết nước đi`;
    case 'resign':
      return `${loser} đầu hàng`;
    case 'left':
      return `${loser} rời bàn`;
    case 'perpetual-check':
      return `${loser} chiếu dai`;
    case 'perpetual-chase':
      return `${loser} đuổi dai`;
    case 'repetition':
      return 'Lặp lại thế cờ';
    case 'move-limit':
      return '60 nước không ăn quân';
    case 'material':
      return 'Hết quân tấn công';
    case 'agreement':
      return 'Hai bên đồng ý';
  }
}
