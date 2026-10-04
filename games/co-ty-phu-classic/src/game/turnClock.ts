import type { Seat } from '@psc/sdk';
import type { State } from './model.js';

type DecisionState = Pick<State, 'turn' | 'phase' | 'auction' | 'trade' | 'debt'>;

export function decisionSeat(state: DecisionState) {
  return state.phase === 'auction'
    ? (state.auction?.bidder ?? state.turn)
    : state.phase === 'trade'
      ? (state.trade?.to ?? state.turn)
      : state.phase === 'debt'
        ? (state.debt?.payer ?? state.turn)
        : state.turn;
}

export function hasPvpClock(state: State, players: Seat[]) {
  return players.filter((p) => !p.bot && !p.left && !state.players[p.seat]?.bankrupt).length >= 2;
}

/** Optional property management does not give the waiting decision another deadline. */
export function decisionKey(state: State) {
  const event = state.specialEvent;
  return JSON.stringify([
    state.turn,
    state.phase,
    state.pending,
    state.auction,
    state.trade,
    state.debt && { payer: state.debt.payer, amount: state.debt.amount, reason: state.debt.reason },
    event && { ...event, ready: undefined },
  ]);
}
