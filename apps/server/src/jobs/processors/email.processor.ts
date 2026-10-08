import { Job, UnrecoverableError } from "bullmq";
import type { SendInvitationPayload, SendOfflineReplyPayload } from "../interfaces/jobPayload.js";
import { getInvitationEmail, getOfflineReplyEmail, MailError, sendMail } from "../../utils/email/index.js";
import { orm } from "../../prisma/db.js";
import { pool } from "../../config/db.js";
import { redisConnection } from "../redis/connection.js";
import { OFFLINE_REPLY_WINDOW_MS, offlineReplySentKey } from "../producers/email.producer.js";

// A permanent failure (a bad address, a revoked token) ends the job now; anything else is retried with backoff.
const failedSend = (error: Error, message: string) =>
    error instanceof MailError && !error.isRetryable
        ? new UnrecoverableError(`${message}: ${error.message}`)
        : new Error(`${message}: ${error.message}`);

export async function processSendInvitation(job: Job<SendInvitationPayload>) {
    const { invitationId, email, workspaceName, inviterName, token } = job.data;

    job.log(`[Start] Sending Invitation Email to ${email} (Invitation ID: ${invitationId})`);

    if (!email || !email.includes("@")) {
        throw new UnrecoverableError(`Invalid email format: ${email}`);
    }

    // Check Postgres state: if invitation was revoked or already accepted, skip delivery
    const invitation = await orm.Invitation.where({ id: invitationId }).first();
    if (!invitation) {
        job.log(`[Invitation] Invitation ${invitationId} no longer exists. Skipping.`);
        return { status: "skipped", reason: "Invitation not found or revoked" };
    }

    if (invitation.acceptedAt) {
        job.log(`[Invitation] Invitation ${invitationId} already accepted. Skipping.`);
        return { status: "skipped", reason: "Invitation already accepted" };
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
        job.log(`[Invitation] Invitation ${invitationId} expired. Skipping.`);
        return { status: "skipped", reason: "Invitation expired" };
    }

    const emailTemplate = getInvitationEmail(workspaceName, inviterName, token);

    job.log(`[Gmail] Delivering invitation email to ${email}`);
    const { data, error } = await sendMail({
        to: email,
        ...emailTemplate,
    });

    if (error) {
        job.log(`[Error] Failed to send email to ${email}: ${error.message}`);
        throw failedSend(error, `Failed to send email to ${email}`);
    }

    job.log(`[Success] Invitation email delivered to ${email}`);
    return { status: "sent", deliveredAt: new Date().toISOString(), info: data };
}

/*
  Emails a visitor who wasn't in the chat the replies they haven't read. Everything is read from
  Postgres now: if the visitor came back and read them in the meantime (or gave no email, or never
  reported a page to link back to) there is nothing to send.
 */
export async function processSendOfflineReply(job: Job<SendOfflineReplyPayload>) {
    const { workspaceId, conversationId } = job.data;

    const conversation = await orm.Conversation.where({ id: conversationId, workspaceId }).first();
    const visitor = conversation
        ? await orm.Visitor.where({ id: conversation.visitorId, workspaceId }).select("email", "lastPageUrl").first()
        : null;
    if (!conversation || !visitor?.email || !visitor.lastPageUrl) {
        return { status: "skipped", reason: "No conversation, email or page to link back to" };
    }

    const { rows } = await pool.query<{ body: string; senderName: string | null }>(
        `SELECT m."body", sender."name" AS "senderName"
           FROM "public"."message" m
           LEFT JOIN "public"."member" sender
             ON sender."id" = m."senderMemberId" AND sender."workspaceId" = m."workspaceId"
          WHERE m."conversationId" = $1 AND m."workspaceId" = $2
            AND m."senderType" = 'agent' AND m."seq" > $3
          ORDER BY m."seq" DESC
          LIMIT 5`,
        [conversationId, workspaceId, conversation.visitorLastReadSeq]
    );
    if (rows.length === 0) return { status: "skipped", reason: "The visitor has read every reply" };

    const replies = rows.reverse();
    const agentName = replies[replies.length - 1]!.senderName ?? "The team";
    // The link goes back to where the visitor was, but only as a plain address: no credentials, query or
    // fragment, and only http(s) — a visitor-supplied URL must not carry anything else into an email.
    const page = new URL(visitor.lastPageUrl);
    if (page.protocol !== "http:" && page.protocol !== "https:") return { status: "skipped", reason: "Unusable page address" };
    const chatLink = `${page.origin}${page.pathname}`;

    const emailTemplate = getOfflineReplyEmail(agentName, replies.map((reply) => reply.body).join("\n\n"), chatLink);

    const { data, error } = await sendMail({ to: visitor.email, ...emailTemplate });
    if (error) throw failedSend(error, `Failed to send offline reply for conversation ${conversationId}`);

    await redisConnection.set(offlineReplySentKey(conversationId), "1", "PX", OFFLINE_REPLY_WINDOW_MS);
    job.log(`[Success] Offline reply email delivered for conversation ${conversationId}`);
    return { status: "sent", deliveredAt: new Date().toISOString(), info: data };
}
