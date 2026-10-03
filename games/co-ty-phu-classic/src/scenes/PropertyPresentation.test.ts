import { expect, it } from 'vitest';
import { PropertyPresentation } from './PropertyPresentation.js';

it('keeps a purchase behind its roll and all transfers of the same event', () => {
  const queue = new PropertyPresentation();
  const properties = [{ owner: null as number | null, houses: 0, mortgaged: false }];
  queue.enqueue({ sequence: 1, afterRoll: 1, properties, notice: 'Đến đất' });
  properties[0]!.owner = 0;
  queue.enqueue({ sequence: 2, afterRoll: 1, properties, notice: 'Mua đất' });
  queue.enqueue({ sequence: 3, afterRoll: 2, properties, notice: 'Lượt máy' });
  expect(queue.drain(0, 2)).toEqual([]);
  expect(queue.drain(1, 2).map((snapshot) => snapshot.properties[0]?.owner)).toEqual([null]);
  expect(queue.drain(1, 2)).toEqual([]);
  expect(queue.drain(1).map((snapshot) => snapshot.sequence)).toEqual([2]);
  expect(queue.drain(2).map((snapshot) => snapshot.sequence)).toEqual([3]);
});

it('drops old snapshots on a new game', () => {
  const queue = new PropertyPresentation();
  queue.enqueue({ sequence: 1, afterRoll: 1, properties: [], notice: '' });
  queue.reset();
  expect(queue.drain(100)).toEqual([]);
});
