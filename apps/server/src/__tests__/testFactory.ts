import crypto from "crypto";
import { pool } from "../config/db.js";
import { createSessionAndTokens, signUpService } from "../services/auth.service.js";
import { getOrCreateVisitorSessionService } from "../services/visitor.service.js";
import { hashValue } from "../utils/auth/password.js";

export interface TestMember {
  id: string;
  email: string;
  name: string;
  // The Cookie header of a real session for this member, as if they had logged in.
  cookie: string;
}

export interface TestWorkspaceContext {
  workspaceId: string;
  publicKey: string;
  admin: TestMember;
  agent: TestMember;
  visitor: { id: string; token: string };
}

const cookieOf = ({ accessToken, refreshToken }: { accessToken: string; refreshToken: string }) =>
  `accessToken=${accessToken}; refreshToken=${refreshToken}`;

// A member with a session, added to an existing workspace.
export async function addTestMember(workspaceId: string, name: string, role: "admin" | "agent" = "agent"): Promise<TestMember> {
  const email = `test_${role}_${crypto.randomUUID()}@test.com`;
  const { rows } = await pool.query(
    `INSERT INTO "public"."member" ("id", "workspaceId", "name", "email", "passwordHash", "role")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING "id"`,
    [workspaceId, name, email, await hashValue("Password123!"), role]
  );
  const tokens = await createSessionAndTokens({ id: rows[0].id, workspaceId, role }, "jest");
  return { id: rows[0].id, email, name, cookie: cookieOf(tokens) };
}

export async function addTestVisitor(publicKey: string) {
  const session = await getOrCreateVisitorSessionService({ publicKey });
  return { id: session.visitor.id, token: session.token };
}

// A whole business: workspace + admin (through the real sign-up), one agent, one visitor. Every test file
// builds its own, so files share nothing and can run in parallel.
export async function createTestWorkspace(): Promise<TestWorkspaceContext> {
  const unique = crypto.randomUUID();
  const adminEmail = `test_admin_${unique}@test.com`;

  const adminAuth = await signUpService({
    name: "Test Admin",
    email: adminEmail,
    password: "Password123!",
    businessName: `Test Workspace ${unique}`,
  });
  const workspaceId = adminAuth.workspace.id;
  const publicKey = adminAuth.workspace.publicKey;

  return {
    workspaceId,
    publicKey,
    admin: { id: adminAuth.member.id, email: adminEmail, name: "Test Admin", cookie: cookieOf(adminAuth) },
    agent: await addTestMember(workspaceId, "Test Agent"),
    visitor: await addTestVisitor(publicKey),
  };
}

// One DELETE: every table cascades from the workspace and the member references are deferred (phase 01).
export async function cleanupTestWorkspace(workspaceId: string) {
  if (!workspaceId) return;
  await pool.query(`DELETE FROM "public"."workspace" WHERE "id" = $1`, [workspaceId]);
}
