"use client";

import { useCallback, useEffect, useState } from "react";

/** Mirrors /api/vault/projects — the vault as it is on disk, nothing added. */
export type ProjectNote = { title: string; path: string; modified: string };

/** Ein Bereich im Projekt — ein echter Unterordner, kein erfundener Zustand. */
export type ProjectArea = {
  folder: string;
  name: string;
  noteCount: number;
  lastTouched: string | null;
  notes: ProjectNote[];
};

export type Project = {
  name: string;
  folder: string;
  noteCount: number;
  openTasks: number;
  doneTasks: number;
  lastTouched: string | null;
  recentNotes: ProjectNote[];
  /** Die Bereiche, aus denen die Projektwelt ihre Anordnung nimmt. */
  areas: ProjectArea[];
};

export type ProjectsState = {
  projects: Project[];
  /** False means the vault folder could not be read — not "no projects". */
  reachable: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * The projects, read from the vault.
 *
 * Deliberately thin: this hook adds nothing the route did not report. There is
 * no progress percentage here and there will not be one until something in the
 * vault actually records progress — the project notes use no checkboxes, so a
 * bar would be a number with nothing behind it. Notes, recency and the
 * documents last touched are provable; that is what the world shows.
 */
export function useProjects(): ProjectsState {
  const [state, setState] = useState<Omit<ProjectsState, "reload">>({
    projects: [],
    reachable: true,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vault/projects")
      .then((response) => response.json())
      .then((data: { projects?: Project[]; reachable?: boolean; error?: string }) => {
        if (cancelled) return;
        setState({
          projects: data.projects ?? [],
          reachable: data.reachable !== false,
          loading: false,
          error: data.error ?? null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          projects: [],
          reachable: false,
          loading: false,
          error: error instanceof Error ? error.message : "Projekte nicht abrufbar",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
