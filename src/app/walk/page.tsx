"use client";

import dynamic from "next/dynamic";

import { V2Provider } from "@/features/v2/state";

/** Walk-in mode at its own route, so the main Hermes view stays untouched. */
const WalkRoom = dynamic(() => import("@/features/walk/WalkRoom").then((module) => module.WalkRoom), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#03060b]">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/40">Raum wird geladen</span>
    </div>
  ),
});

export default function WalkPage() {
  return (
    <V2Provider>
      <WalkRoom />
    </V2Provider>
  );
}
