import { paragraph, quote, renderEmail } from "./emailLayout.js";

// Each email is only its words: the markup, colours and footer come from `renderEmail` (emailLayout.ts).

export const invitationEmailTemplate = (inviteLink: string, workspaceName: string, inviterName: string) =>
    renderEmail({
        title: `You're invited to join ${workspaceName} on RelayDesk`,
        preheader: `${inviterName} invited you to the ${workspaceName} support team.`,
        heading: `Join ${workspaceName} on RelayDesk`,
        bodyHtml:
            paragraph(`${inviterName} has invited you to join the support team for ${workspaceName}.`) +
            paragraph("Accept the invitation to choose your name and password, and you'll land in the team's shared inbox."),
        button: { label: "Join the team", url: inviteLink },
        note: "This link works once and expires in 2 days.",
        reason: `You got this because ${inviterName} entered your email address. If you weren't expecting it, ignore this email: nothing happens unless you click the link.`,
    });

export const verificationEmailTemplate = (verifyLink: string, name: string) =>
    renderEmail({
        title: "Verify your email for RelayDesk",
        preheader: "Confirm your email address to open your RelayDesk workspace.",
        heading: "Confirm your email",
        bodyHtml:
            paragraph(`Hi ${name}, welcome to RelayDesk. Confirm that this is your email address to finish creating your workspace.`) +
            paragraph("As soon as you confirm, you'll land in your inbox."),
        button: { label: "Verify my email", url: verifyLink },
        note: "This link works once and expires in 24 hours.",
        reason: "You got this because someone signed up for RelayDesk with this email address. If that wasn't you, ignore this email: no account is activated until the link is opened.",
    });

export const offlineReplyEmailTemplate = (chatLink: string, agentName: string, body: string) =>
    renderEmail({
        title: `New reply from ${agentName}`,
        preheader: body.replace(/\s+/g, " ").slice(0, 110),
        heading: `${agentName} replied to your message`,
        bodyHtml: quote(body),
        button: { label: "Continue the conversation", url: chatLink },
        note: "It opens the chat on the page you were on, with your messages and the replies so far.",
        reason: `You got this because you left your email in a chat on ${new URL(chatLink).host}, and the team replied after you had left.`,
    });
