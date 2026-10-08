import { invitationEmailTemplate, offlineReplyEmailTemplate } from "../utils/email/html_templates";
import { escapeHtml, renderEmail } from "../utils/email/emailLayout";

const INVITE = "https://app.example.com/invite/abc123";
const CHAT = "https://bakery.example.com/delivery";

describe("email templates", () => {
    it("share one layout: brand header, one button, the link as text, and a reason in the footer", () => {
        for (const html of [invitationEmailTemplate(INVITE, "Sweet Crumbs", "Sarah"), offlineReplyEmailTemplate(CHAT, "Sarah", "Yes, we deliver.")]) {
            expect(html).toContain("RelayDesk");
            expect(html.match(/class="btn-link"/g)).toHaveLength(1);
            expect(html).toContain("copy this link into your browser");
            expect(html).toContain("You got this because");
            expect(html).toContain("prefers-color-scheme: dark");
        }
    });

    it("puts the invitation link in the button and repeats it as a plain link", () => {
        const html = invitationEmailTemplate(INVITE, "Sweet Crumbs", "Sarah");
        expect(html.split(INVITE).length - 1).toBe(3); // button href, plain-link href, plain-link text
        expect(html).toContain("Join Sweet Crumbs on RelayDesk");
        expect(html).toContain("expires in 2 days");
    });

    it("quotes the reply, keeps its line breaks and names the site it came from", () => {
        const html = offlineReplyEmailTemplate(CHAT, "Sarah", "Line one\nLine two");
        expect(html).toContain("Line one<br />Line two");
        expect(html).toContain("bakery.example.com");
        expect(html).toContain("Sarah replied to your message");
    });

    it("escapes everything a person typed, so it can never add markup or break out of an attribute", () => {
        const evil = `<script>alert(1)</script> "x" & 'y'`;
        const html = offlineReplyEmailTemplate("https://bakery.example.com/a?b=1&c=\"2", evil, evil);
        expect(html).not.toContain("<script>");
        expect(html).not.toMatch(/href="[^"]*"[^>]*"2/);
        expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
        const invite = invitationEmailTemplate(INVITE, evil, evil);
        expect(invite).not.toContain("<script>");
    });

    it("shows a preview line in the inbox list but hides it in the message", () => {
        const html = renderEmail({ title: "T", preheader: "Preview text", heading: "H", bodyHtml: "", reason: "R" });
        expect(html).toMatch(/display:none[^>]*>Preview text/);
    });

    it("escapeHtml covers the five characters that matter", () => {
        expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#039;");
    });
});
