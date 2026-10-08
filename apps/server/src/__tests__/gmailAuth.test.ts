import "dotenv/config";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

/*
  The one-time Gmail authorisation flow, without talking to Google: the consent URL it builds, and every way the
  callback must refuse a request that does not belong to the browser that started the flow. (Trading a real code
  for a token needs Google and a person at a consent screen, so that step is checked by hand: docs/EMAIL.md.)
 */

let app: express.Express;
let startFlow: () => Promise<{ location: URL; state: string; cookie: string }>;

beforeAll(async () => {
    // The env constants are read when their module loads, so these are set before anything imports them.
    process.env["GMAIL_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com";
    process.env["GMAIL_CLIENT_SECRET"] = "test-client-secret";
    process.env["GMAIL_REDIRECT_URI"] = "http://localhost:4000/api/auth/gmail/callback";
    process.env["EMAIL_FROM"] = "RelayDesk <sender@gmail.com>";
    process.env["NODE_ENV"] = "test";

    const { gmailRoutes } = await import("../routes/gmail.route");
    const { errorHandler } = await import("../middleware/errorHandler");

    app = express();
    app.use(cookieParser());
    app.use("/api/auth/gmail", gmailRoutes);
    app.use(errorHandler);

    startFlow = async () => {
        const response = await request(app).get("/api/auth/gmail").expect(302);
        const location = new URL(response.headers["location"]!);
        const cookie = (response.headers["set-cookie"] as unknown as string[]).find((value) => value.startsWith("gmail_oauth_state="))!;
        return { location, state: location.searchParams.get("state")!, cookie };
    };
});

describe("GET /api/auth/gmail", () => {
    it("sends the browser to Google asking for the send permission only, offline, with a fresh consent", async () => {
        const { location } = await startFlow();
        expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
        expect(location.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/gmail.send");
        expect(location.searchParams.get("access_type")).toBe("offline");
        expect(location.searchParams.get("prompt")).toBe("consent");
        expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:4000/api/auth/gmail/callback");
        expect(location.searchParams.get("client_id")).toBe("test-client-id.apps.googleusercontent.com");
        expect(location.searchParams.get("login_hint")).toBe("sender@gmail.com");
        expect(location.searchParams.get("response_type")).toBe("code");
    });

    it("ties the flow to this browser with a random state in an httpOnly cookie", async () => {
        const first = await startFlow();
        const second = await startFlow();
        expect(first.state).toMatch(/^[0-9a-f]{64}$/);
        expect(first.state).not.toBe(second.state);
        expect(first.cookie).toContain(`gmail_oauth_state=${first.state}`);
        expect(first.cookie).toMatch(/HttpOnly/i);
        expect(first.cookie).toMatch(/Path=\/api\/auth\/gmail/);
        expect(first.cookie).toMatch(/SameSite=Lax/i);
    });
});

describe("GET /api/auth/gmail/callback refuses anything that is not this browser's own flow", () => {
    it("rejects a callback with no state cookie (someone else's link, or an expired session)", async () => {
        const response = await request(app).get("/api/auth/gmail/callback?code=abc&state=whatever").expect(400);
        expect(response.body.errors[0].message).toMatch(/Invalid or expired authorization session/);
    });

    it("rejects a state that does not match the cookie", async () => {
        const { cookie } = await startFlow();
        await request(app).get("/api/auth/gmail/callback?code=abc&state=not-the-state").set("Cookie", cookie.split(";")[0]!).expect(400);
    });

    it("rejects a Google error such as the user pressing cancel", async () => {
        const { cookie, state } = await startFlow();
        const response = await request(app)
            .get(`/api/auth/gmail/callback?error=access_denied&state=${state}`)
            .set("Cookie", cookie.split(";")[0]!)
            .expect(400);
        expect(response.body.errors[0].message).toMatch(/denied or failed/);
    });

    it("rejects a callback with a correct state but no code", async () => {
        const { cookie, state } = await startFlow();
        const response = await request(app).get(`/api/auth/gmail/callback?state=${state}`).set("Cookie", cookie.split(";")[0]!).expect(400);
        expect(response.body.errors[0].message).toMatch(/Missing authorization code/);
    });

    it("clears the state cookie so a state can only be tried once", async () => {
        const { cookie, state } = await startFlow();
        const response = await request(app).get(`/api/auth/gmail/callback?state=${state}`).set("Cookie", cookie.split(";")[0]!);
        const cleared = (response.headers["set-cookie"] as unknown as string[]).find((value) => value.startsWith("gmail_oauth_state="));
        expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
});
