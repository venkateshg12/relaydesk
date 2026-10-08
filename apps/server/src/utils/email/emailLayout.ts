/*
  The one layout every RelayDesk email shares: header, heading, body, one button, a small note, the link as plain
  text for clients that block buttons, and a footer that says why the person got the email. A new email is
  `renderEmail({ ... })` plus its words — never another copy of the markup.

  Email clients are not browsers: layout is `<table>`s, every style is inline (Gmail drops most of a `<style>`
  block), the button is a table cell with a background colour rather than a styled link, and nothing relies on
  images, so the email looks the same with images blocked. The colours are the app's "ink and signal" tokens
  (`docs/DESIGN_SYSTEM.md` §4): ink for text and the one primary button, signal blue only for the brand mark and links.
 */

export const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

// Plain text → HTML that keeps the writer's line breaks. Everything a person typed goes through this.
export const textToHtml = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br />");

const COLOR = {
    canvas: "#F3F4F6",
    card: "#FFFFFF",
    ink: "#17181D",
    muted: "#5F6272",
    faint: "#8A8D9B",
    hairline: "#EBECEF",
    signal: "#2450E6",
    bubble: "#F3F4F6",
} as const;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface EmailContent {
    // The browser-tab / message title.
    title: string;
    // The grey line shown next to the subject in the inbox list. Hidden in the message itself.
    preheader: string;
    heading: string;
    // HTML, already safe: build it with `paragraph` and `quote` (which escape) — never concatenate raw text.
    bodyHtml: string;
    button?: { label: string; url: string };
    // A short line under the button, e.g. when a link expires.
    note?: string;
    // Why this person got the email. Every email says it.
    reason: string;
}

export const paragraph = (text: string) =>
    `<p class="text-muted" style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${COLOR.muted};">${textToHtml(text)}</p>`;

// A message quoted from the conversation, drawn like a chat bubble with a signal-blue edge.
export const quote = (text: string) =>
    `<div class="quote text-ink" style="margin:4px 0 24px 0;padding:14px 18px;background:${COLOR.bubble};border-left:3px solid ${COLOR.signal};border-radius:10px;font-size:15px;line-height:1.6;color:${COLOR.ink};">${textToHtml(text)}</div>`;

// Inside an attribute only `&` and the quote matter, but escaping everything is just as safe and simpler.
const attr = escapeHtml;

const button = ({ label, url }: { label: string; url: string }) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;">
  <tr>
    <td class="btn" bgcolor="${COLOR.ink}" style="background:${COLOR.ink};border-radius:10px;">
      <a class="btn-link" href="${attr(url)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;

export const renderEmail = ({ title, preheader, heading, bodyHtml, button: cta, note, reason }: EmailContent) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(title)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg-canvas { background: #0F1013 !important; }
    .bg-card { background: #17181D !important; border-color: #2A2C35 !important; }
    .text-ink { color: #F3F4F6 !important; }
    .text-muted { color: #A6A9B8 !important; }
    .text-faint { color: #8A8D9B !important; }
    .quote { background: #23252C !important; }
    .btn { background: #F3F4F6 !important; }
    .btn-link { color: #17181D !important; }
    .rule { border-color: #2A2C35 !important; }
    .link { color: #8FA8FF !important; }
  }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .pad { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body class="bg-canvas" style="margin:0;padding:0;background:${COLOR.canvas};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

<table role="presentation" class="bg-canvas" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.canvas};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;">
        <tr>
          <td style="padding:0 4px 18px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;background:${COLOR.signal};border-radius:8px;font-family:${FONT};font-size:15px;font-weight:800;line-height:28px;color:#FFFFFF;">R</td>
                <td class="text-ink" style="padding-left:10px;font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-0.3px;color:${COLOR.ink};">RelayDesk</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="bg-card pad" style="background:${COLOR.card};border:1px solid ${COLOR.hairline};border-radius:16px;padding:36px 40px;font-family:${FONT};">
            <h1 class="text-ink" style="margin:0 0 16px 0;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.5px;color:${COLOR.ink};">${escapeHtml(heading)}</h1>
            ${bodyHtml}
            ${cta ? button(cta) : ""}
            ${note ? `<p class="text-faint" style="margin:0;font-size:13px;line-height:1.5;color:${COLOR.faint};">${textToHtml(note)}</p>` : ""}
            ${
                cta
                    ? `<hr class="rule" style="border:none;border-top:1px solid ${COLOR.hairline};margin:28px 0 16px 0;" />
            <p class="text-faint" style="margin:0;font-size:12px;line-height:1.6;color:${COLOR.faint};word-break:break-all;">If the button doesn't work, copy this link into your browser:<br /><a class="link" href="${attr(cta.url)}" target="_blank" style="color:${COLOR.signal};text-decoration:underline;">${escapeHtml(cta.url)}</a></p>`
                    : ""
            }
          </td>
        </tr>

        <tr>
          <td class="pad" style="padding:20px 8px 0 8px;font-family:${FONT};text-align:center;">
            <p class="text-faint" style="margin:0 0 6px 0;font-size:12px;line-height:1.6;color:${COLOR.faint};">${textToHtml(reason)}</p>
            <p class="text-faint" style="margin:0;font-size:12px;line-height:1.6;color:${COLOR.faint};">RelayDesk · live chat for small businesses</p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
