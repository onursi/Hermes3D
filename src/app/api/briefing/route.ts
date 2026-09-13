import { NextResponse } from "next/server";
import path from "node:path";

import { listRecentCodexThreads, type CodexThreadSnapshot } from "@/lib/codex/appServer";
import {
  briefingSources,
  buildBriefingPrompt,
  buildLocalBriefing,
  type BriefingInput,
  type BriefingProject,
  type BriefingTask,
} from "@/lib/briefing/synthesis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Source<T> = { ok: boolean; value: T; reason?: string };

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const hoursRaw = Number(url.searchParams.get("hours") ?? 24);
  const hours = Number.isFinite(hoursRaw) ? Math.max(4, Math.min(Math.round(hoursRaw), 168)) : 24;
  const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1_000);
  const today = new Date().toISOString().slice(0, 10);

  const [tasksResult, approvalsResult, projectsResult, codexResult] = await Promise.allSettled([
    fetchJson(`${url.origin}/api/todoist/tasks`),
    fetchJson(`${url.origin}/api/approvals`),
    fetchJson(`${url.origin}/api/vault/projects`),
    listRecentCodexThreads({ since: sinceDate, limit: 16 }),
  ]);

  let tasks: Source<BriefingTask[]> = { ok: false, value: [], reason: "Todoist nicht erreichbar" };
  if (tasksResult.status === "fulfilled") {
    const value = tasksResult.value;
    tasks = value?.connected === false
      ? { ok: false, value: [], reason: "Todoist nicht verbunden" }
      : { ok: true, value: Array.isArray(value?.tasks) ? value.tasks : [] };
  } else tasks.reason = String(tasksResult.reason).slice(0, 180);

  let approvals: Source<number> = { ok: false, value: 0, reason: "Freigaben nicht erreichbar" };
  if (approvalsResult.status === "fulfilled") {
    const value = approvalsResult.value;
    approvals = value?.ok === true
      ? { ok: true, value: Number(value?.count ?? 0) }
      : { ok: false, value: 0, reason: value?.reason ?? "Freigaben nicht erreichbar" };
  } else approvals.reason = String(approvalsResult.reason).slice(0, 180);

  let projects: Source<BriefingProject[]> = { ok: false, value: [], reason: "LifeOS-Projekte nicht erreichbar" };
  if (projectsResult.status === "fulfilled") {
    const value = projectsResult.value;
    projects = value?.reachable === true
      ? { ok: true, value: Array.isArray(value?.projects) ? value.projects : [] }
      : { ok: false, value: [], reason: value?.error ?? "LifeOS-Projekte nicht erreichbar" };
  } else projects.reason = String(projectsResult.reason).slice(0, 180);

  const codex: Source<CodexThreadSnapshot[]> = codexResult.status === "fulfilled"
    ? { ok: true, value: codexResult.value }
    : { ok: false, value: [], reason: String(codexResult.reason).slice(0, 180) };

  const input: BriefingInput = {
    today,
    since: sinceDate.toISOString(),
    tasks: tasks.value,
    approvals: approvals.value,
    projects: projects.value,
    codexThreads: codex.value,
    sourceStatus: {
      tasks: { ok: tasks.ok, reason: tasks.reason },
      approvals: { ok: approvals.ok, reason: approvals.reason },
      projects: { ok: projects.ok, reason: projects.reason },
      codex: { ok: codex.ok, reason: codex.reason },
    },
  };
  const sources = briefingSources(input);
  const facts = {
    hours,
    since: input.since,
    until: new Date().toISOString(),
    sourceStatus: input.sourceStatus,
    counts: {
      tasks: input.tasks.length,
      approvals: input.approvals,
      projects: input.projects.length,
      codexThreads: input.codexThreads.length,
    },
  };

  if (!Object.values(input.sourceStatus).some((state) => state.ok)) {
    return NextResponse.json({ ok: false, briefing: null, facts, sources: [], reason: "Keine Briefing-Quelle erreichbar." });
  }

  try {
    const nodeRequire = eval("require") as NodeJS.Require;
    const { askHermes } = nodeRequire(path.join(process.cwd(), "server", "hermes-ws-client.js")) as {
      askHermes: (text: string) => Promise<string>;
    };
    const answer = (await askHermes(buildBriefingPrompt(input))).trim();
    if (!answer || /^Error:/i.test(answer)) throw new Error(answer || "Hermes hat leer geantwortet.");
    return NextResponse.json({ ok: true, mode: "hermes", briefing: answer, facts, sources });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      mode: "local",
      briefing: buildLocalBriefing(input),
      facts,
      sources,
      warning: `Hermes-Synthese nicht erreichbar; belegter lokaler Stand wird gezeigt. ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
