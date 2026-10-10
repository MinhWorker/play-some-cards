import { Inject, Injectable, Optional } from '@nestjs/common';
import { type Catalog, type GameCard, gameCard, games, genres } from '@xomdao/shared';
import { RoomsService } from '../rooms/rooms.service.js';

export const SHOW_WIP = Symbol('SHOW_WIP');

/**
 * Works in progress reach dev servers and are hidden on Render (production, where `RENDER` is
 * set). `XOMDAO_SHOW_WIP=1` or `0` overrides it.
 */
export const showWipProvider = {
  provide: SHOW_WIP,
  useValue: process.env.XOMDAO_SHOW_WIP ? process.env.XOMDAO_SHOW_WIP === '1' : !process.env.RENDER,
};

/** The hub's catalog: the core genre list and a card per game that names a genre. */
@Injectable()
export class CatalogService {
  constructor(
    private readonly rooms: RoomsService,
    @Optional() @Inject(SHOW_WIP) private readonly showWip = true,
  ) {}

  catalog(): Catalog {
    const cards: GameCard[] = [];
    for (const game of Object.values(games)) {
      const card = gameCard(game);
      if (!card || (card.status === 'wip' && !this.showWip)) continue;
      cards.push({ ...card, ...this.rooms.activity(game.id) });
    }
    cards.sort(
      (a, b) =>
        Number(a.status === 'wip') - Number(b.status === 'wip') ||
        a.name.localeCompare(b.name, 'vi'),
    );
    return { genres: [...genres].sort((a, b) => a.order - b.order), games: cards };
  }
}
