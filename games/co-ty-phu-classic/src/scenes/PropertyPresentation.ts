import type { Property } from '../game/model.js';

type Snapshot = { sequence: number; afterRoll: number; properties: Property[]; notice: string };

/** Ownership changes wait behind the roll and every transfer belonging to their event. */
export class PropertyPresentation {
  private queue: Snapshot[] = [];

  enqueue(snapshot: Snapshot) {
    this.queue.push({
      ...snapshot,
      properties: snapshot.properties.map((property) => ({ ...property })),
    });
  }

  drain(completedRoll: number, blockedSequence = Infinity): Snapshot[] {
    const ready: Snapshot[] = [];
    while (
      this.queue[0] &&
      this.queue[0].afterRoll <= completedRoll &&
      this.queue[0].sequence < blockedSequence
    )
      ready.push(this.queue.shift()!);
    return ready;
  }

  reset() {
    this.queue = [];
  }
}
