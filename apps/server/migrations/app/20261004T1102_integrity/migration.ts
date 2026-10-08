#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/e482d1f39159edb3fb63c2a36e9bcfe4d8353fe82095cfcc271afb6496b452fc/contract';
import endContract from '../../snapshots/e482d1f39159edb3fb63c2a36e9bcfe4d8353fe82095cfcc271afb6496b452fc/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/faecf20207b42ccdc4d4299f57121f5a088213f3157682926cb01054f9255c36/contract';
import startContract from '../../snapshots/faecf20207b42ccdc4d4299f57121f5a088213f3157682926cb01054f9255c36/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'conversation',
        constraint: 'conversation_assigneeId_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'conversation',
        constraint: 'conversation_visitorId_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_assigneeId_idx_fd12ae38',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'message',
        constraint: 'message_conversationId_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'message',
        index: 'message_conversationId_idx_669215a6',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'note',
        constraint: 'note_conversationId_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'note',
        index: 'note_conversationId_idx_669215a6',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'session',
        constraint: 'session_memberId_fkey',
        kind: 'foreignKey',
      }),
      this.addColumn({
        schema: 'public',
        table: 'workspace',
        column: col('lastVisitorNo', 'int4', {
          notNull: true,
          default: lit(1000),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'conversation',
        constraint: 'conversation_assigned_has_assignee_02d268fc',
        expression: 'status <> \'assigned\' OR "assigneeId" IS NOT NULL',
      }),
      this.addUnique({
        schema: 'public',
        table: 'conversation',
        constraint: 'conversation_id_workspaceId_key',
        columns: ['id', 'workspaceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'conversation',
        constraint: 'conversation_visitorId_workspaceId_key',
        columns: ['visitorId', 'workspaceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'member',
        constraint: 'member_id_workspaceId_key',
        columns: ['id', 'workspaceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'visitor',
        constraint: 'visitor_id_workspaceId_key',
        columns: ['id', 'workspaceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'visitor',
        constraint: 'visitor_workspaceId_displayNo_key',
        columns: ['workspaceId', 'displayNo'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_assigneeId_workspaceId_idx_8d375dda',
        columns: ['assigneeId', 'workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_lastAssigneeId_workspaceId_idx_8e76be1d',
        columns: ['lastAssigneeId', 'workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invitation',
        index: 'invitation_invitedById_workspaceId_idx_f01be214',
        columns: ['invitedById', 'workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_conversationId_workspaceId_idx_724e6e39',
        columns: ['conversationId', 'workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_senderMemberId_workspaceId_idx_81b6b9a4',
        columns: ['senderMemberId', 'workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'note',
        index: 'note_authorId_workspaceId_idx_6074ad30',
        columns: ['authorId', 'workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'note',
        index: 'note_conversationId_workspaceId_idx_724e6e39',
        columns: ['conversationId', 'workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'savedReply',
        index: 'savedReply_createdById_workspaceId_idx_0beb1bc2',
        columns: ['createdById', 'workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'savedReply',
        index: 'savedReply_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_memberId_workspaceId_idx_c1e7305c',
        columns: ['memberId', 'workspaceId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversation',
        foreignKey: {
          name: 'conversation_assigneeId_workspaceId_fkey',
          columns: ['assigneeId', 'workspaceId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'workspaceId'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversation',
        foreignKey: {
          name: 'conversation_lastAssigneeId_workspaceId_fkey',
          columns: ['lastAssigneeId', 'workspaceId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'workspaceId'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversation',
        foreignKey: {
          name: 'conversation_visitorId_workspaceId_fkey',
          columns: ['visitorId', 'workspaceId'],
          references: { schema: 'public', table: 'visitor', columns: ['id', 'workspaceId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'invitation',
        foreignKey: {
          name: 'invitation_invitedById_workspaceId_fkey',
          columns: ['invitedById', 'workspaceId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'workspaceId'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message',
        foreignKey: {
          name: 'message_conversationId_workspaceId_fkey',
          columns: ['conversationId', 'workspaceId'],
          references: { schema: 'public', table: 'conversation', columns: ['id', 'workspaceId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message',
        foreignKey: {
          name: 'message_senderMemberId_workspaceId_fkey',
          columns: ['senderMemberId', 'workspaceId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'workspaceId'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'note',
        foreignKey: {
          name: 'note_authorId_workspaceId_fkey',
          columns: ['authorId', 'workspaceId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'workspaceId'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'note',
        foreignKey: {
          name: 'note_conversationId_workspaceId_fkey',
          columns: ['conversationId', 'workspaceId'],
          references: { schema: 'public', table: 'conversation', columns: ['id', 'workspaceId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'savedReply',
        foreignKey: {
          name: 'savedReply_createdById_workspaceId_fkey',
          columns: ['createdById', 'workspaceId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'workspaceId'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'savedReply',
        foreignKey: {
          name: 'savedReply_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'session',
        foreignKey: {
          name: 'session_memberId_workspaceId_fkey',
          columns: ['memberId', 'workspaceId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'workspaceId'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
