"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import { makeStore, setClientStore, type AppStore } from "@/store/store";

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
    setClientStore(storeRef.current);
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
