import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, types } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

// int8 (COUNT) e numeric chegam como número, não como texto
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

export interface Db {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
}

/**
 * Acesso ao PostgreSQL. Em produção usa o Neon via `pg` (DATABASE_URL).
 * Sem DATABASE_URL e com USE_PGLITE=1 usa um Postgres embutido em memória
 * (somente para testes locais/automatizados).
 * Todas as consultas são parametrizadas ($1, $2...).
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly log = new Logger(DatabaseService.name);
  private pool?: Pool;
  private lite?: Promise<any>;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (url) {
      this.pool = new Pool({
        connectionString: url,
        max: process.env.VERCEL ? 3 : 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 15000,
      });
      this.pool.on('error', (e) => this.log.error(`Erro no pool: ${e.message}`));
    } else if (process.env.USE_PGLITE === '1') {
      this.lite = this.iniciarLite();
    } else {
      throw new Error('Defina DATABASE_URL (string de conexão do Neon).');
    }
  }

  private async iniciarLite() {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite();
    await db.exec(readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
    return db;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.pool) return (await this.pool.query(sql, params)).rows as T[];
    const db = await this.lite!;
    return (await db.query(sql, params)).rows as T[];
  }

  async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const resultado = await fn({
          query: async (sql, params = []) => (await client.query(sql, params)).rows,
        });
        await client.query('COMMIT');
        return resultado;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    }
    const db = await this.lite!;
    return db.transaction((t: any) =>
      fn({ query: async (sql: string, params: any[] = []) => (await t.query(sql, params)).rows }),
    );
  }

  async onModuleDestroy() {
    if (this.pool) await this.pool.end();
    else if (this.lite) await (await this.lite).close();
  }
}
