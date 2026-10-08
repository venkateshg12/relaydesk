"use client";

import React, { useState, useEffect } from "react";
import { useSessions } from "@/hooks/auth/useSessions";
import { useRevokeSession } from "@/hooks/auth/useRevokeSession";
import { useUpdateProfile } from "@/hooks/auth/useUpdateProfile";
import { useChangePassword } from "@/hooks/auth/useChangePassword";
import { useAppSelector } from "@/store/hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Laptop,
  Smartphone,
  Globe,
  Sun,
  Moon,
  Monitor,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { setPresenceStatus } from "@/lib/socket";
import { preferences } from "@/lib/preferences";

export default function AccountPage() {
  const { member, workspace } = useAppSelector((state) => state.auth);
  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useSessions();
  const { mutate: revokeSession, isPending: isRevoking } = useRevokeSession();

  // Profile update state
  const { mutate: updateProfile, isPending: isUpdatingProfile } =
    useUpdateProfile();
  const [name, setName] = useState(member?.name || "");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (member?.name) setName(member.name);
  }, [member?.name]);

  const handleUpdateName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setProfileSuccess(false);
    setProfileError(null);
    updateProfile(
      { name: name.trim() },
      {
        onSuccess: () => {
          setProfileSuccess(true);
          setTimeout(() => setProfileSuccess(false), 4000);
        },
        onError: (err) => {
          setProfileError(err.message || "Failed to update profile name");
        },
      },
    );
  };

  // Password change state
  const { mutate: changePassword, isPending: isChangingPassword } =
    useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    changePassword(
      {
        currentPassword,
        newPassword,
        confirmNewPassword: confirmPassword,
      },
      {
        onSuccess: (data) => {
          setPasswordSuccess(data.message || "Password changed successfully");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setTimeout(() => setPasswordSuccess(null), 5000);
        },
        onError: (err) => {
          setPasswordError(err.message || "Failed to change password");
        },
      },
    );
  };

  // Preferences: Theme & Presence & Sound
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setMounted(true);
    setSoundEnabled(preferences.isSoundEnabled());
    setIsOnline(!preferences.isAway());
  }, []);

  // "Away" only changes whether the widget tells visitors someone is around — it never touches assignment.
  const handlePresenceChange = (online: boolean) => {
    setIsOnline(online);
    preferences.setAway(!online);
    setPresenceStatus(online ? "online" : "away");
  };

  const handleSoundChange = (enabled: boolean) => {
    setSoundEnabled(enabled);
    preferences.setSoundEnabled(enabled);
  };

  const getDeviceIcon = (userAgent?: string | null) => {
    if (!userAgent) return <Globe className="w-4 h-4 text-muted-foreground" />;
    const ua = userAgent.toLowerCase();
    if (
      ua.includes("mobile") ||
      ua.includes("iphone") ||
      ua.includes("android")
    ) {
      return <Smartphone className="w-4 h-4 text-muted-foreground" />;
    }
    return <Laptop className="w-4 h-4 text-muted-foreground" />;
  };

  const formatUserAgent = (userAgent?: string | null) => {
    if (!userAgent) return "Unknown Device";
    // Most specific first: Edge's user agent also contains "Chrome", and Chrome's contains "Safari".
    if (userAgent.includes("Edg/")) return "Edge Browser";
    if (userAgent.includes("Firefox")) return "Firefox Browser";
    if (userAgent.includes("Chrome")) return "Chrome Browser";
    if (userAgent.includes("Safari")) return "Safari Browser";
    return userAgent.slice(0, 30);
  };

  return (
    <div className="space-y-6 p-6 sm:p-8 w-full max-w-4xl mx-auto">
      <div>
        <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] text-foreground font-expanded sm:text-[34px]">
          My account
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal details, preferences, security, and active
          sessions.
        </p>
      </div>

      {/* Profile & Name Card */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" />
          <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-foreground">
            Profile details
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-6 pb-6 border-b border-border">
          <div>
            <span className="text-xs text-muted-foreground block">Email</span>
            <span className="font-medium text-foreground">{member?.email}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Workspace
            </span>
            <span className="font-medium text-foreground">
              {workspace?.name}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Role</span>
            <span className="font-medium capitalize text-foreground">
              {member?.role}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Signs in with
            </span>
            {member?.authProvider === "google" ? (
              <span className="flex items-center gap-2 font-medium text-foreground">
                {/* The photo comes from the Google account; its host can refuse requests that carry a referrer. */}
                {member.avatar && (
                  <Avatar size="sm" className="size-5">
                    <AvatarImage src={member.avatar} alt="" referrerPolicy="no-referrer" />
                  </Avatar>
                )}
                Google
              </span>
            ) : (
              <span className="font-medium text-foreground">Email and password</span>
            )}
          </div>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="display-name" className="text-xs text-foreground">
              Display name
            </Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              className="h-11 text-[15px]"
            />
          </div>

          {profileError && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {profileSuccess && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Profile updated successfully.</span>
            </div>
          )}

          <Button
            type="submit"
            size="sm"
            disabled={isUpdatingProfile || name.trim() === member?.name}
            className="h-8 text-xs"
          >
            {isUpdatingProfile ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </div>

      {/* Preferences & Appearance */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-foreground mb-4">
          Preferences
        </h2>

        <div className="space-y-5">
          {/* Presence Status */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                <span className="text-sm font-medium text-foreground">
                  Online status
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isOnline
                  ? "You are visible as online and available for assigned chats."
                  : "You are set to away. New chats won't automatically assign to you."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground capitalize">
                {isOnline ? "Online" : "Away"}
              </span>
              <Switch
                checked={isOnline}
                onCheckedChange={handlePresenceChange}
              />
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Sound Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-foreground" />
                ) : (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">
                  Notification sounds
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Play an audible chime when new inbound visitor messages arrive.
              </p>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={handleSoundChange}
            />
          </div>

          <div className="border-t border-border" />

          {/* Theme switcher */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground block">
              Interface theme
            </span>
            <p className="text-xs text-muted-foreground">
              Select your preferred appearance for the RelayDesk dashboard.
            </p>
            {mounted ? (
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    theme === "light"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    theme === "dark"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    theme === "system"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  System
                </button>
              </div>
            ) : (
              <div className="h-8 w-48 rounded bg-muted animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Security & Password Card — an account that signs in with Google has no password to change. */}
      {member?.authProvider === "google" ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-foreground">Password</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            You sign in with Google, so there is no password to change here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-foreground">
              Change password
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Changing your password signs you out of all other active devices.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="current-pw" className="text-xs text-foreground">
                Current password
              </Label>
              <Input
                id="current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="h-11 text-[15px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-pw" className="text-xs text-foreground">
                New password
              </Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                className="h-11 text-[15px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw" className="text-xs text-foreground">
                Confirm new password
              </Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11 text-[15px]"
              />
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={isChangingPassword || !currentPassword || !newPassword}
              className="h-8 text-xs"
            >
              {isChangingPassword ? "Updating password..." : "Update password"}
            </Button>
          </form>
        </div>
      )}

      {/* Sessions table card */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-foreground">
            Active sessions
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Devices that are currently signed in to your account.
          </p>
        </div>

        {sessionsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : sessionsError ? (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            Failed to load active sessions.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Device and client</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions?.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        {getDeviceIcon(session.userAgent)}
                        <div>
                          <div className="text-xs font-medium text-foreground">
                            {formatUserAgent(session.userAgent)}
                          </div>
                          {session.userAgent && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                              {session.userAgent}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(session.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.isCurrent ? (
                        <Badge
                          variant="secondary"
                          className="font-normal text-[11px] bg-muted text-muted-foreground"
                        >
                          This device
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isRevoking}
                          onClick={() => revokeSession(session.id)}
                          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Log out
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
