import type { CodexThreadSnapshot } from "@/lib/codex/appServer";

export type BriefingTask = {
  content: string;
  isCompleted?: boolean;
  dueDate?: string | null;
  priority?: number;
  projectName?: string | null;
};

export type BriefingProject = {
  name: string;
  lastTouched: string | null;
  openTasks: number;
  recentNotes: { title: string; path: string; modified: string }[];
};

export type BriefingSource = {
  id: string;
  title: string;
  folder: string;
  excerpt: string;
  kind: "vault" | "codex" | "task" | "approval";
  navigable: boolean;
};

export type BriefingInput = {
  today: string;
  since: string;
  tasks: BriefingTask[];
  approvals: number;
  projects: BriefingProject[];
  codexThreads: CodexThreadSnapshot[];
  sourceStatus: Record<"tasks" | "approvals" | "projects" | "codex", { ok: boolean; reason?: string }>;
};

const clip = (text: string, limit = 320) => text.replace(/\s+/g, " ").trim().slice(0, limit);

export function changedProjects(input: BriefingInput) {
  const cutoff = Date.parse(input.since);
  return input.projects
    .filter((project) => project.lastTouched && Date.parse(project.lastTouched) >= cutoff)
    .map((project) => ({
      ...project,
      recentNotes: project.recentNotes.filter((note) => Date.parse(note.modified) >= cutoff),
    }));
}

export function briefingSources(input: BriefingInput): BriefingSource[] {
  const projectSources = changedProjects(input).flatMap((project) =>
    project.recentNotes.slice(0, 3).map((note) => ({
      id: note.path,
      title: note.title,
      folder: `LifeOS · ${project.name}`,
      excerpt: `Geändert: ${note.modified}`,
      kind: "vault" as const,
      navigable: true,
    })),
  );
  const codexSources = input.codexThreads.slice(0, 8).map((thread) => ({
    id: `codex:${thread.id}`,
    title: thread.title,
    folder: "Codex · Arbeitsauftrag",
    excerpt: clip(thread.preview, 420),
    kind: "codex" as const,
    navigable: false,
  }));
  const taskSources = input.tasks
    .filter((task) => !task.isCompleted && task.dueDate && task.dueDate <= input.today)
    .slice(0, 6)
    .map((task, index) => ({
      id: `task:${index}:${task.content}`,
      title: task.content,
      folder: task.projectName ? `Todoist · ${task.projectName}` : "Todoist",
      excerpt: task.dueDate === input.today ? "Heute fällig" : `Überfällig seit ${task.dueDate}`,
      kind: "task" as const,
      navigable: false,
    }));
  return [...projectSources, ...codexSources, ...taskSources].slice(0, 18);
}

function sourceFailures(input: BriefingInput) {
  return Object.entries(input.sourceStatus)
    .filter(([, state]) => !state.ok)
    .map(([name, state]) => `${name}: ${state.reason ?? "nicht erreichbar"}`);
}

export function buildBriefingPrompt(input: BriefingInput) {
  const open = input.tasks.filter((task) => !task.isCompleted);
  const overdue = open.filter((task) => task.dueDate && task.dueDate < input.today);
  const today = open.filter((task) => task.dueDate === input.today);
  const projects = changedProjects(input);
  const sources = briefingSources(input);
  const evidence = [
    ...sources.map((source, index) => `[Q${index + 1}] ${source.folder} · ${source.title}\n${source.excerpt}`),
    `[F1] Offene Aufgaben: ${open.length}; überfällig: ${overdue.length}; heute: ${today.length}.`,
    `[F2] Wartende Freigaben: ${input.approvals}.`,
    `[F3] Veränderte LifeOS-Projekte: ${projects.length}; jüngste Codex-Aufträge: ${input.codexThreads.length}.`,
  ].join("\n\n");

  return [
    "Du bist Hermes und erstellst Onur ein belastbares Wiedereinstiegsbriefing.",
    `Zeitraum: ${input.since} bis ${input.today}.`,
    "",
    "Regeln:",
    "- Nutze ausschließlich die Belege unten und zitiere sie als [Q1] oder [F1].",
    "- Codex-Vorschauen sind Arbeitsaufträge, keine abgeschlossenen Ergebnisse und keine Entscheidungen.",
    "- Geänderte Notizen belegen eine Änderung, aber nicht automatisch deren Inhalt.",
    "- Nenne eine Entscheidung nur, wenn sie im Beleg ausdrücklich als Entscheidung steht.",
    "- Erfinde keine Fertigstellungen, Prioritäten, Fristen oder Zusammenhänge.",
    "- Antworte kompakt auf Deutsch in genau diesen Abschnitten:",
    "  LAGE · WAS SICH BEWEGT HAT · OFFENE SCHLEIFEN · NÄCHSTE 3 SCHRITTE · QUELLENLÜCKEN",
    "- Die drei Schritte müssen konkret und nach Wirkung geordnet sein.",
    "",
    "BELEGE:",
    evidence || "Keine Einzelbelege vorhanden.",
    "",
    `NICHT ERREICHBAR: ${sourceFailures(input).join("; ") || "keine"}`,
  ].join("\n");
}

export function buildLocalBriefing(input: BriefingInput) {
  const open = input.tasks.filter((task) => !task.isCompleted);
  const overdue = open.filter((task) => task.dueDate && task.dueDate < input.today);
  const dueToday = open.filter((task) => task.dueDate === input.today);
  const projects = changedProjects(input);
  const loops = [
    ...overdue.slice(0, 2).map((task) => `${task.content}${task.projectName ? ` (${task.projectName})` : ""}`),
    ...dueToday.slice(0, 2).map((task) => `${task.content}${task.projectName ? ` (${task.projectName})` : ""}`),
  ];
  const next = loops.length ? loops.slice(0, 3) : input.codexThreads.slice(0, 3).map((thread) => thread.title);
  const failures = sourceFailures(input);

  return [
    "LAGE",
    `${input.sourceStatus.tasks.ok ? `${open.length} Aufgaben sind offen, ${overdue.length} davon überfällig und ${dueToday.length} heute fällig.` : "Der Aufgabenstand ist nicht erreichbar."} ${input.sourceStatus.approvals.ok ? `${input.approvals} Freigaben warten.` : "Der Freigabestand ist unbekannt."}`,
    "",
    "WAS SICH BEWEGT HAT",
    projects.length
      ? `${projects.length} LifeOS-Projekte wurden im Zeitraum berührt: ${projects.slice(0, 5).map((project) => project.name).join(", ")}.`
      : "Keine veränderte LifeOS-Projektnotiz wurde im Zeitraum gefunden.",
    input.codexThreads.length
      ? `${input.codexThreads.length} Codex-Aufträge wurden im Zeitraum berührt: ${input.codexThreads.slice(0, 4).map((thread) => thread.title).join(" · ")}.`
      : "Kein veränderter Codex-Auftrag wurde im Zeitraum gefunden.",
    "",
    "OFFENE SCHLEIFEN",
    loops.length ? loops.map((item) => `• ${item}`).join("\n") : "Keine fällige Schleife aus den erreichbaren Aufgaben ablesbar.",
    "",
    "NÄCHSTE 3 SCHRITTE",
    next.length ? next.map((item, index) => `${index + 1}. ${item}`).join("\n") : "1. Den nächsten konkreten Projektschritt festlegen.",
    "",
    "QUELLENLÜCKEN",
    failures.length ? failures.join("; ") : "Keine erkannte Quellenlücke.",
  ].join("\n");
}
