"use client";

import { useV2, type V2World } from "@/features/v2/state";

/** What each place is called at the top of the screen. */
const WORLD_NAMES: Record<V2World, string> = {
  home: "Kommandodeck",
  universe: "Unterwegs",
  cosmos: "Wissenskosmos",
  projects: "Project Singularity",
  memory: "Memory Saturn",
  library: "Bibliothek",
};

/**
 * One quiet line, at the top.
 *
 * Onur on the old HUD: "sieht minderwertig aus". Codex: "visuell sehr voll".
 * Both were right and had the same cause — it showed everything all the time.
 * This shows where you are, whether Hermes answered, how many agents there
 * are, and whether a decision is waiting. Nothing else, ever.
 *
 * Amber appears here for exactly one reason, the same reason it appears
 * anywhere in V2: a decision needs him.
 */

export function StatusBar({
  agentCount,
  rosterReachable,
  vaultCount,
  vaultReachable,
  approvalsWaiting,
  approvalsReachable,
  onOpenApprovals,
  onOpenSettings,
  onToggleDev,
  devOpen,
}: {
  agentCount: number;
  rosterReachable: boolean;
  vaultCount: number;
  vaultReachable: boolean;
  approvalsWaiting: number;
  /** False means the queue could not be read — not "nothing waits". */
  approvalsReachable: boolean;
  onOpenApprovals: () => void;
  onOpenSettings: () => void;
  onToggleDev: () => void;
  devOpen: boolean;
}) {
  const { world, travelling } = useV2();
  // A record and not a chain of ternaries. The chain ended in "else it is the
  // library", so adding the universe silently renamed it — the status bar
  // announced a room he was nowhere near. Typed by world, a fifth place now
  // fails the typecheck instead of lying on screen.
  const worldName = WORLD_NAMES[world];

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-[#0a1018]/85 px-4 py-1.5 backdrop-blur-md">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/85">
          {worldName}
        </span>
        {travelling ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">
            unterwegs
          </span>
        ) : null}
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        {/* Clickable, because a light you cannot interrogate is a light you
            learn to ignore. Unreachable is its own state and its own colour —
            "could not ask" must never render as "nothing waits". */}
        {!approvalsReachable ? (
          <button type="button" onClick={onOpenApprovals} className="cursor-pointer">
            <Pill tone="rose">Freigaben unbekannt</Pill>
          </button>
        ) : approvalsWaiting > 0 ? (
          <button type="button" onClick={onOpenApprovals} className="cursor-pointer">
            <Pill tone="amber">
              {approvalsWaiting} {approvalsWaiting === 1 ? "Freigabe" : "Freigaben"}
            </Pill>
          </button>
        ) : null}

        {/* Reachability and emptiness are shown apart. "Keine Agenten" and
            "nicht erreichbar" mean opposite things. */}
        <Pill tone={rosterReachable ? "neutral" : "rose"}>
          {rosterReachable ? `${agentCount} Agenten` : "Hermes offline"}
        </Pill>
        <Pill tone={vaultReachable ? "neutral" : "rose"}>
          {vaultReachable ? `${vaultCount} Notizen` : "Vault offline"}
        </Pill>

        <IconButton label="Einstellungen" onClick={onOpenSettings}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
          </svg>
        </IconButton>

        <IconButton label="Entwicklerwerte" onClick={onToggleDev} active={devOpen}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
          </svg>
        </IconButton>
      </div>
    </header>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "neutral" | "amber" | "rose" }) {
  const styles = {
    neutral: "border-white/10 bg-[#0a1018]/85 text-white/55",
    amber: "border-amber-400/35 bg-amber-400/12 text-amber-200",
    rose: "border-rose-400/35 bg-rose-400/10 text-rose-200",
  }[tone];
  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] backdrop-blur-md ${styles}`}
    >
      {children}
    </span>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md transition-colors ${
        active
          ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
          : "border-white/10 bg-[#0a1018]/85 text-white/45 hover:text-white/80"
      }`}
    >
      {children}
    </button>
  );
}
