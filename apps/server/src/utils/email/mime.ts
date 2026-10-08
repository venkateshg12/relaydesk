import crypto from "node:crypto";

/*
  Builds the raw RFC 5322 message the Gmail API's `messages.send` wants, so no mail library is needed.
  Everything in a header comes from somewhere that is not fully trusted (a visitor's email address, an
  invitation's workspace name), so a header value can never contain a line break: that is how an attacker
  would add a `Bcc:` header or a second recipient.
 */

export interface MimeMessage {
    // `Name <address>`, a bare address, or empty — Gmail then sends from the authorised account.
    from?: string;
    to: string;
    subject: string;
    text: string;
    html: string;
}

// A deliberately plain address check. It exists to stop header injection and obvious typos; the real
// verdict on whether a mailbox exists belongs to the mail servers.
const ADDRESS_PATTERN = /^[^\s@<>",;()[\]\\]+@[^\s@<>",;()[\]\\]+\.[^\s@<>",;()[\]\\]+$/;

export const isValidEmailAddress = (value: string) => value.length <= 254 && ADDRESS_PATTERN.test(value);

// Splits `Name <address>` (or a bare address) into its two parts. Returns null when the address is invalid.
export const parseMailbox = (value: string): { name: string; address: string } | null => {
    const trimmed = value.trim();
    const match = /^(.*?)\s*<([^<>]+)>$/.exec(trimmed);
    const address = (match ? match[2]! : trimmed).trim();
    if (!isValidEmailAddress(address)) return null;
    const name = (match ? match[1]! : "").trim().replace(/^"(.*)"$/, "$1");
    return { name, address };
};

const singleLine = (value: string) => value.replace(/[\r\n\u2028\u2029]+/g, " ").trim();

const isAscii = (value: string) => /^[\x20-\x7e]*$/.test(value);

/*
  RFC 2047 "encoded words" for non-ASCII header text. Each word may be at most 75 characters, so the text is
  cut into pieces of up to 45 bytes — by whole characters, never in the middle of a UTF-8 sequence — and the
  pieces are joined with a folded line break, which mail clients read back as one string.
 */
export const encodeHeaderText = (value: string) => {
    const text = singleLine(value);
    if (isAscii(text)) return text;

    const pieces: string[] = [];
    let current = "";
    for (const character of text) {
        if (Buffer.byteLength(current + character) > 45) {
            pieces.push(current);
            current = "";
        }
        current += character;
    }
    if (current) pieces.push(current);

    return pieces.map((piece) => `=?UTF-8?B?${Buffer.from(piece).toString("base64")}?=`).join("\r\n ");
};

const formatMailbox = ({ name, address }: { name: string; address: string }) => {
    if (!name) return address;
    if (!isAscii(name)) return `${encodeHeaderText(name)} <${address}>`;
    return `"${singleLine(name).replace(/(["\\])/g, "\\$1")}" <${address}>`;
};

// Base64 body lines are at most 76 characters (RFC 2045).
const foldBase64 = (value: string) => Buffer.from(value, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");

const textPart = (type: string, body: string) =>
    `Content-Type: ${type}; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${foldBase64(body)}`;

export const buildMimeMessage = ({ from, to, subject, text, html }: MimeMessage) => {
    const recipient = parseMailbox(to);
    if (!recipient) throw new Error("Invalid recipient address");

    const sender = from ? parseMailbox(from) : null;
    if (from && !sender) throw new Error("Invalid sender address");

    const boundary = `rd_${crypto.randomBytes(16).toString("hex")}`;
    const headers = [
        ...(sender ? [`From: ${formatMailbox(sender)}`] : []),
        `To: ${recipient.address}`,
        `Subject: ${encodeHeaderText(subject)}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];

    // The plain-text version comes first and the HTML last: clients show the last alternative they understand.
    return [
        headers.join("\r\n"),
        "",
        `--${boundary}`,
        textPart("text/plain", text),
        `--${boundary}`,
        textPart("text/html", html),
        `--${boundary}--`,
        "",
    ].join("\r\n");
};

// The Gmail API takes the message as URL-safe base64 (RFC 4648 §5).
export const toBase64Url = (message: string) => Buffer.from(message, "utf8").toString("base64url");
