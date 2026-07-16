import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg, { type Pool, type PoolClient, type QueryResultRow } from "pg";

import { config } from "./config.js";

const { Pool: PgPool } = pg;

export const appDb = new PgPool({ connectionString: config.databaseUrl, max: 12 });
export const billingDb = config.billingDatabaseUrl ? new PgPool({ connectionString: config.billingDatabaseUrl, max: 8 }) : appDb;

export async function migrateDatabases() {
    const appMigration = await readFile(fileURLToPath(new URL("./migrations/001_init.sql", import.meta.url)), "utf8");
    const marketplaceMigration = await readFile(fileURLToPath(new URL("./migrations/003_marketplace.sql", import.meta.url)), "utf8");
    const libraryMigration = await readFile(fileURLToPath(new URL("./migrations/004_library.sql", import.meta.url)), "utf8");
    const userTokenMigration = await readFile(fileURLToPath(new URL("./migrations/005_user_tokens.sql", import.meta.url)), "utf8");
    const billingMigration = await readFile(fileURLToPath(new URL("./migrations/002_billing.sql", import.meta.url)), "utf8");
    await appDb.query(appMigration);
    await appDb.query(marketplaceMigration);
    await appDb.query(libraryMigration);
    await appDb.query(userTokenMigration);
    const billingTable = await billingDb.query<{ table_name: string | null }>(
        "SELECT to_regclass('public.aikart_balance_settlements')::text AS table_name",
    );
    if (!billingTable.rows[0]?.table_name) await billingDb.query(billingMigration);
}

export async function withTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await run(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function one<T extends QueryResultRow>(pool: Pool, text: string, values: unknown[] = []) {
    const result = await pool.query<T>(text, values);
    return result.rows[0] || null;
}

export async function closeDatabases() {
    await appDb.end();
    if (billingDb !== appDb) await billingDb.end();
}
