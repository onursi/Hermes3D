import { describe, expect, it } from "vitest";

import {
  briefingSources,
  buildBriefingPrompt,
  buildLocalBriefing,
  buildQuickStart,
  changedProjects,
  type BriefingInput,
} from "../../src/lib/briefing/synthesis";

const input: BriefingInput = {
  today: "2026-09-13",
  since: "2026-09-12T12:00:00.000Z",
  tasks: [{ content: "Wichtige Schleife", dueDate: "2026-09-12", projectName: "Arbeit" }],
  approvals: 0,
  projects: [
    {
      name: "Hermes3D",
      lastTouched: "2026-09-13T10:00:00.000Z",
      openTasks: 2,
      recentNotes: [
        { title: "Übergabe", path: "05 Projekte/Hermes3D/Übergabe.md", modified: "2026-09-13T10:00:00.000Z" },
      ],
    },
    {
      name: "Alt",
      lastTouched: "2026-08-01T10:00:00.000Z",
      openTasks: 0,
      recentNotes: [],
    },
  ],
  projectStates: [],
  codexThreads: [
    {
      id: "thread-1",
      title: "Kommandozentrale verbessern",
      preview: "Baue das Wiedereinstiegsbriefing.",
      updatedAt: "2026-09-13T11:00:00.000Z",
      cwd: "C:/Life OS",
      status: "idle",
    },
  ],
  sourceStatus: {
    tasks: { ok: true },
    approvals: { ok: false, reason: "Gateway offline" },
    projects: { ok: true },
    codex: { ok: true },
  },
};

describe("grounded briefing synthesis", () => {
  it("limits changed projects to the requested time window", () => {
    expect(changedProjects(input).map((project) => project.name)).toEqual(["Hermes3D"]);
  });

  it("keeps Codex work orders distinct from documented results", () => {
    const prompt = buildBriefingPrompt(input);
    expect(prompt).toContain("Codex-Vorschauen sind Arbeitsaufträge, keine abgeschlossenen Ergebnisse");
    expect(prompt).toContain("[Q1]");
  });

  it("marks only vault sources as spatially navigable", () => {
    const sources = briefingSources(input);
    expect(sources.find((source) => source.kind === "vault")?.navigable).toBe(true);
    expect(sources.find((source) => source.kind === "codex")?.navigable).toBe(false);
    expect(sources.find((source) => source.kind === "task")?.navigable).toBe(false);
  });

  it("does not report zero approvals when the approval source is unreachable", () => {
    const local = buildLocalBriefing(input);
    expect(local).toContain("Freigabestand ist unbekannt");
    expect(local).not.toContain("0 Freigaben warten");
  });

  it("puts the decision, latest focus and one next task into a three-line quick start", () => {
    const quick = buildQuickStart(input);
    expect(quick).toContain("[ENTSCHEIDUNG] Freigabestand unbekannt");
    expect(quick).toContain("[FOKUS] Hermes3D · zuletzt Übergabe");
    expect(quick).toContain("[NÄCHSTER SCHRITT] Wichtige Schleife · Arbeit");
  });

  it("uses a documented project state for focus, next step and source evidence", () => {
    const grounded: BriefingInput = {
      ...input,
      projectStates: [
        {
          title: "Hermes3D",
          path: "05 Projekte/Hermes3D/Übergabe.md",
          state: "in-arbeit",
          workDate: "2026-09-13",
          current: "Das echte Wiedereinstiegsbriefing läuft.",
          nextTodo: "Den 60-Sekunden-Wiedereinstieg abnehmen.",
          blocker: "Visuelle Abnahme fehlt.",
        },
      ],
    };

    const quick = buildQuickStart(grounded);
    const source = briefingSources(grounded).find((entry) => entry.kind === "vault");
    expect(quick).toContain("[FOKUS] Hermes3D · Das echte Wiedereinstiegsbriefing läuft.");
    expect(quick).toContain("[NÄCHSTER SCHRITT] Den 60-Sekunden-Wiedereinstieg abnehmen.");
    expect(source?.excerpt).toContain("Aktuell: Das echte Wiedereinstiegsbriefing läuft.");
    expect(source?.excerpt).toContain("Blocker: Visuelle Abnahme fehlt.");
  });
});
