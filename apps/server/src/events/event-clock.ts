import { Injectable } from '@nestjs/common';

/**
 * The time events go by: when they open and close, and whether points still count. It is the
 * real time unless moved: `XOMDAO_NOW` (an ISO date) at start, or `dev:clock` in dev mode, so
 * an event can be tried outside its dates.
 */
@Injectable()
export class EventClock {
  private offset = 0;

  constructor() {
    if (process.env.XOMDAO_NOW) this.set(process.env.XOMDAO_NOW);
  }

  now(): number {
    return Date.now() + this.offset;
  }

  /** Moves the clock to `at` (an ISO date), or back to the real time with `null`. */
  set(at: string | null) {
    if (at === null) {
      this.offset = 0;
      return;
    }
    const time = Date.parse(at);
    if (Number.isNaN(time)) throw new Error(`Not a date: ${at}`);
    this.offset = time - Date.now();
  }
}
