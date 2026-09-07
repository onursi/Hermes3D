"use client";

import { useV2 } from "@/features/v2/state";

/**
 * Four places, one line, at the bottom.
 *
 * Home, knowledge, projects, Jarvis — the plan's dock, and no more than that.
 * Projects led nowhere while section C was unbuilt, and said so rather than
 * pretending. It is a place now, so the button is a button.
 *
 * Home is always here. That is the structural half of "you cannot get lost":
 * the way back is never more than one thing away, and it is always in the
 * same place.
 */

export function Dock({
  jarvisOpen,
  onToggleJarvis,
  showLibrary = false,
}: {
  jarvisOpen: boolean;
  onToggleJarvis: () => void;
  /**
   * The library appears only with `?lab=1`.
   *
   * It is integrated and it works, but it is Antigravity's room in Onur's
   * system for the first time, and ASTRA has not seen it. A fifth button in
   * the dock is a claim that the room is finished; a flag is an invitation to
   * look. It costs nothing to leave it behind the flag until someone says
   * otherwise — and the room is unmounted, so it costs nothing to render.
   */
  showLibrary?: boolean;
}) {
  const { world, goTo } = useV2();

  return (
    <nav className="pointer-events-auto absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-[#0a1018]/90 p-1.5 backdrop-blur-md">
      <DockButton
        active={world === "home" && !jarvisOpen}
        onClick={() => goTo("home")}
        label="Zuhause"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />
        </svg>
      </DockButton>

      {/* Not a destination — the space the destinations stand in. It sits
          next to home because that is what it is next to: stepping off the
          deck and looking around. */}
      <DockButton active={world === "universe"} onClick={() => goTo("universe")} label="Reisen">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3.4 9h17.2M3.4 15h17.2" />
        </svg>
      </DockButton>

      <DockButton
        active={world === "cosmos"}
        onClick={() => goTo("cosmos")}
        label="Wissen"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <circle cx="5" cy="6" r="1.6" />
          <circle cx="19" cy="7" r="1.6" />
          <circle cx="6" cy="18" r="1.6" />
          <circle cx="18" cy="17" r="1.6" />
          <path d="M9.6 10.4L6.3 7.2M14.4 10.6l3.1-2.3M9.9 13.8l-3 3M14.2 13.6l2.9 2.4" />
        </svg>
      </DockButton>

      <DockButton
        active={world === "projects"}
        onClick={() => goTo("projects")}
        label="Projekte"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
      </DockButton>

      <DockButton
        active={world === "saturn"}
        onClick={() => goTo("saturn")}
        label="Memory Saturn"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="5" />
          <ellipse cx="12" cy="12" rx="9" ry="3.2" transform="rotate(-25 12 12)" />
        </svg>
      </DockButton>

      {showLibrary ? (
        <DockButton
          active={world === "library"}
          onClick={() => goTo("library")}
          label="Bibliothek"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.6l3.4.9-3.6 15.1-3.4-.9z" />
          </svg>
        </DockButton>
      ) : null}

      <span className="mx-1 h-5 w-px bg-white/10" />

      <DockButton active={jarvisOpen} onClick={onToggleJarvis} label="Jarvis">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        </svg>
      </DockButton>
    </nav>
  );
}

/**
 * A dock button is never disabled. That is the whole point of the change.
 *
 * It used to grey itself out while a flight was running, which meant the one
 * moment Onur most wanted out — mid-transition, in the wrong place — was the
 * one moment the way out was gone. The buttons navigate directly now, so there
 * is nothing left for them to wait for.
 */
function DockButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 items-center gap-2 rounded-xl px-3 transition-colors ${
        active
          ? "bg-cyan-400/15 text-cyan-100"
          : "text-white/50 hover:bg-white/6 hover:text-white/85"
      }`}
    >
      {children}
      <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label.split(" — ")[0]}</span>
    </button>
  );
}
