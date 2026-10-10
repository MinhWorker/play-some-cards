/**
 * Things a player can own (Túi đồ) and buy at Chợ, as data. Ids are namespaced (`core:` for the
 * platform's own; a game or event adds `<id>:…`). Each item is a look for one slot: equipping it
 * changes how the player shows to everyone (the frame round their avatar, the back of their cards).
 *
 * Free items (price 0) belong to everyone and are never stored. Append new items; never reuse
 * or rename an id, since inventories keep them.
 */
import { DEFAULT_FRAME, FRAMES, type Frame } from './account.js';

/** Where an item goes when equipped. */
export const ITEM_SLOTS = ['frame', 'card-back'] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

/** Card backs (`card-back-<id>.webp` in the client's SDK). */
export const CARD_BACKS = ['lattice', 'lotus'] as const;
export type CardBack = (typeof CARD_BACKS)[number];
export const DEFAULT_CARD_BACK: CardBack = 'lattice';

export interface ItemDef {
  id: string;
  slot: ItemSlot;
  /** The look it gives: a `Frame` for frames, a `CardBack` for card backs. */
  look: string;
  /** Shown at Chợ and in Túi đồ. */
  name: string;
  /** In `core:coin`; 0 = everyone has it. */
  price: number;
}

const FRAME_ITEMS: Record<Frame, { name: string; price: number }> = {
  gold: { name: 'Khung vàng', price: 0 },
  silver: { name: 'Khung bạc', price: 0 },
  bronze: { name: 'Khung đồng', price: 0 },
  jade: { name: 'Khung ngọc bích', price: 200 },
  sapphire: { name: 'Khung lam ngọc', price: 300 },
  ruby: { name: 'Khung hồng ngọc', price: 400 },
  amethyst: { name: 'Khung thạch anh tím', price: 400 },
  rose: { name: 'Khung hoa hồng', price: 600 },
};

const BACK_ITEMS: Record<CardBack, { name: string; price: number }> = {
  lattice: { name: 'Lưng bài ô trám', price: 0 },
  lotus: { name: 'Lưng bài hoa sen', price: 300 },
};

export const ITEMS: readonly ItemDef[] = [
  ...FRAMES.map((look) => ({
    id: `core:frame-${look}`,
    slot: 'frame' as const,
    look,
    ...FRAME_ITEMS[look],
  })),
  ...CARD_BACKS.map((look) => ({
    id: `core:card-back-${look}`,
    slot: 'card-back' as const,
    look,
    ...BACK_ITEMS[look],
  })),
];

export const getItem = (id: string) => ITEMS.find((item) => item.id === id);

/** The item that gives this look in this slot. */
export const itemFor = (slot: ItemSlot, look: string) =>
  ITEMS.find((item) => item.slot === slot && item.look === look);

/** The look each slot has before anything is equipped. */
export const DEFAULT_LOOKS: Record<ItemSlot, string> = {
  frame: DEFAULT_FRAME,
  'card-back': DEFAULT_CARD_BACK,
};
