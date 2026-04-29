import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

/**
 * Returns a singleton Aurora Serverless PostgreSQL connection pool.
 * Uses RDS Data API connection string injected via Lambda environment variables.
 */
export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err);
    });
  }
  return pool;
}

/**
 * Executes a query within a transaction.
 * Automatically rolls back on error.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Sets the tenant_id for RLS (Row-Level Security) in current session.
 * MUST be called at the start of every Lambda invocation that touches Aurora.
 */
export async function setTenantContext(
  client: PoolClient,
  tenantId: string
): Promise<void> {
  await client.query(`SET app.current_tenant_id = '${tenantId}'`);
}

/**
 * Helper: Run a simple query with tenant RLS applied.
 */
export async function queryWithTenant<T = any>(
  sql: string,
  params: any[],
  tenantId: string
): Promise<T[]> {
  const client = await getDbPool().connect();
  try {
    await setTenantContext(client, tenantId);
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}
