/** Create tables on DATABASE_URL. Idempotent. Run: npm run db:setup */
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const sqlText = fs.readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8');
  const client = postgres(url, { max: 1 });
  await client.unsafe(sqlText);
  await client.end();
  console.log('schema ready');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
