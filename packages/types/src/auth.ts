import { z } from "zod";

// Trimmed and lowercased before validation, so lookups and stored accounts agree on one spelling
// of each address ("Foo@x.com" and "foo@x.com" are the same account).
export const emailField = z.string().trim().toLowerCase().email().max(255);

/*
  Rules for a password being set (signup, reset, change).
  Login deliberately doesn't apply these so old accounts can still sign in.
 */
export const newPasswordField = z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .refine((value) => new TextEncoder().encode(value).length <= 72, {
        message: "Password is too long",
    });

export const credentialSchema = z.object({
    email: emailField,
    password: newPasswordField,
    userAgent: z.string().optional(),
});

export const loginInSchema = credentialSchema.extend({
    password: z.string().min(1, { message: "Password is required" }).max(255),
});
export type LoginInSchema = z.infer<typeof loginInSchema>;

export const signUpSchema = credentialSchema.extend({
    name: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(255),
    businessName: z.string().trim().min(2, { message: "Business name must be at least 2 characters" }).max(255),
});
export type SignUpSchema = z.infer<typeof signUpSchema>;

// The link in the verification email carries a 256-bit token (64 hex characters); anything else is refused before
// it reaches the database.
export const verifyEmailSchema = z.object({
    token: z.string().trim().regex(/^[0-9a-f]{64}$/, { message: "This verification link is not valid" }),
    userAgent: z.string().optional(),
});
export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({ email: emailField });
export type ResendVerificationSchema = z.infer<typeof resendVerificationSchema>;

export const updateProfileSchema = z.object({
    name: z.string().trim().min(1, { message: "Name is required" }).max(255),
});
export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, { message: "Current password is required" }),
        newPassword: newPasswordField,
        confirmNewPassword: z.string().min(1),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
        message: "Passwords do not match",
        path: ["confirmNewPassword"],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: "New password must be different from the current password",
        path: ["newPassword"],
    });
export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>;

// Google sign-in: the browser sends the ID token Google signed; the server verifies it. What the token alone
// can't say is what to do for an email we have never seen, so the caller adds one of:
//   - `businessName`: "Sign up with Google" — creates the workspace and its admin;
//   - `invitationToken`: accepting an invitation with a Google account (the emails must match).
// With neither, an unknown email is "no account, sign up first".
export const googleAuthSchema = z.object({
  idToken: z.string().min(1, "Missing Google credential"),
  businessName: z.string().trim().min(2).max(100).optional(),
  invitationToken: z.string().regex(/^[0-9a-f]{64}$/, "Invalid invitation link").optional(),
});
export type GoogleAuthSchema = z.infer<typeof googleAuthSchema>;
