"use client";

import React, { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "@/lib/queryClient";

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [client] = useState(() => queryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
