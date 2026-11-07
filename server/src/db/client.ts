import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as schema from './schema.js';

const dbPath = pathToFileURL(
  fileURLToPath(new URL('../../repointerview.db', import.meta.url)),
).href;

export const client = createClient({ url: dbPath });
export const db = drizzle(client, { schema });

await client.execute('PRAGMA journal_mode = WAL');
await client.execute('PRAGMA foreign_keys = ON');
