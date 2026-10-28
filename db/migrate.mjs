// Aplica db/schema.sql no banco apontado por DATABASE_URL (Neon).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const aqui = dirname(fileURLToPath(import.meta.url));

function carregarEnv() {
  const arq = join(aqui, '..', '.env');
  if (!existsSync(arq)) return;
  for (const linha of readFileSync(arq, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

carregarEnv();
if (!process.env.DATABASE_URL) {
  console.error('Defina DATABASE_URL (arquivo .env ou variável de ambiente).');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(readFileSync(join(aqui, 'schema.sql'), 'utf8'));
  console.log('Esquema aplicado com sucesso.');
} finally {
  await client.end();
}
