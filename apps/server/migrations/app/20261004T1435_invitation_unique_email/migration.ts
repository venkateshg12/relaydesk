#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2b5bd50fd07720ab367bfee955eb53a2ee8ab6c1824b1f59e91b9b6d8ceb75c4/contract';
import endContract from '../../snapshots/2b5bd50fd07720ab367bfee955eb53a2ee8ab6c1824b1f59e91b9b6d8ceb75c4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e482d1f39159edb3fb63c2a36e9bcfe4d8353fe82095cfcc271afb6496b452fc/contract';
import startContract from '../../snapshots/e482d1f39159edb3fb63c2a36e9bcfe4d8353fe82095cfcc271afb6496b452fc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropIndex({
        schema: 'public',
        table: 'invitation',
        index: 'invitation_workspaceId_email_idx_7f289aec',
      }),
      this.createIndex({
        schema: 'public',
        table: 'invitation',
        index: 'invitation_workspace_email_lower_0d97222b',
        expression: '"workspaceId", lower(email)',
        extras: { unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
