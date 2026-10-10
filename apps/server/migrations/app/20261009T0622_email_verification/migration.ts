#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1b8015cbad4c0a125522404c9ca5a1b0cc09addaa2f5779ea605d3d6c874bc5d/contract';
import startContract from '../../snapshots/1b8015cbad4c0a125522404c9ca5a1b0cc09addaa2f5779ea605d3d6c874bc5d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8f24885b07261561803424bab33bc525dac3dbbd15d33a4db84dfe28dcca1590/contract';
import endContract from '../../snapshots/8f24885b07261561803424bab33bc525dac3dbbd15d33a4db84dfe28dcca1590/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'emailVerification',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('memberId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'member',
        column: col('emailVerified', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'emailVerification',
        constraint: 'emailVerification_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'emailVerification',
        constraint: 'emailVerification_memberId_workspaceId_key',
        columns: ['memberId', 'workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailVerification',
        index: 'emailVerification_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'emailVerification',
        foreignKey: {
          name: 'emailVerification_memberId_workspaceId_fkey',
          columns: ['memberId', 'workspaceId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'workspaceId'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
