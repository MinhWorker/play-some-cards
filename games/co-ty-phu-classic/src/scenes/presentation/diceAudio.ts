import type { FlowContext } from '@psc/sdk/client';
import { Dice3D } from './Dice3D.js';
import type { DiceMotion } from './diceMotion.js';

type Cue = readonly [progress: number, sound: string];
const CUES: Record<DiceMotion, readonly Cue[]> = {
  tumble: [[0, 'tycoon-dice']],
  arc: [
    [0, 'tycoon-dice-arc'],
    [1, 'tycoon-dice-land'],
  ],
  skipping: [
    [0.2, 'tycoon-dice-skipping'],
    [0.4, 'tycoon-dice-skipping'],
    [0.6, 'tycoon-dice-skipping'],
    [0.8, 'tycoon-dice-skipping'],
    [1, 'tycoon-dice-land'],
  ],
  spiral: [
    [0, 'tycoon-dice-spiral'],
    [0.12, 'tycoon-dice-spiral'],
    [0.29, 'tycoon-dice-spiral'],
    [0.51, 'tycoon-dice-spiral'],
    [0.8, 'tycoon-dice-spiral'],
    [1, 'tycoon-dice-land'],
  ],
};

/** Cue onsets follow the animation clock, including fast playback and cancellation.
 * Short native-audio tails may overlap; they never push subsequent cues off their beat.
 */
export function playDiceSound(fx: FlowContext, motion: DiceMotion) {
  return fx.parallel(
    ...CUES[motion].map(([progress, sound]) => async (cue: FlowContext) => {
      if (progress > 0) await cue.wait(progress * Dice3D.rollDuration);
      await cue.sound(sound, { wait: 'finished', maxStartDelayMs: 80 });
    }),
  );
}
