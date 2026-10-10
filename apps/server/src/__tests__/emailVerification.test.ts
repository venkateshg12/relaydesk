import crypto from "crypto";
import request from "supertest";
import { pool } from "../config/db.js";
import { cache } from "../utils/cache/index.js";
import { orm } from "../prisma/db.js";
import { emailQueue } from "../jobs/queues/email.queue.js";
import { redisConnection } from "../jobs/redis/connection.js";
import { EmailProducer } from "../jobs/producers/email.producer.js";
import type { SendVerificationPayload } from "../jobs/interfaces/jobPayload.js";
import { googleSignInService, loginUser, signUpService, verifyEmailService } from "../services/auth.service.js";
import { hashVerificationToken } from "../utils/auth/verificationToken.js";
import { verificationEmailTemplate } from "../utils/email/html_templates.js";
import { cleanupTestWorkspace } from "./testFactory.js";
import { startTestServer, type TestServer } from "./helpers/server.js";

/*
  Sign-up email verification, end to end below the mail itself: sign-up signs nobody in, login refuses an unverified
  account, the emailed link works once, and the rows behind it are what the design promises. The job queue is stubbed
  (the test captures the payload, which is where the raw token lives), because the queue may be a shared one and no
  test should ever cause a real email.
 */
describe("email verification on sign-up", () => {
  let server: TestServer;
  const workspaces: string[] = [];
  const queued: SendVerificationPayload[] = [];
  const realAddJob = EmailProducer.addSendVerificationJob;

  const signUp = async () => {
    const email = `verify_${crypto.randomUUID()}@test.com`;
    const result = await signUpService({
      name: "Vera Verify",
      email,
      password: "Password123!",
      businessName: `Verify Co ${crypto.randomUUID()}`,
    });
    const member = (await orm.Member.where({ email }).first())!;
    workspaces.push(member.workspaceId);
    return { ...result, member, token: queued.filter((job) => job.memberId === member.id).at(-1)?.token ?? "" };
  };

  beforeAll(async () => {
    EmailProducer.addSendVerificationJob = async (payload) => {
      queued.push(payload);
      return undefined as never;
    };
    server = await startTestServer();
  });

  afterAll(async () => {
    EmailProducer.addSendVerificationJob = realAddJob;
    await Promise.all(workspaces.map(cleanupTestWorkspace));
    await server.close();
    await cache.close();
    await emailQueue.close();
    redisConnection.disconnect();
    await pool.end();
  });

  test("sign-up creates an unverified member, queues one email and signs nobody in", async () => {
    const { email, member, token } = await signUp();

    expect(member.emailVerified).toBe(false);
    expect(queued.filter((job) => job.memberId === member.id)).toHaveLength(1);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // The service returns only what the page needs: no member row, no session tokens.
    await expect(
      signUpService({ name: "Vera Verify", email: `x_${crypto.randomUUID()}@test.com`, password: "Password123!", businessName: "X Co" })
        .then(async (r) => {
          workspaces.push((await orm.Member.where({ email: r.email }).first())!.workspaceId);
          return Object.keys(r).sort();
        })
    ).resolves.toEqual(["email", "workspaceName"]);
    expect(email).toBe(member.email);
  });

  test("the HTTP sign-up answers 201 and sets no cookie", async () => {
    const email = `http_${crypto.randomUUID()}@test.com`;
    const response = await request(server.url)
      .post("/auth/signup")
      .send({ name: "Hank Http", email, password: "Password123!", businessName: `Http Co ${crypto.randomUUID()}` });
    workspaces.push((await orm.Member.where({ email }).first())!.workspaceId);

    expect(response.status).toBe(201);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.body.data).toMatchObject({ email, requiresVerification: true });
    expect(response.body.data).not.toHaveProperty("member");
  });

  test("only a hash of the token is stored, and there is one live link per member", async () => {
    const { member, token } = await signUp();
    const rows = await orm.EmailVerification.where({ memberId: member.id }).all();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashVerificationToken(token));
    expect(rows[0]!.tokenHash).not.toBe(token);
    const hoursLeft = (new Date(rows[0]!.expiresAt).getTime() - Date.now()) / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(23.9);
    expect(hoursLeft).toBeLessThanOrEqual(24);
  });

  test("an unverified account cannot log in: 403 EMAIL_NOT_VERIFIED, over the service and over HTTP", async () => {
    const { member } = await signUp();

    await expect(loginUser({ email: member.email, password: "Password123!" })).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "EMAIL_NOT_VERIFIED",
    });
    // A wrong password is still the ordinary 401: nothing is revealed to someone who doesn't know it.
    await expect(loginUser({ email: member.email, password: "wrong-password" })).rejects.toMatchObject({ statusCode: 401 });

    const response = await request(server.url).post("/auth/login").send({ email: member.email, password: "Password123!" });
    expect(response.status).toBe(403);
    expect(response.body.errors[0].code).toBe("EMAIL_NOT_VERIFIED");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("a login attempt does not re-send within the cooldown, however often it is repeated", async () => {
    const { member } = await signUp();
    const before = queued.filter((job) => job.memberId === member.id).length;

    for (let i = 0; i < 3; i += 1) await loginUser({ email: member.email, password: "Password123!" }).catch(() => undefined);

    expect(queued.filter((job) => job.memberId === member.id)).toHaveLength(before);
  });

  test("the link verifies the member once and signs them in", async () => {
    const { member, token } = await signUp();

    const first = await verifyEmailService(token, "jest");
    expect(first.member).toMatchObject({ id: member.id, emailVerified: true });
    expect(first.member).not.toHaveProperty("passwordHash");
    expect(first.workspace.id).toBe(member.workspaceId);
    expect(first.accessToken).toBeTruthy();
    expect(first.refreshToken).toBeTruthy();
    expect(await orm.EmailVerification.where({ memberId: member.id }).all()).toHaveLength(0);

    // Used once: the same link now means nothing.
    await expect(verifyEmailService(token, "jest")).rejects.toMatchObject({ statusCode: 400 });
    // And the account now logs in normally.
    await expect(loginUser({ email: member.email, password: "Password123!" })).resolves.toMatchObject({
      member: { id: member.id },
    });
  });

  test("two clicks at the same moment: exactly one wins", async () => {
    const { token } = await signUp();

    const results = await Promise.allSettled([verifyEmailService(token, "jest"), verifyEmailService(token, "jest")]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  test("an expired link, an unknown token and a malformed one are all refused", async () => {
    const { member, token } = await signUp();
    await pool.query(`UPDATE "public"."emailVerification" SET "expiresAt" = now() - interval '1 minute' WHERE "memberId" = $1`, [member.id]);

    await expect(verifyEmailService(token, "jest")).rejects.toMatchObject({ statusCode: 400 });
    await expect(verifyEmailService(crypto.randomBytes(32).toString("hex"), "jest")).rejects.toMatchObject({ statusCode: 400 });
    expect((await orm.Member.where({ id: member.id }).first())!.emailVerified).toBe(false);

    const bad = await request(server.url).post("/auth/verify-email").send({ token: "not-a-token" });
    expect(bad.status).toBe(400);
  });

  test("the HTTP link signs in with cookies and cannot be replayed", async () => {
    const { token } = await signUp();

    const ok = await request(server.url).post("/auth/verify-email").send({ token });
    expect(ok.status).toBe(200);
    expect((ok.headers["set-cookie"] as unknown as string[] | undefined)?.join(";")).toMatch(/accessToken=/);
    expect(ok.body.data.member.emailVerified).toBe(true);

    const again = await request(server.url).post("/auth/verify-email").send({ token });
    expect(again.status).toBe(400);
  });

  test("resend replaces the link; the old one stops working; the answer never reveals whether the address exists", async () => {
    const { member, token: oldToken } = await signUp();
    // Pretend the first email went out a while ago, so the one-minute cooldown has passed.
    await pool.query(`UPDATE "public"."emailVerification" SET "createdAt" = now() - interval '5 minutes' WHERE "memberId" = $1`, [member.id]);

    const known = await request(server.url).post("/auth/verify-email/resend").send({ email: member.email });
    const unknown = await request(server.url).post("/auth/verify-email/resend").send({ email: `nobody_${crypto.randomUUID()}@test.com` });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.data).toEqual(unknown.body.data);

    const newToken = queued.filter((job) => job.memberId === member.id).at(-1)!.token;
    expect(newToken).not.toBe(oldToken);
    await expect(verifyEmailService(oldToken, "jest")).rejects.toMatchObject({ statusCode: 400 });
    await expect(verifyEmailService(newToken, "jest")).resolves.toMatchObject({ member: { id: member.id } });
  });

  test("a verified account is never re-sent a link", async () => {
    const { member, token } = await signUp();
    await verifyEmailService(token, "jest");
    const before = queued.filter((job) => job.memberId === member.id).length;

    await request(server.url).post("/auth/verify-email/resend").send({ email: member.email });

    expect(queued.filter((job) => job.memberId === member.id)).toHaveLength(before);
  });

  test("a Google account and a demo workspace's admin are verified from the start", async () => {
    const google = await googleSignInService(
      { googleId: crypto.randomUUID(), email: `g_${crypto.randomUUID()}@test.com`, name: "Gina", avatar: undefined },
      { businessName: "Gina Co" }
    );
    workspaces.push(google.workspace.id);
    expect(google.member.emailVerified).toBe(true);
    expect(google.accessToken).toBeTruthy();

    const demo = await request(server.url).post("/demo/session");
    expect(demo.status).toBe(201);
    workspaces.push(demo.body.data.workspace.id);
    const demoAdmin = await orm.Member.where({ id: demo.body.data.member.id }).first();
    expect(demoAdmin!.emailVerified).toBe(true);
  });

  test("the email's markup escapes the name and carries the link", () => {
    const html = verificationEmailTemplate("https://app.example.com/verify-email/abc", `<img src=x onerror=alert(1)> "Vera"`);

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html.split("https://app.example.com/verify-email/abc").length - 1).toBe(3);
    expect(html).toContain("expires in 24 hours");
  });
});
