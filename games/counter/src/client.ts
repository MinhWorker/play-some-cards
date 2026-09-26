/** Browser entry: the game's screen (a `GameView`). */
import { defineClient } from '@psc/sdk/client';
import { CounterView } from './scenes/CounterView.js';

export default defineClient({ scene: CounterView });
