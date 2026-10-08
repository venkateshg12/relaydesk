import { useQuery } from "@tanstack/react-query";
import type { TeamData } from "@repo/types";
import { getTeamApi } from "@/api/team";
import type { ApiError } from "@/lib/api";

export const useTeam = () =>
  useQuery<TeamData, ApiError>({
    queryKey: ["team"],
    queryFn: async () => (await getTeamApi()).data,
  });
