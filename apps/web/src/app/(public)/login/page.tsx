"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginInSchema, type LoginInSchema } from "@repo/types";
import { useLogin } from "@/hooks/auth/useLogin";
import { Button } from "@/components/ui/button";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { mutate: login, isPending, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInSchema>({
    resolver: zodResolver(loginInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginInSchema) => {
    login(data);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-[32px] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance text-foreground font-expanded">
          Log in to RelayDesk
        </h1>
        <p className="mt-3 text-[15px] leading-[1.55] text-muted-foreground">
          Enter your credentials to access your workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium text-foreground">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="sarah@sweetcrumbs.test"
            className="h-11 text-[15px]"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-[13px] font-medium text-foreground"
          >
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-11 pr-10 text-[15px]"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Server error callout (never a toast) */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive leading-relaxed">
            {error.message || "Invalid email or password."}
          </div>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isPending}
          className="h-11 w-full text-[15px] font-medium"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Logging in...</span>
            </span>
          ) : (
            "Log in"
          )}
        </Button>
      </form>

      <GoogleSignInButton mode="login" />

      <div className="mt-8 text-center text-[14px] text-muted-foreground">
        Don&apos;t have a workspace?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground hover:underline"
        >
          Create one
        </Link>
      </div>
    </div>
  );
}
