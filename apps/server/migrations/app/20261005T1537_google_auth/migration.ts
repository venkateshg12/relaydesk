#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1b8015cbad4c0a125522404c9ca5a1b0cc09addaa2f5779ea605d3d6c874bc5d/contract';
import endContract from '../../snapshots/1b8015cbad4c0a125522404c9ca5a1b0cc09addaa2f5779ea605d3d6c874bc5d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/2b5bd50fd07720ab367bfee955eb53a2ee8ab6c1824b1f59e91b9b6d8ceb75c4/contract';
import startContract from '../../snapshots/2b5bd50fd07720ab367bfee955eb53a2ee8ab6c1824b1f59e91b9b6d8ceb75c4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'member',
        column: col('authProvider', 'text', {
          notNull: true,
          default: lit('local'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'member',
        column: col('avatar', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'member',
        column: col('googleId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'member', column: 'passwordHash' }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'member',
        constraint: 'member_authProvider_check_7916b13c',
        expression: "\"authProvider\" IN ('local', 'google')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'member',
        constraint: 'member_googleId_key',
        columns: ['googleId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
