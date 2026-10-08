import type { PoolClient } from "pg";
import { pool } from "../../config/db.js";

/*
  Runs `work` in one Postgres transaction on one pooled connection: commits when it returns, rolls back
  when it throws. For the few hot paths that need SQL the ORM can't express (`SELECT … FOR UPDATE`,
  `UPDATE … RETURNING` with CASE); everything else uses `db.transaction` and `tx.orm`.
 */
export const withPgTransaction = async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
