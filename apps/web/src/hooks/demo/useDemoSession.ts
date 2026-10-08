"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDemoSessionApi, type DemoSessionData } from "@/api/demo";
import { getMeApi } from "@/api/auth";
import type { ApiError } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setUser, type AuthMember } from "@/store/slices/authSlice";

export type DemoState =
  | { status: "starting" }
  | {
      status: "ready";
      workspace: DemoSessionData["workspace"];
      member: AuthMember;
    }
  // A real account is signed in on this browser: the demo would replace its cookies, so it isn't started.
  | { status: "signedIn"; memberName: string }
  | { status: "failed"; message: string };

/*
  The visitor's private demo workspace. The session lives in the cookies the server set when it created
  the demo, so a refresh resumes the same one (no second workspace per reload) and two private windows get
  two. On load: ask who is signed in — a demo member resumes, a real member is left alone, nobody (or an
  expired demo, deleted after 24 h) starts a new one. If the demo is deleted while the page is open, the
  API client signs it out and the next effect starts a fresh one.
 */
export function useDemoSession() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const authMember = useAppSelector((state) => state.auth.member);
  const [state, setState] = useState<DemoState>({ status: "starting" });
  const hasResumed = useRef(false);

  const start = useMutation<DemoSessionData, ApiError>({
    mutationFn: async () => (await createDemoSessionApi()).data,
    onSuccess: ({ workspace, member }) => {
      // Fresh cookies: anything cached for a previous session (a deleted demo) is stale.
      queryClient.clear();
      const authMemberFields = {
        ...member,
        workspaceId: workspace.id,
        email: "",
        status: "active" as const,
      };
      dispatch(setUser({ member: authMemberFields, workspace }));
      setState({ status: "ready", workspace, member: authMemberFields });
    },
    onError: (error) => setState({ status: "failed", message: error.message }),
  });

  const resumeOrStart = useCallback(async () => {
    setState({ status: "starting" });
    try {
      const { member, workspace } = (await getMeApi()).data;
      if (workspace.isDemo) {
        dispatch(setUser({ member, workspace }));
        setState({
          status: "ready",
          workspace: workspace as DemoSessionData["workspace"],
          member,
        });
      } else {
        setState({ status: "signedIn", memberName: member.name });
      }
    } catch {
      start.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `start` is stable enough; this runs on mount and on retry
  }, [dispatch]);

  useEffect(() => {
    if (hasResumed.current) return;
    hasResumed.current = true;
    void resumeOrStart();
  }, [resumeOrStart]);

  // The demo expired under an open page: the API client cleared the session, so begin a new demo.
  useEffect(() => {
    if (state.status === "ready" && authMember === null) void resumeOrStart();
  }, [state.status, authMember, resumeOrStart]);

  return { state, retry: resumeOrStart };
}
