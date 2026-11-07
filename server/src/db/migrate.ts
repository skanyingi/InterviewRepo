import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { client } from './client.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

await client.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  applied_at INTEGER NOT NULL
)`);

const applied = new Set(
  (await client.execute('SELECT name FROM schema_migrations')).rows.map((row) =>
    String(row.name),
  ),
);

const files = readdirSync(migrationsFolder)
  .filter((file) => file.endsWith('.sql'))
  .sort();

for (const file of files) {
  if (applied.has(file)) continue;

  const sql = readFileSync(join(migrationsFolder, file), 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  const tx = await client.transaction('write');
  try {
    for (const statement of statements) {
      await tx.execute(statement);
    }
    await tx.execute({
      sql: 'INSERT INTO schema_migrations (name, hash, applied_at) VALUES (?, ?, ?)',
      args: [file, createHash('sha256').update(sql).digest('hex'), Date.now()],
    });
    await tx.commit();
    console.log(`Applied ${file}`);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
);
console.log('Tables:', tables.rows.map((row) => row.name).join(', '));
client.close();
