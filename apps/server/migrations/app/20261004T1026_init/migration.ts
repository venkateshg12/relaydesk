#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/faecf20207b42ccdc4d4299f57121f5a088213f3157682926cb01054f9255c36/contract';
import endContract from '../../snapshots/faecf20207b42ccdc4d4299f57121f5a088213f3157682926cb01054f9255c36/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'conversation',
        columns: [
          col('agentLastReadSeq', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('assigneeId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('firstAgentReplyAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastAssigneeId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastMessageAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('lastMessagePreview', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastSeq', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('resolvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('unassigned'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('visitorId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('visitorLastReadSeq', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'conversation_status_check_b9fdd56b',
            "\"status\" IN ('unassigned', 'assigned', 'resolved')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'invitation',
        columns: [
          col('acceptedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('invitedById', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'member',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('agent'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('active'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('member_role_check_b3266c03', "\"role\" IN ('admin', 'agent')"),
          checkExpression('member_status_check_83a17ead', "\"status\" IN ('active', 'removed')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'message',
        columns: [
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('clientMessageId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('conversationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('senderMemberId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('senderType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('seq', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('message_body_len_d02407bd', 'char_length(body) BETWEEN 1 AND 4000'),
          checkExpression(
            'message_senderType_check_667d540d',
            "\"senderType\" IN ('visitor', 'agent', 'system')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'note',
        columns: [
          col('authorId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('conversationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'savedReply',
        columns: [
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdById', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('shortcut', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'session',
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
          col('prevRefreshJti', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('refreshJti', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rotatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'visitor',
        columns: [
          col('displayNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('firstSeenAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastPageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastSeenAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'workspace',
        columns: [
          col('awayMessage', 'text', {
            notNull: true,
            default: lit("We're away right now — leave your email and we'll reply."),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('demoExpiresAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('greeting', 'text', {
            notNull: true,
            default: lit('Hi, how can we help?'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('isDemo', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('publicKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('widgetColor', 'text', {
            notNull: true,
            default: lit('#4F46E5'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'conversation',
        constraint: 'conversation_visitorId_key',
        columns: ['visitorId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'invitation',
        constraint: 'invitation_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'workspace',
        constraint: 'workspace_publicKey_key',
        columns: ['publicKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_assigneeId_idx_fd12ae38',
        columns: ['assigneeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_inbox_order_b2490df0',
        expression: '"workspaceId", status, "lastMessageAt" DESC',
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_workspaceId_assigneeId_status_idx_c1842f8e',
        columns: ['workspaceId', 'assigneeId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invitation',
        index: 'invitation_workspaceId_email_idx_7f289aec',
        columns: ['workspaceId', 'email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invitation',
        index: 'invitation_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'member',
        index: 'member_email_lower_f84d49fd',
        expression: 'lower(email)',
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'member',
        index: 'member_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'member',
        index: 'member_workspaceId_status_idx_76d68132',
        columns: ['workspaceId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_conversation_client_msg_unique_f0846157',
        columns: ['conversationId', 'clientMessageId'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_conversation_seq_unique_bc632ab2',
        columns: ['conversationId', 'seq'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'note',
        index: 'note_conversationId_createdAt_idx_44d4ac61',
        columns: ['conversationId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'note',
        index: 'note_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'savedReply',
        index: 'saved_reply_shortcut_lower_4c0467e8',
        expression: '"workspaceId", lower(shortcut)',
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_memberId_idx_76b3c263',
        columns: ['memberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'visitor',
        index: 'visitor_workspaceId_email_idx_7f289aec',
        columns: ['workspaceId', 'email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'visitor',
        index: 'visitor_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workspace',
        index: 'workspace_isDemo_demoExpiresAt_idx_42807021',
        columns: ['isDemo', 'demoExpiresAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversation',
        foreignKey: {
          name: 'conversation_visitorId_fkey',
          columns: ['visitorId'],
          references: { schema: 'public', table: 'visitor', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversation',
        foreignKey: {
          name: 'conversation_assigneeId_fkey',
          columns: ['assigneeId'],
          references: { schema: 'public', table: 'member', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'invitation',
        foreignKey: {
          name: 'invitation_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'member',
        foreignKey: {
          name: 'member_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message',
        foreignKey: {
          name: 'message_conversationId_fkey',
          columns: ['conversationId'],
          references: { schema: 'public', table: 'conversation', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'note',
        foreignKey: {
          name: 'note_conversationId_fkey',
          columns: ['conversationId'],
          references: { schema: 'public', table: 'conversation', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'session',
        foreignKey: {
          name: 'session_memberId_fkey',
          columns: ['memberId'],
          references: { schema: 'public', table: 'member', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'visitor',
        foreignKey: {
          name: 'visitor_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
