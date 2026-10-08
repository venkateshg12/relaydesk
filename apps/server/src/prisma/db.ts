import 'dotenv/config';
import pg from 'pg';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
// A plain JSON import, so the build bundles the contract into `dist` instead of reading a file next to it.
import contractJson from './contract.json' with { type: 'json' };

// One pool shared by the ORM and by hand-written SQL (health check, dashboard reports).
export const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL']! });

export const db = postgres<Contract>({
  contractJson,
  pg: pool,
});

// Every model here lives in the `public` schema, so callers reach for `orm.Session`,
// `orm.Member`, etc. instead of repeating `db.orm.public.<Model>` everywhere.
export const orm = db.orm.public;
