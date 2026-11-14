import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql, type SQL } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

export type DB = PostgresJsDatabase<typeof schema>;

type Holder = { db?: Promise<DB>; kind?: 'postgres' | 'pglite' };
const g = globalThis as unknown as { __icdb?: Holder };
const holder: Holder = (g.__icdb ??= {});

export function dbKind(): 'postgres' | 'pglite' {
  return process.env.DATABASE_URL ? 'postgres' : 'pglite';
}

async function open(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
    holder.kind = 'postgres';
    return drizzlePg(client, { schema });
  }
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is not set');
  }
  // Local development fallback: an embedded Postgres stored in .data/
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzleLite } = await import('drizzle-orm/pglite');
  const dir = path.join(process.cwd(), '.data', 'pglite');
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.exec(fs.readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8'));
  holder.kind = 'pglite';
  return drizzleLite(client, { schema }) as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!holder.db) {
    holder.db = open().catch((e) => {
      holder.db = undefined;
      throw e;
    });
  }
  return holder.db;
}

/** Run raw SQL and get rows back, regardless of driver. */
export async function q<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const db = await getDb();
  const res = (await db.execute(query)) as unknown;
  if (Array.isArray(res)) return res as T[];
  const r = res as { rows?: T[] };
  return r.rows ?? [];
}

export { sql, schema };
