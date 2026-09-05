"use client";

import dynamic from "next/dynamic";

import { V2Provider } from "@/features/v2/state";

/**
 * V2 lives at its own route.
 *
 * `/office` keeps working exactly as it did — the plan requires the old room
 * to stay reachable, and a V2 that replaces it before it is better would be a
 * downgrade dressed as progress.
 *
 * A client component on purpose: `ssr: false` is only allowed in one, and a
 * WebGL canvas cannot be rendered on
 * the server, and a mismatch between the two passes makes React abort the
 * whole tree — which is how V1 lost its scene three separate times.
 */
const V2Screen = dynamic(
  () => import("@/features/v2/V2Screen").then((module) => module.V2Screen),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-[#05080d]">
        <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/35">
          Kommandodeck wird geladen
        </span>
      </div>
    ),
  },
);

export default function V2Page() {
  return (
    <V2Provider>
      <V2Screen />
    </V2Provider>
  );
}
