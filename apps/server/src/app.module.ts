import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module.js';
import { DbModule } from './db/db.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthController } from './health.controller.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { ShopModule } from './shop/shop.module.js';
import { StatsModule } from './stats/stats.module.js';

// The server only answers /api and the /ws WebSocket: the Godot client is hosted on its own
// (Vercel in production, scripts/web.mjs in dev).
@Module({
  imports: [
    DbModule,
    AccountsModule,
    MatchesModule,
    LedgerModule,
    InventoryModule,
    ShopModule,
    EventsModule,
    StatsModule,
    RoomsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
