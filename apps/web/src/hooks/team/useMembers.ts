import { useQuery } from "@tanstack/react-query";
import type { MemberOption } from "@repo/types";
import { getMemberOptionsApi } from "@/api/team";
import type { ApiError } from "@/lib/api";

// Names and roles of the active members — readable by every agent, unlike `useTeam` (admin only).
export const useMembers = () =>
  useQuery<MemberOption[], ApiError>({
    queryKey: ["members"],
    queryFn: async () => (await getMemberOptionsApi()).data.members,
    staleTime: 60 * 1000,
  });
