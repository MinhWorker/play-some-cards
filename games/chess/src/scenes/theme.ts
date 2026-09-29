/**
 * Look and words shared by the scenes. Until the piece art exists, pieces are chess symbols
 * drawn as text; a piece uses its image instead as soon as assets/piece-<side>-<kind>.webp is
 * there (the piece's disc DISC of the image wide, centered).
 */
import type { EndReason, Kind, Promotion, Side } from '../game/model.js';

/** The piece's width as a share of its image (the rest is room for shadows and animations). */
export const DISC = 0.8;

/** Fonts that have the chess symbols, on phones and computers. */
export const GLYPH_FONT =
  '"Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", serif';

/** Filled chess symbols for both sides (colored by the text), shown as text, not emoji. */
const GLYPHS: Record<Kind, string> = {
  k: '♚︎',
  q: '♛︎',
  r: '♜︎',
  b: '♝︎',
  n: '♞︎',
  p: '♟︎',
};
export const glyphOf = (kind: Kind) => GLYPHS[kind];

/** The image of a piece: assets/piece-<side>-<kind>.webp. */
const ART: Record<Kind, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

export const SIDES: Record<Side, { name: string; art: string; fill: string; edge: string }> = {
  w: { name: 'Trắng', art: 'white', fill: '#fbf6ea', edge: '#2b1d12' },
  b: { name: 'Đen', art: 'black', fill: '#2b2522', edge: '#f3e6cc' },
};

export const pieceImage = (side: Side, kind: Kind) => `piece-${SIDES[side].art}-${ART[kind]}`;

/** What a pawn may become, as the promotion picker names them. */
export const PROMOTION_NAMES: Record<Promotion, string> = {
  q: 'Hậu',
  r: 'Xe',
  b: 'Tượng',
  n: 'Mã',
};

export const COLORS = {
  light: 0xefd9b4,
  dark: 0xb3805a,
  frame: 0x5c2d12,
  lightText: '#b3805a',
  darkText: '#efd9b4',
  last: 0xffe066,
  selected: 0x7fd4ff,
  target: 0x1f6b3a,
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
      return 'Chiếu hết!';
    case 'stalemate':
      return 'Hết nước đi';
    case 'resign':
      return `${loser} đầu hàng`;
    case 'left':
      return `${loser} rời bàn`;
    case 'repetition':
      return 'Lặp lại thế cờ ba lần';
    case 'move-limit':
      return '50 nước không ăn quân, không đi tốt';
    case 'material':
      return 'Không đủ quân chiếu hết';
    case 'agreement':
      return 'Hai bên đồng ý';
  }
}
