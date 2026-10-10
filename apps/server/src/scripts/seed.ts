import 'dotenv/config';
import crypto from 'node:crypto';
import { db, pool } from '../config/db.js';
import { hashValue } from '../utils/auth/password.js';
import { SAMPLE_BAKERY, type SampleVisitor } from '../data/sampleBakery.js';

// Two sample businesses with data in every table, for local development and demos.
// It replaces everything in the database it points at, so it refuses to run in production.

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();
const SEED_PASSWORD = 'Password123!';

type SampleBusiness = {
  name: string;
  publicKey: string;
  widgetColor: string;
  greeting: string;
  awayMessage: string;
  members: Array<{ key: string; name: string; email: string; role: 'admin' | 'agent' }>;
  invitation?: { email: string; invitedBy: string };
  visitors: SampleVisitor[];
  savedReplies: Array<{ shortcut: string; title: string; body: string }>;
};

const businesses: SampleBusiness[] = [
  {
    ...SAMPLE_BAKERY,
    publicKey: 'rd_pk_sweetcrumbsbakery0000001',
    members: [
      { key: 'sarah', name: 'Sarah Baker', email: 'sarah@sweetcrumbs.test', role: 'admin' },
      { key: 'tom', name: 'Tom Crust', email: 'tom@sweetcrumbs.test', role: 'agent' },
      { key: 'emma', name: 'Emma Dough', email: 'emma@sweetcrumbs.test', role: 'agent' },
    ],
    invitation: { email: 'clara@sweetcrumbs.test', invitedBy: 'sarah' },
  },
  {
    name: 'Northwind Books',
    publicKey: 'rd_pk_northwindbooks000000001',
    widgetColor: '#0F766E',
    greeting: 'Looking for a book? Ask us anything.',
    awayMessage: "We're away right now — leave your email and we'll reply.",
    members: [
      { key: 'arthur', name: 'Arthur Reed', email: 'arthur@northwind.test', role: 'admin' },
      { key: 'jane', name: 'Jane Fernandes', email: 'jane@northwind.test', role: 'agent' },
      { key: 'leo', name: 'Leo Mathew', email: 'leo@northwind.test', role: 'agent' },
    ],
    visitors: [{ name: 'David Cole', email: 'david@example.test', page: 'https://northwind.test/classics' }],
    savedReplies: [],
  },
];

async function seed() {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production and seeding deletes every workspace.');
  }

  const passwordHash = await hashValue(SEED_PASSWORD);

  await db.transaction(async (tx) => {
    const orm = tx.orm.public;

    // Every table hangs off a workspace with ON DELETE CASCADE, so this one delete clears them all.
    await orm.Workspace.where({}).deleteAll();

    for (const business of businesses) {
      const { members, invitation, visitors, savedReplies, ...workspaceFields } = business;
      const workspace = await orm.Workspace.create({ ...workspaceFields, lastVisitorNo: 1000 + visitors.length });
      const workspaceId = workspace.id;

      const memberIds = new Map<string, string>();
      for (const { key, ...member } of members) {
        // Sample accounts are verified: they exist to be logged into.
        const created = await orm.Member.create({ ...member, workspaceId, passwordHash, emailVerified: true });
        memberIds.set(key, created.id);
      }
      const memberId = (key: string) => {
        const id = memberIds.get(key);
        if (!id) throw new Error(`Unknown sample member "${key}" in ${business.name}`);
        return id;
      };

      const adminId = memberId(members[0]!.key);
      await orm.Session.create({
        workspaceId,
        memberId: adminId,
        userAgent: 'seed',
        refreshJti: crypto.randomUUID(),
        expiresAt: inDays(30),
      });

      if (invitation) {
        // Only the SHA-256 of an invitation token is stored; the raw token would live in the email.
        const token = crypto.randomBytes(32).toString('hex');
        await orm.Invitation.create({
          workspaceId,
          email: invitation.email,
          tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
          invitedById: memberId(invitation.invitedBy),
          expiresAt: inDays(2),
        });
      }

      for (const [index, { conversation, page, ...visitor }] of visitors.entries()) {
        const created = await orm.Visitor.create({ ...visitor, workspaceId, displayNo: 1001 + index, lastPageUrl: page });
        if (!conversation) continue;

        const { status, agent, messages, note } = conversation;
        const assigneeId = agent ? memberId(agent) : null;
        const firstAgentReply = messages.find((message) => message.from === 'agent');
        const lastMessage = messages[messages.length - 1]!;
        const now = new Date().toISOString();

        const conv = await orm.Conversation.create({
          workspaceId,
          visitorId: created.id,
          status,
          assigneeId: status === 'assigned' ? assigneeId : null,
          lastAssigneeId: assigneeId,
          lastSeq: messages.length,
          lastMessageAt: now,
          lastMessagePreview: lastMessage.body,
          visitorLastReadSeq: messages.length,
          agentLastReadSeq: status === 'unassigned' ? 0 : messages.length,
          firstAgentReplyAt: firstAgentReply ? now : null,
          resolvedAt: status === 'resolved' ? now : null,
        });

        for (const [i, message] of messages.entries()) {
          await orm.Message.create({
            workspaceId,
            conversationId: conv.id,
            seq: i + 1,
            clientMessageId: crypto.randomUUID(),
            senderType: message.from,
            senderMemberId: message.from === 'agent' ? memberId(message.agent) : null,
            body: message.body,
          });
        }

        if (note) {
          await orm.Note.create({ workspaceId, conversationId: conv.id, authorId: memberId(note.author), body: note.body });
        }
      }

      for (const reply of savedReplies) {
        await orm.SavedReply.create({ ...reply, workspaceId, createdById: adminId });
      }

      console.log(`Seeded ${business.name}: ${members.length} members, ${visitors.length} visitors`);
    }
  });

  console.log(`Done. Every sample member's password is ${SEED_PASSWORD}`);
}

seed()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
