import { WEB_ORIGIN } from "../../constants/env.js";
import { invitationEmailTemplate, offlineReplyEmailTemplate, verificationEmailTemplate } from "./html_templates.js";

// `text` is the plain version every email carries beside the HTML: clients that block HTML, screen readers and
// spam filters read it.

export const getInvitationEmail = (workspaceName: string, inviterName: string, token: string) => {
    const inviteLink = `${WEB_ORIGIN}/invite/${token}`;

    return {
        subject: `You're invited to join ${workspaceName} on RelayDesk`,
        text: [
            `${inviterName} has invited you to join the support team for ${workspaceName} on RelayDesk.`,
            `Join the team: ${inviteLink}`,
            "This link works once and expires in 2 days. If you weren't expecting this invitation, ignore this email.",
        ].join("\n\n"),
        html: invitationEmailTemplate(inviteLink, workspaceName, inviterName)
    };
};

export const getVerificationEmail = (name: string, token: string) => {
    const verifyLink = `${WEB_ORIGIN}/verify-email/${token}`;

    return {
        subject: "Verify your email for RelayDesk",
        text: [
            `Hi ${name}, welcome to RelayDesk.`,
            `Confirm your email address to finish creating your workspace: ${verifyLink}`,
            "This link works once and expires in 24 hours. If you didn't sign up, ignore this email.",
        ].join("\n\n"),
        html: verificationEmailTemplate(verifyLink, name)
    };
};

export const getOfflineReplyEmail = (agentName: string, body: string, chatLink: string) => {
    return {
        subject: `New reply from ${agentName}`,
        text: [
            `${agentName} replied to your message:`,
            body,
            `Continue the conversation: ${chatLink}`,
        ].join("\n\n"),
        html: offlineReplyEmailTemplate(chatLink, agentName, body)
    };
};
