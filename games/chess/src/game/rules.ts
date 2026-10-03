/**
 * How pieces move (FIDE rules): pure functions on a position, shared by the game, the computer
 * player and the screen (which shows the legal moves of a picked piece).
 */
import {
  type Cell,
  type Kind,
  type Move,
  type Piece,
  type Position,
  type Promotion,
  SIZE,
  type Side,
} from './model.js';

/** A board from 8 rows of 8 letters ('.' = empty), rank 8 first. */
export const boardOf = (...rows: string[]): Cell[] =>
  [...rows.join('')].map((c) => (c === '.' ? null : c));

/** White on rows 6–7, Black on rows 0–1 (see model.ts). */
export const START: Position = {
  board: boardOf(
    'rnbqkbnr',
    'pppppppp',
    '........',
    '........',
    '........',
    '........',
    'PPPPPPPP',
    'RNBQKBNR',
  ),
  turn: 'w',
  castling: 'KQkq',
  ep: null,
};

export const square = (row: number, col: number) => row * SIZE + col;
export const rowOf = (sq: number) => Math.floor(sq / SIZE);
export const colOf = (sq: number) => sq % SIZE;
export const sideOf = (piece: Piece): Side => (piece === piece.toUpperCase() ? 'w' : 'b');
export const kindOf = (piece: Piece) => piece.toLowerCase() as Kind;
export const other = (side: Side): Side => (side === 'w' ? 'b' : 'w');
export const pieceOf = (side: Side, kind: Kind): Piece =>
  side === 'w' ? kind.toUpperCase() : kind;

/** A square's name: 0 → "a8", 63 → "h1". */
export const nameOf = (sq: number) => `${'abcdefgh'[colOf(sq)]}${SIZE - rowOf(sq)}`;
/** A square from its name ("e4"). */
export const squareOf = (name: string) =>
  square(SIZE - Number(name[1]), 'abcdefgh'.indexOf(name[0] ?? ''));

/** A position from FEN (the first four fields; the move counters are ignored). */
export function fromFen(fen: string): Position {
  const [placement = '', turn = 'w', castling = '-', ep = '-'] = fen.trim().split(/\s+/);
  const rows = placement.split('/').map((row) => row.replace(/\d/g, (n) => '.'.repeat(Number(n))));
  return {
    board: boardOf(...rows),
    turn: turn === 'b' ? 'b' : 'w',
    castling: castling === '-' ? '' : castling,
    ep: ep === '-' ? null : squareOf(ep),
  };
}

const inBoard = (row: number, col: number) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;
/** The row pawns of `side` move towards (-1: up the screen, White). */
const forward = (side: Side) => (side === 'w' ? -1 : 1);
/** The row a pawn of `side` promotes on. */
const lastRow = (side: Side) => (side === 'w' ? 0 : SIZE - 1);

const ORTHO = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
const DIAG = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;
const KING = [...ORTHO, ...DIAG];
const KNIGHT = [
  [-2, -1],
  [-2, 1],
  [2, -1],
  [2, 1],
  [-1, -2],
  [1, -2],
  [-1, 2],
  [1, 2],
] as const;
const SLIDES: Partial<Record<Kind, readonly (readonly [number, number])[]>> = {
  r: ORTHO,
  b: DIAG,
  q: KING,
};
export const PROMOTIONS: readonly Promotion[] = ['q', 'r', 'b', 'n'];

/**
 * Castling, by the letter of its right: where the king starts and lands, the rook's corner and
 * where it lands, the squares that must be empty and those the king crosses (never attacked).
 */
const CASTLES = {
  K: { king: 60, to: 62, rook: 63, rookTo: 61, empty: [61, 62], safe: [60, 61, 62] },
  Q: { king: 60, to: 58, rook: 56, rookTo: 59, empty: [57, 58, 59], safe: [60, 59, 58] },
  k: { king: 4, to: 6, rook: 7, rookTo: 5, empty: [5, 6], safe: [4, 5, 6] },
  q: { king: 4, to: 2, rook: 0, rookTo: 3, empty: [1, 2, 3], safe: [4, 3, 2] },
} as const;
type Right = keyof typeof CASTLES;
const RIGHTS: Record<Side, Right[]> = { w: ['K', 'Q'], b: ['k', 'q'] };

/** The castle a king's move is, if it is one. */
function castleOf(board: Cell[], { from, to }: Move) {
  const piece = board[from];
  if (!piece || kindOf(piece) !== 'k') return null;
  return RIGHTS[sideOf(piece)].map((r) => CASTLES[r]).find((c) => c.king === from && c.to === to);
}

/** Whether a piece of `by` attacks `sq` (by its own rule, ignoring checks). */
export function attacked(board: Cell[], sq: number, by: Side): boolean {
  const row = rowOf(sq);
  const col = colOf(sq);
  const is = (r: number, c: number, kinds: string) => {
    if (!inBoard(r, c)) return false;
    const piece = board[square(r, c)];
    return Boolean(piece && sideOf(piece) === by && kinds.includes(kindOf(piece)));
  };
  // A pawn of `by` attacks from one row behind, towards its own side.
  const back = -forward(by);
  if (is(row + back, col - 1, 'p') || is(row + back, col + 1, 'p')) return true;
  for (const [dr, dc] of KNIGHT) if (is(row + dr, col + dc, 'n')) return true;
  for (const [dr, dc] of KING) if (is(row + dr, col + dc, 'k')) return true;
  for (const [dirs, kinds] of [
    [ORTHO, 'rq'],
    [DIAG, 'bq'],
  ] as const) {
    for (const [dr, dc] of dirs) {
      for (let r = row + dr, c = col + dc; inBoard(r, c); r += dr, c += dc) {
        if (!board[square(r, c)]) continue;
        if (is(r, c, kinds)) return true;
        break;
      }
    }
  }
  return false;
}

export const kingOf = (board: Cell[], side: Side) => board.indexOf(pieceOf(side, 'k'));

/** `side`'s king is attacked. */
export function inCheck(board: Cell[], side: Side): boolean {
  const king = kingOf(board, side);
  return king < 0 || attacked(board, king, other(side));
}

/** Where the piece on `from` may go by its own rule, without looking at checks. */
export function pseudoMoves(pos: Position, from: number): Move[] {
  const { board } = pos;
  const piece = board[from];
  if (!piece) return [];
  const side = sideOf(piece);
  const row = rowOf(from);
  const col = colOf(from);
  const out: Move[] = [];
  const enemy = (sq: number) => {
    const target = board[sq];
    return Boolean(target && sideOf(target) !== side);
  };
  /** Empty or an enemy piece: a target. */
  const step = (r: number, c: number) => {
    if (!inBoard(r, c)) return;
    const to = square(r, c);
    if (!board[to] || enemy(to)) out.push({ from, to });
  };
  const kind = kindOf(piece);

  if (kind === 'p') {
    const dir = forward(side);
    const pawnTo = (to: number) => {
      if (rowOf(to) === lastRow(side)) {
        for (const promotion of PROMOTIONS) out.push({ from, to, promotion });
      } else out.push({ from, to });
    };
    const ahead = square(row + dir, col);
    if (inBoard(row + dir, col) && !board[ahead]) {
      pawnTo(ahead);
      // Two squares from its starting row.
      const home = side === 'w' ? SIZE - 2 : 1;
      const two = square(row + 2 * dir, col);
      if (row === home && !board[two]) out.push({ from, to: two });
    }
    for (const dc of [-1, 1]) {
      if (!inBoard(row + dir, col + dc)) continue;
      const to = square(row + dir, col + dc);
      if (enemy(to) || to === pos.ep) pawnTo(to);
    }
  } else if (kind === 'n') {
    for (const [dr, dc] of KNIGHT) step(row + dr, col + dc);
  } else if (kind === 'k') {
    for (const [dr, dc] of KING) step(row + dr, col + dc);
    for (const right of RIGHTS[side]) {
      const castle = CASTLES[right];
      if (!pos.castling.includes(right) || from !== castle.king) continue;
      if (board[castle.rook] !== pieceOf(side, 'r')) continue;
      if (castle.empty.some((sq) => board[sq])) continue;
      if (castle.safe.some((sq) => attacked(board, sq, other(side)))) continue;
      out.push({ from, to: castle.to });
    }
  } else {
    for (const [dr, dc] of SLIDES[kind] ?? []) {
      for (let r = row + dr, c = col + dc; inBoard(r, c); r += dr, c += dc) {
        step(r, c);
        if (board[square(r, c)]) break;
      }
    }
  }
  return out;
}

/** The pawn a move takes en passant (its square), or `null`. */
export function enPassantOf(pos: Position, { from, to }: Move): number | null {
  const piece = pos.board[from];
  if (!piece || kindOf(piece) !== 'p' || to !== pos.ep || colOf(from) === colOf(to)) return null;
  return square(rowOf(from), colOf(to));
}

/** The piece a move takes, if any (en passant included). */
export function captureOf(pos: Position, move: Move): Piece | null {
  const ep = enPassantOf(pos, move);
  return pos.board[ep ?? move.to] ?? null;
}

/** Whether a move is castling. */
export const isCastle = (pos: Position, move: Move) => Boolean(castleOf(pos.board, move));

/** Whether a move takes a pawn to its last rank (it then needs `promotion`). */
export function isPromotion({ board }: Position, { from, to }: Move): boolean {
  const piece = board[from];
  return Boolean(piece && kindOf(piece) === 'p' && rowOf(to) === lastRow(sideOf(piece)));
}

/** The position after a move: pieces, side to move, castling rights and en passant square. */
export function play(pos: Position, move: Move): Position {
  const { from, to } = move;
  const board = pos.board.slice();
  const piece = board[from];
  if (!piece) return pos;
  const side = sideOf(piece);
  const ep = enPassantOf(pos, move);
  if (ep !== null) board[ep] = null;
  const castle = castleOf(board, move);
  if (castle) {
    board[castle.rookTo] = board[castle.rook] ?? null;
    board[castle.rook] = null;
  }
  board[to] = move.promotion ? pieceOf(side, move.promotion) : piece;
  board[from] = null;

  // A king moving, or anything leaving or landing on a corner, ends the castling it guards.
  let castling = pos.castling;
  for (const right of Object.keys(CASTLES) as Right[]) {
    const { king, rook } = CASTLES[right];
    if (from === king || from === rook || to === rook) castling = castling.replace(right, '');
  }
  const pawnJump = kindOf(piece) === 'p' && Math.abs(rowOf(to) - rowOf(from)) === 2;
  return {
    board,
    turn: other(side),
    castling,
    ep: pawnJump ? (from + to) / 2 : null,
  };
}

/** Every legal move of the piece on `from`: its own rule, and its side not left in check. */
export function legalMovesFrom(pos: Position, from: number): Move[] {
  const piece = pos.board[from];
  if (!piece || sideOf(piece) !== pos.turn) return [];
  return pseudoMoves(pos, from).filter((m) => !inCheck(play(pos, m).board, pos.turn));
}

/** The squares the piece on `from` may legally go to (each once, promotions or not). */
export function legalTargets(pos: Position, from: number): number[] {
  return [...new Set(legalMovesFrom(pos, from).map((m) => m.to))];
}

/** Every legal move of the side to move. */
export function legalMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < pos.board.length; from++) moves.push(...legalMovesFrom(pos, from));
  return moves;
}

/** Whether the side to move has any legal move (stops at the first one). */
export function canMove(pos: Position): boolean {
  for (let from = 0; from < pos.board.length; from++) {
    const piece = pos.board[from];
    if (!piece || sideOf(piece) !== pos.turn) continue;
    for (const move of pseudoMoves(pos, from)) {
      if (!inCheck(play(pos, move).board, pos.turn)) return true;
    }
  }
  return false;
}

/**
 * Neither side can ever mate: kings alone, one knight or bishop, or only bishops all on squares
 * of one color.
 */
export function insufficientMaterial(board: Cell[]): boolean {
  const rest: { kind: Kind; sq: number }[] = [];
  board.forEach((piece, sq) => {
    if (piece && kindOf(piece) !== 'k') rest.push({ kind: kindOf(piece), sq });
  });
  if (rest.length <= 1) return rest.every(({ kind }) => kind === 'b' || kind === 'n');
  const shade = (sq: number) => (rowOf(sq) + colOf(sq)) % 2;
  return (
    rest.every(({ kind }) => kind === 'b') &&
    rest.every(({ sq }) => shade(sq) === shade(rest[0]?.sq ?? 0))
  );
}

/**
 * The position as text: equal keys mean the same position (FIDE: same pieces, side to move,
 * castling rights and en passant captures possible).
 */
export function positionKey(pos: Position): string {
  const epOpen =
    pos.ep !== null &&
    pos.board.some(
      (piece, sq) =>
        piece === pieceOf(pos.turn, 'p') && legalMovesFrom(pos, sq).some((m) => m.to === pos.ep),
    );
  const board = pos.board.map((c) => c ?? '.').join('');
  return `${board} ${pos.turn} ${pos.castling || '-'} ${epOpen && pos.ep !== null ? nameOf(pos.ep) : '-'}`;
}
