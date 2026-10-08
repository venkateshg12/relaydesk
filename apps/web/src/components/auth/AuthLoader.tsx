"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setUser, clearAuth } from "@/store/slices/authSlice";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthLoaderProps {
  children: React.ReactNode;
}

export const AuthLoader: React.FC<AuthLoaderProps> = ({ children }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { member, isBootstrapped } = useAppSelector((state) => state.auth);
  const { data, isSuccess, isError, isLoading } = useMe();

  useEffect(() => {
    if (isSuccess && data) {
      dispatch(setUser({ member: data.member, workspace: data.workspace }));
    } else if (isError) {
      dispatch(clearAuth());
    }
  }, [isSuccess, isError, data, dispatch]);

  // Covers both a failed /auth/me and a session that ends mid-use (the API client clears auth when a
  // refresh fails) — without this the second case left a blank page.
  useEffect(() => {
    if (isBootstrapped && !member) router.replace("/login");
  }, [isBootstrapped, member, router]);

  if (!isBootstrapped || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* 56px top bar skeleton */}
        <header className="h-14 border-b border-border bg-background px-3 sm:px-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-28 rounded-md" />
            <div className="h-4 w-px bg-border" />
            <Skeleton className="h-5 w-32 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>

        {/* App content skeleton */}
        <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </main>
      </div>
    );
  }

  if (!member) {
    return null;
  }

  return <>{children}</>;
};

export default AuthLoader;
