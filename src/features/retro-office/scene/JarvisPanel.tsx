"use client";

import { X } from "lucide-react";

import { JarvisConsole } from "@/features/jarvis/JarvisConsole";

/**
 * Jarvis inside the brain window — the frame only.
 *
 * This used to be a second, older implementation: no reactor, no voice, no
 * streaming, no "remember". Onur opened the brain and saw at once that his
 * Jarvis looked wrong, because the one reachable from the office was the
 * lesser of two copies.
 *
 * All of it now comes from JarvisConsole, the same component the /jarvis page
 * mounts. What is left here is a floating frame and a close button, which is
 * the only thing this location actually adds.
 */

type Props = {
  onFlyToSource: (sourceId: string) => void;
  onSourcesChange?: (sourceIds: string[]) => void;
  noteCount?: number;
  onClose: () => void;
};

export function JarvisPanel({ onFlyToSource, onSourcesChange, noteCount, onClose }: Props) {
  return (
    <div className="absolute right-6 top-20 z-40 flex max-h-[calc(100vh-160px)] w-96 flex-col rounded-2xl border border-white/[0.09] bg-[#0e1013]/55 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5)] backdrop-blur-3xl backdrop-saturate-150">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <span className="text-[11px] font-semibold tracking-[-0.005em] text-white/80">
          Jarvis · fragt deinen Vault
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 hover:text-white/80"
          title="Schließen"
        >
          <X size={14} />
        </button>
      </div>

      <JarvisConsole
        onFlyToSource={onFlyToSource}
        onSourcesChange={onSourcesChange}
        noteCount={noteCount}
        compact
      />
    </div>
  );
}
