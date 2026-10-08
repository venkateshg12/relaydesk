import crypto from "crypto";
import request from "supertest";
import { pool } from "../config/db.js";
import { cache } from "../utils/cache/index.js";
import { orm } from "../prisma/db.js";
import { emailQueue } from "../jobs/queues/email.queue.js";
import { redisConnection } from "../jobs/redis/connection.js";
import { googleSignInService, loginUser, changePasswordService } from "../services/auth.service.js";
import { acceptInvitationWithGoogleService } from "../services/team.service.js";
import { createVerificationToken } from "../utils/auth/verificationToken.js";
import type { GoogleProfile } from "../utils/auth/google.js";
import { cleanupTestWorkspace, createTestWorkspace, type TestWorkspaceContext } from "./testFactory.js";
import { startTestServer, type TestServer } from "./helpers/server.js";

/*
  Google sign-in, below the token check (Google's own signature check can't run in a test): every decision the
  service makes once it holds a verified profile, plus the endpoint's behaviour when Google is not configured.
 */
describe("Google sign-in", () => {
  let ctx: TestWorkspaceContext;
  let server: TestServer;
  const createdWorkspaces: string[] = [];
  const profile = (overrides: Partial<GoogleProfile> = {}): GoogleProfile => ({
    googleId: crypto.randomUUID(),
    email: `google_${crypto.randomUUID()}@test.com`,
    name: "Gina Google",
    avatar: "https://example.test/a.png",
    ...overrides,
  });

  beforeAll(async () => {
    ctx = await createTestWorkspace();
    server = await startTestServer();
  });

  afterAll(async () => {
    await Promise.all([ctx.workspaceId, ...createdWorkspaces].map(cleanupTestWorkspace));
    await server.close();
    await cache.close();
    await emailQueue.close();
    redisConnection.disconnect();
    await pool.end();
  });

  test("an unknown email with no business name is 'sign up first', and creates nothing", async () => {
    const p = profile();
    await expect(googleSignInService(p, {})).rejects.toMatchObject({ statusCode: 404 });
    expect(await orm.Member.where({ email: p.email }).first()).toBeNull();
  });

  test("with a business name it creates the workspace and its admin; the next sign-in is the same member", async () => {
    const p = profile();
    const first = await googleSignInService(p, { businessName: "Gina's Bakery" });
    createdWorkspaces.push(first.workspace.id);
    expect(first.member).toMatchObject({ email: p.email, role: "admin", authProvider: "google", googleId: p.googleId });
    expect(first.member).not.toHaveProperty("passwordHash");

    const again = await googleSignInService(p, {});
    expect(again.member.id).toBe(first.member.id);
    expect(again.workspace.id).toBe(first.workspace.id);
  });

  test("an email that belongs to a password account is refused, never linked", async () => {
    await expect(googleSignInService(profile({ email: ctx.admin.email }), {})).rejects.toMatchObject({ statusCode: 409 });
    const member = await orm.Member.where({ id: ctx.admin.id, workspaceId: ctx.workspaceId }).first();
    expect(member?.googleId).toBeNull();
  });

  test("a Google-only account has no password: password login fails and changing it is refused", async () => {
    const p = profile();
    const { member } = await googleSignInService(p, { businessName: "No Password Co" });
    createdWorkspaces.push(member.workspaceId);

    await expect(loginUser({ email: p.email, password: "Password123!" })).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      changePasswordService(member.id, member.workspaceId, crypto.randomUUID(), {
        currentPassword: "Password123!",
        newPassword: "Another-Pass-123!",
        confirmPassword: "Another-Pass-123!",
      } as never)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("accepting an invitation with Google: the wrong Google email is refused and the link survives, the right one joins", async () => {
    const invited = `invited_${crypto.randomUUID()}@test.com`;
    const { token, tokenHash } = createVerificationToken();
    await orm.Invitation.create({
      workspaceId: ctx.workspaceId,
      email: invited,
      tokenHash,
      invitedById: ctx.admin.id,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    await expect(acceptInvitationWithGoogleService(token, profile())).rejects.toMatchObject({ statusCode: 403 });

    const joined = await acceptInvitationWithGoogleService(token, profile({ email: invited }));
    expect(joined.member).toMatchObject({ email: invited, role: "agent", workspaceId: ctx.workspaceId, authProvider: "google" });
    await expect(acceptInvitationWithGoogleService(token, profile({ email: invited }))).rejects.toMatchObject({ statusCode: 400 });
  });

  test("the endpoint says so when Google sign-in is not configured", async () => {
    const response = await request(server.url).post("/auth/google").send({ idToken: "anything" });
    expect(response.status).toBe(500);
    expect(response.body.errors[0].message).toMatch(/not configured/i);
  });
});
