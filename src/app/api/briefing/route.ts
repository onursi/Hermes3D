import { NextResponse } from "next/server";
import path from "path";

/**
 * "Hey Hermes, wie ist mein Stand?"
 *
 * Not a read-aloud task list — those exist and nobody listens to them twice.
 * The point is advice: what the day actually looks like, and *one* thing to
 * do about it. A briefing that ends in five equally weighted suggestions has
 * made no decision and handed the work back.
 *
 * Every number here is fetched, never estimated. Each source reports its own
 * reachability, because "no approvals waiting" and "could not reach Hermes"
 * are different facts and a briefing that blurs them is worse than none.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Task = {
  content: string;
  isCompleted?: boolean;
  dueDate?: string | null;
  priority?: number;
  projectName?: string | null;
};

type Source<T> = { ok: boolean; value: T; reason?: string };

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const today = new Date().toISOString().slice(0, 10);

  // Gathered in parallel: three independent services, and one being slow
  // should not decide how long the briefing takes.
  const [tasksResult, approvalsResult] = await Promise.allSettled([
    fetchJson(`${origin}/api/todoist/tasks`),
    fetchJson(`${origin}/api/approvals`),
  ]);

  const tasks: Source<Task[]> =
    tasksResult.status === "fulfilled" && tasksResult.value?.connected !== false
      ? { ok: true, value: (tasksResult.value?.tasks ?? []) as Task[] }
      : {
          ok: false,
          value: [],
          reason:
            tasksResult.status === "rejected"
              ? String(tasksResult.reason).slice(0, 120)
              : "Todoist nicht verbunden",
        };

  const approvals: Source<number> =
    approvalsResult.status === "fulfilled" && approvalsResult.value?.ok
      ? { ok: true, value: approvalsResult.value.count ?? 0 }
      : { ok: false, value: 0, reason: "Freigaben nicht abrufbar" };

  const open = tasks.value.filter((task) => !task.isCompleted);
  const overdue = open.filter((task) => task.dueDate && task.dueDate < today);
  const dueToday = open.filter((task) => task.dueDate === today);

  const facts = {
    date: today,
    tasks: {
      reachable: tasks.ok,
      open: open.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      reason: tasks.reason,
    },
    approvals: { reachable: approvals.ok, waiting: approvals.value, reason: approvals.reason },
  };

  // Nothing to advise on, and no model asked. A briefing that pays for a
  // sentence about an empty day is theatre.
  if (!tasks.ok && !approvals.ok) {
    return NextResponse.json({
      ok: false,
      facts,
      briefing: null,
      reason: "Keine Datenquelle erreichbar — über den Stand lässt sich nichts sagen.",
    });
  }

  const lines = [
    `Datum: ${today}`,
    tasks.ok
      ? `Aufgaben offen: ${open.length}, davon ${overdue.length} überfällig und ${dueToday.length} heute fällig.`
      : `Aufgaben: nicht abrufbar (${tasks.reason}).`,
    approvals.ok
      ? `Wartende Freigaben: ${approvals.value}.`
      : `Freigaben: nicht abrufbar (${approvals.reason}).`,
    "",
    "Überfällig:",
    ...(overdue.slice(0, 8).map((task) => `- ${task.content}${task.projectName ? ` (${task.projectName})` : ""}`)),
    "",
    "Heute fällig:",
    ...(dueToday.slice(0, 8).map((task) => `- ${task.content}${task.projectName ? ` (${task.projectName})` : ""}`)),
  ];

  const prompt = [
    "Du bist Hermes und gibst Onur eine kurze Lagebesprechung zum Tag.",
    "",
    "Regeln:",
    "- Höchstens vier Sätze.",
    "- Keine Aufzählung der Aufgaben — die sieht er selbst.",
    "- Sage, was die Lage bedeutet, nicht was in der Liste steht.",
    "- Ende mit genau EINER konkreten Empfehlung, womit er anfangen soll.",
    "- Erfinde nichts. Steht eine Quelle als nicht abrufbar da, sage das.",
    "",
    "LAGE:",
    lines.join("\n"),
  ].join("\n");

  try {
    const nodeRequire = eval("require") as NodeJS.Require;
    const { askHermes } = nodeRequire(
      path.join(process.cwd(), "server", "hermes-ws-client.js"),
    ) as { askHermes: (text: string) => Promise<string> };

    const briefing = await askHermes(prompt);
    if (/^Error:/i.test(briefing.trim())) {
      return NextResponse.json({ ok: false, facts, briefing: null, reason: briefing.trim().slice(0, 400) });
    }
    return NextResponse.json({ ok: true, facts, briefing: briefing.trim() });
  } catch (error) {
    // The numbers survive even when the model does not, and they are the part
    // that was measured rather than written.
    return NextResponse.json({
      ok: false,
      facts,
      briefing: null,
      reason: `Hermes hat nicht geantwortet: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
