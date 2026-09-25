import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema> & { $client: Pool };

/** Injection token. The value is `null` when DATABASE_URL is not set (the server still runs). */
export const DB = Symbol('DB');

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

async function connect(): Promise<Db | null> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('DATABASE_URL is not set: running without a database');
    return null;
  }
  const db = drizzle({ client: new Pool({ connectionString: url }), schema });
  if (existsSync(resolve(migrationsFolder, 'meta/_journal.json'))) {
    await migrate(db, { migrationsFolder });
  }
  return db;
}

@Global()
@Module({
  providers: [{ provide: DB, useFactory: connect }],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  async onApplicationShutdown() {
    await this.db?.$client.end();
  }
}
