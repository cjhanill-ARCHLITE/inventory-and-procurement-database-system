import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import fs from 'node:fs';

let pgliteInstance: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (pgliteInstance) {
    return pgliteInstance;
  }

  // Ensure data directory exists for persistent storage
  const dataDir = path.resolve(process.cwd(), 'data', 'ipds_pg_data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
    console.log('[DB] PGlite PostgreSQL initialized successfully at:', dataDir);
  } catch (err) {
    console.warn('[DB] Persistent storage error, falling back to memory database:', err);
    pgliteInstance = new PGlite();
    await pgliteInstance.waitReady;
  }

  return pgliteInstance;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const db = await getDb();
  const res = await db.query<T>(sql, params || []);
  return {
    rows: (res.rows as T[]) || [],
    rowCount: res.rows ? res.rows.length : 0,
  };
}

export async function transaction<T>(callback: (client: { query: typeof query }) => Promise<T>): Promise<T> {
  const db = await getDb();
  await db.query('BEGIN');
  try {
    const txClient = {
      query: async <R = any>(sql: string, params?: any[]) => {
        const res = await db.query<R>(sql, params || []);
        return {
          rows: (res.rows as R[]) || [],
          rowCount: res.rows ? res.rows.length : 0,
        };
      },
    };
    const result = await callback(txClient);
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}
