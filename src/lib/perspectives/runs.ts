import { randomUUID } from "node:crypto";
import { ROLES, moderationPrompt, plannedCalls, reviewPrompt, rolePrompt, type Contribution, type CouncilRun, type CouncilSettings } from "@/features/perspectives/model";
import { askModel } from "./providers";

type Job = { run: CouncilRun; controller: AbortController };
const shared = globalThis as typeof globalThis & { __hermesPerspectiveRuns?: Map<string, Job> };
const jobs = shared.__hermesPerspectiveRuns ??= new Map<string, Job>();
const safeError = (error: unknown) => error instanceof Error ? error.message.slice(0, 250) : "Anfrage fehlgeschlagen.";

export function findRun(id: string): CouncilRun | undefined {
  const job = jobs.get(id);
  if (job && job.run.state !== "running" && Date.now() - (job.run.finishedAt ?? job.run.createdAt) > 3_600_000) { jobs.delete(id); return undefined; }
  return job?.run;
}
export function cancelRun(id: string): CouncilRun | undefined {
  const job = jobs.get(id);
  if (job?.run.state === "running") { job.controller.abort(); job.run.state = "cancelled"; job.run.finishedAt = Date.now(); }
  return job?.run;
}

type Ask = (prompt: string, choice: Contribution, signal: AbortSignal) => ReturnType<typeof askModel>;
/** Sequential stages, at most two independent calls at a time. No retries or fallback models. */
export async function executeRun(run: CouncilRun, context: string, settings: CouncilSettings, signal: AbortSignal, ask: Ask = askModel): Promise<void> {
  async function answer(entry: Contribution, prompt: string) {
    if (signal.aborted) { entry.state = "cancelled"; return; }
    entry.state = "running";
    try { entry.answer = await ask(prompt, entry, signal); entry.state = signal.aborted ? "cancelled" : "done"; }
    catch (error) { entry.state = signal.aborted ? "cancelled" : "error"; entry.error = safeError(error); }
  }
  async function stage(entries: Contribution[], prompt: (entry: Contribution) => string) {
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(2, entries.length) }, async () => {
      while (index < entries.length) { const entry = entries[index++]; await answer(entry, prompt(entry)); }
    }));
  }
  try {
    await stage(run.opinions, (entry) => rolePrompt(run.mission, context, ROLES.find((role) => role.id === entry.role)!, settings.words));
    if (signal.aborted) return;
    if (!run.opinions.some((entry) => entry.state === "done")) { run.state = "error"; run.moderation.state = "skipped"; run.error = "Keine Rolle hat erfolgreich geantwortet. Moderation wurde nicht gestartet."; return; }
    if (settings.review) {
      run.phase = "review";
      // Failed first opinions do not cause another paid attempt.
      run.reviews = run.opinions.filter((entry) => entry.state === "done").map((entry) => ({ ...entry, state: "waiting", answer: undefined, error: undefined }));
      await stage(run.reviews, (entry) => reviewPrompt(run.mission, context, ROLES.find((role) => role.id === entry.role)!, run.opinions, settings.words));
    }
    if (signal.aborted) return;
    run.phase = "moderation";
    await answer(run.moderation, moderationPrompt(run.mission, context, run.opinions, run.reviews));
    run.state = run.moderation.state === "done" ? "done" : "error";
    if (run.state === "error") run.error = "Die Auswertung fehlt. Die einzelnen Beiträge bleiben sichtbar.";
  } finally {
    if (signal.aborted) {
      run.state = "cancelled";
      for (const entry of [...run.opinions, ...run.reviews, run.moderation]) if (entry.state === "waiting" || entry.state === "running") entry.state = "cancelled";
    }
    run.phase = "finished"; run.finishedAt = Date.now();
  }
}

export function startRun(mission: string, context: string, settings: CouncilSettings): CouncilRun {
  for (const [id, job] of jobs) if (job.run.state !== "running" && Date.now() - (job.run.finishedAt ?? job.run.createdAt) > 3_600_000) jobs.delete(id);
  if (Array.from(jobs.values()).some((job) => job.run.state === "running")) throw new Error("Ein Perspektivenrat läuft bereits. Bitte abschließen oder abbrechen.");
  if (jobs.size >= 20) { const old = jobs.keys().next().value; if (old) jobs.delete(old); }
  const run: CouncilRun = { id: randomUUID(), mission, state: "running", phase: "opinions", opinions: settings.roles.filter((entry) => entry.enabled).map((entry) => ({ ...entry, name: ROLES.find((role) => role.id === entry.role)!.name, state: "waiting" })), reviews: [], moderation: { ...settings.moderator, role: "moderator", name: "Hermes · Auswertung", state: "waiting" }, createdAt: Date.now(), plannedCalls: plannedCalls(settings) };
  const controller = new AbortController();
  jobs.set(run.id, { run, controller });
  void executeRun(run, context, settings, controller.signal).catch(() => { run.state = "error"; run.error = "Ratslauf fehlgeschlagen."; });
  return run;
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host); } catch { return false; }
}
