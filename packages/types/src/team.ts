import { z } from "zod";
import { emailField, newPasswordField } from "./auth.js";

export const inviteMemberSchema = z.object({
    email: emailField,
});
export type InviteMemberSchema = z.infer<typeof inviteMemberSchema>;

// An invited agent sets the same kind of password an admin does at sign-up.
export const acceptInvitationSchema = z.object({
    name: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(255),
    password: newPasswordField,
    userAgent: z.string().optional(),
});
export type AcceptInvitationSchema = z.infer<typeof acceptInvitationSchema>;

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: "admin" | "agent";
    status: "active" | "removed";
    createdAt: string;
}

// What every signed-in member may know about a colleague: enough to hand a conversation over.
export interface MemberOption {
    id: string;
    name: string;
    role: "admin" | "agent";
}

export interface PendingInvitation {
    id: string;
    email: string;
    expiresAt: string;
    createdAt: string;
}

export interface TeamData {
    members: TeamMember[];
    pendingInvitations: PendingInvitation[];
}

export interface InvitationDetails {
    email: string;
    workspaceName: string;
}
