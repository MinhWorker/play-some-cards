import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { EventClock } from './event-clock.js';
import { EVENTS_STORE, EventsService } from './events.service.js';
import { MemoryEventsStore, PgEventsStore } from './events.store.js';

@Global()
@Module({
  providers: [
    {
      provide: EVENTS_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgEventsStore(db) : new MemoryEventsStore()),
    },
    EventClock,
    EventsService,
  ],
  exports: [EventsService, EventClock],
})
export class EventsModule {}
