import { buildMimeMessage, encodeHeaderText, isValidEmailAddress, parseMailbox, toBase64Url } from "../utils/email/mime";

// What a mail client would show: the headers, and each part's decoded body.
const parse = (message: string) => {
    const [head = "", ...rest] = message.split("\r\n\r\n");
    const unfolded = head.replace(/\r\n[ \t]/g, " ");
    const headers = Object.fromEntries(unfolded.split("\r\n").map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 2)]));
    const boundary = /boundary="([^"]+)"/.exec(headers["Content-Type"] ?? "")?.[1] ?? "";
    const parts = rest
        .join("\r\n\r\n")
        .split(`--${boundary}`)
        .slice(1, -1)
        .map((part) => {
            const [partHead = "", body = ""] = part.trim().split("\r\n\r\n");
            return { type: /Content-Type: ([^;]+)/.exec(partHead)?.[1], text: Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8") };
        });
    return { headers, parts };
};

const base = { to: "visitor@example.com", subject: "Hello", text: "plain body", html: "<p>html body</p>" };

describe("buildMimeMessage", () => {
    it("builds a text + html message with the right headers", () => {
        const { headers, parts } = parse(buildMimeMessage({ ...base, from: "RelayDesk <noreply@gmail.com>" }));
        expect(headers["From"]).toBe('"RelayDesk" <noreply@gmail.com>');
        expect(headers["To"]).toBe("visitor@example.com");
        expect(headers["Subject"]).toBe("Hello");
        expect(headers["MIME-Version"]).toBe("1.0");
        expect(parts).toEqual([
            { type: "text/plain", text: "plain body" },
            { type: "text/html", text: "<p>html body</p>" },
        ]);
    });

    it("leaves From out when none is set, so Gmail uses the authorised account", () => {
        expect(parse(buildMimeMessage(base)).headers["From"]).toBeUndefined();
    });

    it("cannot be made to add headers or recipients through the subject, name or address", () => {
        const message = buildMimeMessage({ ...base, subject: "Hi\r\nBcc: attacker@evil.com" });
        const { headers } = parse(message);
        expect(headers["Bcc"]).toBeUndefined();
        expect(message).not.toMatch(/^Bcc:/m);
        expect(headers["Subject"]).toBe("Hi Bcc: attacker@evil.com");
        // A sender name with a line break is refused outright rather than cleaned up.
        expect(() => buildMimeMessage({ ...base, from: '"Evil\r\nBcc: attacker@evil.com" <noreply@gmail.com>' })).toThrow("Invalid sender");
        expect(() => buildMimeMessage({ ...base, to: "a@example.com\r\nBcc: b@example.com" })).toThrow("Invalid recipient");
        expect(() => buildMimeMessage({ ...base, to: "a@example.com, b@example.com" })).toThrow("Invalid recipient");
    });

    it("encodes non-ASCII subjects and names, and keeps the body intact", () => {
        const subject = "Votre réponse de Crème Brûlée — 你好 🎂 ".repeat(3);
        const { headers, parts } = parse(buildMimeMessage({ ...base, subject, from: "Bäckerei <noreply@gmail.com>", text: "Grüße 🎂" }));
        // Readers join adjacent encoded words without the folding space between them.
        const decode = (value: string) =>
            value
                .replace(/\?=\s+(?==\?UTF-8\?B\?)/g, "?=")
                .replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, encoded: string) => Buffer.from(encoded, "base64").toString("utf8"));
        expect(decode(headers["Subject"]!)).toBe(subject.trim());
        expect(decode(headers["From"]!)).toBe("Bäckerei <noreply@gmail.com>");
        expect(parts[0]!.text).toBe("Grüße 🎂");
    });

    it("keeps every encoded word within the 75-character limit and never splits a character", () => {
        const encoded = encodeHeaderText("🎂".repeat(40));
        for (const word of encoded.split("\r\n ")) expect(word.length).toBeLessThanOrEqual(75);
        expect(encoded.split("\r\n ").map((word) => Buffer.from(/\?B\?(.+)\?=/.exec(word)![1]!, "base64").toString("utf8")).join("")).toBe("🎂".repeat(40));
    });

    it("wraps body lines at 76 characters", () => {
        const message = buildMimeMessage({ ...base, text: "x".repeat(500) });
        const bodyLines = message.split("\r\n").filter((line) => /^[A-Za-z0-9+/=]+$/.test(line) && !line.startsWith("rd_"));
        expect(bodyLines.length).toBeGreaterThan(5);
        for (const line of bodyLines) expect(line.length).toBeLessThanOrEqual(76);
    });
});

describe("addresses", () => {
    it("accepts normal addresses and rejects anything that could change the recipient list", () => {
        for (const ok of ["a@b.co", "first.last+tag@sub.example.com"]) expect(isValidEmailAddress(ok)).toBe(true);
        for (const bad of ["", "a@b", "a b@c.com", "a@c.com,d@e.com", "<a@c.com>", "a@c.com\n", '"a"@c.com', "a@c.com;d@e.com"])
            expect(isValidEmailAddress(bad)).toBe(false);
    });

    it("parses Name <address>, a quoted name and a bare address", () => {
        expect(parseMailbox('RelayDesk <noreply@gmail.com>')).toEqual({ name: "RelayDesk", address: "noreply@gmail.com" });
        expect(parseMailbox('"RelayDesk" <noreply@gmail.com>')).toEqual({ name: "RelayDesk", address: "noreply@gmail.com" });
        expect(parseMailbox("noreply@gmail.com")).toEqual({ name: "", address: "noreply@gmail.com" });
        expect(parseMailbox("RelayDesk")).toBeNull();
    });
});

describe("toBase64Url", () => {
    it("uses the URL-safe alphabet without padding, as the Gmail API requires", () => {
        const encoded = toBase64Url("subjects?>>>~~~ÿÿ");
        expect(encoded).not.toMatch(/[+/=]/);
        expect(Buffer.from(encoded, "base64url").toString("utf8")).toBe("subjects?>>>~~~ÿÿ");
    });
});
