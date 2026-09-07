import type { Project } from "../useProjects";

export type ProjectDisposition = "active" | "paused" | "waiting" | "completed";
export type ProjectMeta = { goal: string; disposition: ProjectDisposition; activity: string | null; reviewAt: string | null; note: string };
export const EMPTY_META: ProjectMeta = { goal: "", disposition: "active", activity: null, reviewAt: null, note: "" };
export function orbitState(meta: ProjectMeta | undefined, now: number) {
  if (!meta) return { radius: 31, label: "Noch nicht eingeordnet", tone: "#a5bbd0" };
  if (meta.disposition === "completed") return { radius: 43, label: "Abgeschlossen", tone: "#a4d9c3" };
  const due = meta.reviewAt ? Date.parse(meta.reviewAt + "T23:59:59") < now : false;
  if (meta.disposition === "paused" && !due) return { radius: 38, label: "Bewusst pausiert", tone: "#9aaaca" };
  if (meta.disposition === "waiting" && !due) return { radius: 35, label: "Wartet auf Rückmeldung", tone: "#c5afd9" };
  if (due) return { radius: 19, label: "Wiedervorlage fällig", tone: "#edbb7f" };
  return { radius: 32, label: "Aktiv · kein Termin fällig", tone: "#8dcebf" };
}
export function planetSize(project: Pick<Project, "noteCount">) { return 1.1 + Math.min(1.8, Math.log2(1 + project.noteCount) * .24); }
export type MemoryEntry = { id: string; title: string; date: string; phase: string; path?: string; url?: string; kind: "note" | "image" | "video"; local?: boolean };
export const PHASES = ["Babyjahre", "Kindheit", "Jugend", "Erwachsenenleben", "Gegenwart"];
export const PHASE_COLORS = ["#9abbd7", "#b8a5d9", "#dfbc93", "#96c8bd", "#e1d3b9"];
export const spatialSignal = { depth: 0, memorySpeed: 0 };
