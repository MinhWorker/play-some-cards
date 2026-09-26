/** Browser entry: the game's screen (a `GameView`). */
import { defineClient } from '@psc/sdk/client';
import { CounterView } from './scenes/CounterView.js';

// No winner to lose: leaving mid-game needs no "are you sure?".
export default defineClient({ scene: CounterView, leaveConfirm: false });
