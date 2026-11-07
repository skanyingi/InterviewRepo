import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as schema from './schema.js';

const defaultDbPath = fileURLToPath(new URL('../../repointerview.db', import.meta.url));
const dbPath = pathToFileURL(
  process.env.DB_FILE ? resolve(process.env.DB_FILE) : defaultDbPath,
).href;

export const client = createClient({ url: dbPath });
export const db = drizzle(client, { schema });

await client.execute('PRAGMA journal_mode = WAL');
await client.execute('PRAGMA foreign_keys = ON');
