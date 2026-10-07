import { z } from 'zod';

export const TRACK_LENGTH = 52;
export const TURN_MS = 30_000;
export const ROLL_MS = 620;
export const STEP_MS = 110;
export const optionsSchema = z.object({ bots: z.number().int().min(0).max(3).default(0) });
export type Options = z.infer<typeof optionsSchema>;

export interface Horse {
  /** -1 = paddock, 0..51 = distance from start, 52..57 = home squares 1..6. */
  position: number;
  finished: boolean;
}

export interface Move {
  horse: number;
  to: number;
  path: number[];
  capture: { seat: number; horse: number } | null;
  finish: boolean;
}

export interface State {
  horses: Horse[][];
  /** Color index per seat; two players sit opposite each other. */
  colors: number[];
  turn: number;
  phase: 'roll' | 'choose' | 'pause';
  dice: number | null;
  lastRoll: { seat: number; value: number } | null;
  lastMove: (Move & { seat: number; from: number }) | null;
  notice: string;
  moves: number;
  winner: number | null;
}

export const squareOf = (state: State, seat: number, position: number) =>
  ((state.colors[seat] ?? 0) * 13 + position) % TRACK_LENGTH;

/** A horse blocks every intermediate square; only an opponent at the destination is kicked. */
export function legalMoves(state: State): Move[] {
  const dice = state.dice;
  if (!dice || state.winner !== null) return [];
  const seat = state.turn;
  const team = state.horses[seat] ?? [];
  const target = 6 - team.filter((horse) => horse.finished).length;
  const occupied = (position: number, moving: number) => {
    for (const [s, horses] of state.horses.entries()) {
      for (const [h, horse] of horses.entries()) {
        if ((s === seat && h === moving) || horse.position < 0) continue;
        if (position >= TRACK_LENGTH) {
          if (s === seat && horse.position === position) return { seat: s, horse: h };
        } else if (
          horse.position < TRACK_LENGTH &&
          squareOf(state, s, horse.position) === squareOf(state, seat, position)
        ) {
          return { seat: s, horse: h };
        }
      }
    }
    return null;
  };
  return team.flatMap((horse, index): Move[] => {
    if (horse.finished) return [];
    const from = horse.position;
    let to: number;
    if (from < 0) {
      if (dice !== 1 && dice !== 6) return [];
      to = 0;
    } else if (from === TRACK_LENGTH - 1) {
      if (dice > target) return [];
      to = TRACK_LENGTH - 1 + dice;
    } else if (from >= TRACK_LENGTH) {
      // Inside the stable, promote one square by rolling its printed number.
      if (dice !== from - TRACK_LENGTH + 2 || dice > target) return [];
      to = from + 1;
    } else {
      to = from + dice;
      if (to >= TRACK_LENGTH) return [];
    }
    const path = Array.from({ length: to - from }, (_, i) => from + i + 1);
    for (const step of path.slice(0, -1)) if (occupied(step, index)) return [];
    const capture = occupied(to, index);
    if (capture && (capture.seat === seat || to >= TRACK_LENGTH)) return [];
    return [{ horse: index, to, path, capture, finish: to === TRACK_LENGTH - 1 + target }];
  });
}

export function preferredMove(state: State): Move | undefined {
  return legalMoves(state).sort(
    (a, b) =>
      Number(b.finish) * 1000 +
      Number(Boolean(b.capture)) * 200 +
      b.to -
      (Number(a.finish) * 1000 + Number(Boolean(a.capture)) * 200 + a.to),
  )[0];
}
