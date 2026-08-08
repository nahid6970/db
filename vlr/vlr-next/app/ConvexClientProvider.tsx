"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// Lazily create the client so build-time prerendering doesn't crash
// when NEXT_PUBLIC_CONVEX_URL isn't available in the build environment.
let convex: ConvexReactClient | null = null;

function getClient() {
  if (!convex && typeof window !== "undefined") {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (url) convex = new ConvexReactClient(url);
  }
  return convex;
}

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = getClient();

  // During SSR / build prerender, just render children without Convex
  if (!client) return <>{children}</>;

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
