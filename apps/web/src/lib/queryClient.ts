import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export default queryClient;

const USER_SCOPED_KEYS = [
  "sessions",
  "conversations",
  "messages",
  "team",
  "widget",
  "dashboard",
  "savedReplies",
];

export const clearUserQueries = () => {
  for (const key of USER_SCOPED_KEYS) {
    queryClient.removeQueries({ queryKey: [key] });
  }
};
