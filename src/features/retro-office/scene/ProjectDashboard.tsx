"use client";

import { useEffect } from "react";

/**
 * Where you land when you fly to a project.
 *
 * A galaxy that only carries a label is a decoration with a name on it. Onur
 * asked for the other half: click it, arrive, and see what the project
 * actually is — "alles wichtige vom projekt als 2d dashboard". So this is the
 * arrival, and everything on it is read off disk.
 *
 * It deliberately shows notes rather than a summary. A generated overview of
 * a project would be a claim about work Onur did, assembled by something that
 * has not read most of it; a list of the six notes he touched most recently
 * is a fact, and it is also what he would have opened anyway.
 *
 * The panel sits over the running scene rather than replacing it. The room
 * stays visible behind, because the point of travelling somewhere is that you
 * can see you have gone.
 */

export type ProjectDashboardNote = {
  title: string;
  path: string;
  modified: string;
};

export type VaultProjectSummary = {
  name: string;
  folder: string;
  noteCount: number;
  openTasks: number;
  doneTasks: number;
  lastTouched: string | null;
  recentNotes: ProjectDashboardNote[];
};

const formatDay = (iso: string | null): string => {
  if (!iso) return "unbekannt";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unbekannt";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const describeAge = (iso: string | null): string => {
  if (!iso) return "unbekannt";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "unbekannt";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 14) return `vor ${days} Tagen`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `vor ${weeks} Wochen`;
  return `vor ${Math.floor(days / 30)} Monaten`;
};

export function ProjectDashboard({
  project,
  onClose,
}: {
  project: VaultProjectSummary;
  onClose: () => void;
}) {
  // Escape closes it. A panel that traps you is a panel you stop opening.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[min(680px,92vw)] max-h-[80vh] overflow-y-auto rounded-2xl border border-cyan-400/25 bg-[#050c18]/95 p-6 shadow-[0_0_60px_rgba(0,240,255,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300/60">
              Projekt angeflogen
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-white">{project.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-cyan-500/20 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-cyan-100/70 transition-colors hover:border-cyan-400/40 hover:text-white"
          >
            Zurück
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Notizen" value={String(project.noteCount)} />
          <Stat label="Zuletzt" value={describeAge(project.lastTouched)} />
          {/* Shown only when the project actually tracks tasks in notes. Most
              do not — Onur's tasks live in Todoist — and a permanent "0
              offen" would read as "nothing to do" rather than "not tracked
              here", which is a different and wrong claim. */}
          {project.openTasks + project.doneTasks > 0 ? (
            <Stat label="Offen" value={String(project.openTasks)} />
          ) : (
            <Stat label="Aufgaben" value="in Todoist" muted />
          )}
        </div>

        <div className="mt-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/50">
            Zuletzt bearbeitet
          </div>
          {project.recentNotes.length === 0 ? (
            <p className="mt-3 text-sm text-white/45">
              Noch keine Notizen in diesem Projekt.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {project.recentNotes.map((note) => (
                <li
                  key={note.path}
                  className="flex items-baseline justify-between gap-4 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                >
                  <span className="text-sm text-white/85">{note.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-white/35">
                    {formatDay(note.modified)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-5 font-mono text-[10px] text-white/25">
          {project.folder} · gelesen aus dem Vault
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/45">
        {label}
      </div>
      <div className={`mt-1 text-lg ${muted ? "text-white/40 text-sm" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
