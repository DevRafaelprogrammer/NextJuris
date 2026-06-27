import { Pool, PoolConfig, PoolClient, QueryResult } from "pg";
import { env } from "./env";
import { logger } from "../utils/logger";

interface DatabaseStatus {
  connected: boolean;
  pool: {
    total: number;
    idle: number;
    waiting: number;
  };
  server: {
    version: string;
    database: string;
    user: string;
    uptime: string;
    timezone: string;
  } | null;
  latency: number;
  lastCheck: string;
}

let pool: Pool | null = null;
let connectionVerified = false;

function hasValidDatabaseUrl(): boolean {
  return !!env.DATABASE_URL && !env.DATABASE_URL.includes("SUA_SENHA") && env.DATABASE_URL.length > 20;
}

function getPoolConfig(): PoolConfig {
  const isProduction = env.NODE_ENV === "production";

  if (!hasValidDatabaseUrl()) {
    return {
      host: "localhost",
      port: 5432,
      database: "nextjuris",
      max: 1,
      connectionTimeoutMillis: 3000,
      application_name: "nextjuris-backend",
    };
  }

  return {
    connectionString: env.DATABASE_URL,
    max: isProduction ? 20 : 5,
    min: isProduction ? 5 : 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: !isProduction,
    application_name: "nextjuris-backend",
    ssl: env.DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig());

    pool.on("connect", (client: PoolClient) => {
      logger.debug("Pool: new client connected");
      client.query("SET timezone = 'America/Sao_Paulo'");
    });

    pool.on("error", (err: Error) => {
      logger.error("Pool: unexpected error on idle client", { message: err.message });
      connectionVerified = false;
    });

    pool.on("remove", () => {
      logger.debug("Pool: client removed");
    });
  }
  return pool;
}

export async function query<T extends Record<string, any> = any>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  const p = getPool();
  const start = performance.now();
  try {
    const result = await p.query<T>(text, params);
    const elapsed = Math.round(performance.now() - start);
    if (elapsed > 500) {
      logger.warn(`Slow query [${elapsed}ms]: ${text.slice(0, 120)}`);
    }
    return result;
  } catch (err: any) {
    logger.error("Query error", { message: err.message, query: text.slice(0, 120) });
    throw err;
  }
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function verifyConnection(retries = 3, delayMs = 2000): Promise<boolean> {
  if (!hasValidDatabaseUrl()) {
    logger.info("DATABASE_URL not configured — skipping PostgreSQL direct connection");
    return false;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await query("SELECT 1 AS ok");
      if (result.rows[0]?.ok === 1) {
        connectionVerified = true;
        logger.info(`Database connected (attempt ${attempt}/${retries})`);
        return true;
      }
    } catch (err: any) {
      logger.warn(`Database connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      }
    }
  }
  connectionVerified = false;
  logger.error(`Database connection failed after ${retries} attempts`);
  return false;
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const start = performance.now();
  try {
    const p = getPool();
    const [infoResult] = await Promise.all([
      query<{
        version: string;
        db: string;
        usr: string;
        uptime: string;
        tz: string;
      }>(`
        SELECT
          version() AS version,
          current_database() AS db,
          current_user AS usr,
          (NOW() - pg_postmaster_start_time())::text AS uptime,
          current_setting('TIMEZONE') AS tz
      `),
    ]);

    const latency = Math.round(performance.now() - start);
    const info = infoResult.rows[0];

    return {
      connected: true,
      pool: {
        total: p.totalCount,
        idle: p.idleCount,
        waiting: p.waitingCount,
      },
      server: {
        version: info.version.split(",")[0],
        database: info.db,
        user: info.usr,
        uptime: info.uptime,
        timezone: info.tz,
      },
      latency,
      lastCheck: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      connected: false,
      pool: { total: 0, idle: 0, waiting: 0 },
      server: null,
      latency: Math.round(performance.now() - start),
      lastCheck: new Date().toISOString(),
    };
  }
}

export async function getTableStats(): Promise<Record<string, number>> {
  const result = await query<{ table_name: string; row_count: number }>(`
    SELECT
      relname AS table_name,
      n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
  `);
  const stats: Record<string, number> = {};
  for (const row of result.rows) {
    stats[row.table_name] = row.row_count;
  }
  return stats;
}

export async function disconnectDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    connectionVerified = false;
    logger.info("Database pool closed");
  }
}

export function isConnected(): boolean {
  return connectionVerified;
}
