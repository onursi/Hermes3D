import { createHash, randomUUID } from "node:crypto";

type Task = { id: string; task_id?: string; content: string; checked?: boolean; is_completed?: boolean; is_deleted?: boolean; completed_at?: string; due?: { date?: string; datetime?: string } };
const API = "https://api.todoist.com/api/v1";
const pending = new Map<string, { taskId: string; title: string; owner: string; until: number }>();
export const todoistToken = (req?: Request) => req?.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || process.env.TODOIST_API_TOKEN?.trim() || "";
export function localDay(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function nextDay(day: string) { return new Date(Date.parse(day + "T12:00:00Z") + 86400000).toISOString().slice(0, 10); }
export function midnight(day: string, zone: string) {
  const desired = Date.parse(day + "T00:00:00Z"); let time = desired;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(time));
    const get = (type: string) => parts.find(p => p.type === type)!.value;
    const asUTC = Date.parse(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`);
    time += desired - asUTC;
  }
  return new Date(time).toISOString();
}
async function request(path: string, token: string, signal?: AbortSignal, method = "GET") {
  const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "Todoist-Zugang oder Berechtigung fehlt." : `Todoist-Abruf fehlgeschlagen (${res.status}).`);
  return res;
}
async function pages(path: string, token: string, signal?: AbortSignal) {
  const tasks: Task[] = []; let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const url = new URL(API + path); url.searchParams.set("limit", "200"); if (cursor) url.searchParams.set("cursor", cursor);
    const res = await request(url.pathname.slice("/api/v1".length) + url.search, token, signal);
    const data = await res.json(); const items = data.results ?? data.items;
    if (!Array.isArray(items)) throw new Error("Todoist-Antwort nicht auswertbar.");
    tasks.push(...items); cursor = data.next_cursor ?? null;
    if (!cursor) return tasks;
  }
  throw new Error("Todoist-Liste unvollständig. Keine vollständige Zusammenfassung möglich.");
}
const minimal = (task: Task) => ({ id: task.task_id || task.id, title: task.content.slice(0, 300) });
/** Monday of the week that contains the given local day. */
export function weekStart(day: string) { const date = new Date(Date.parse(day + "T12:00:00Z")); return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10); }
export async function taskSummary(token: string, period: "today" | "tomorrow" | "week", zone: string, now = new Date(), signal?: AbortSignal) {
  const today = localDay(now, zone), day = period === "tomorrow" ? nextDay(today) : today;
  const open = (await pages("/tasks", token, signal)).filter(t => !t.checked && !t.is_completed && !t.is_deleted);
  const due = (task: Task) => {
    const value = task.due?.datetime || task.due?.date;
    return value ? (/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ? localDay(new Date(value), zone) : value.slice(0, 10)) : null;
  };
  // The week runs Monday to Sunday: done so far, plus what is still due before it ends.
  const monday = weekStart(today), sunday = new Date(Date.parse(monday + "T12:00:00Z") + 6 * 86400000).toISOString().slice(0, 10);
  const selected = period === "week" ? open.filter(t => due(t) && due(t)! >= today && due(t)! <= sunday) : open.filter(t => due(t) === day);
  const overdue = period !== "tomorrow" ? open.filter(t => due(t) && due(t)! < today) : [];
  let completed: Task[] = [], completedError: string | null = null;
  if (period !== "tomorrow") {
    try { completed = await pages(`/tasks/completed/by_completion_date?since=${encodeURIComponent(midnight(period === "week" ? monday : today, zone))}&until=${encodeURIComponent(midnight(nextDay(today), zone))}`, token, signal); }
    catch (error) { if (signal?.aborted) throw error; completedError = error instanceof Error ? error.message : "Erledigungen nicht abrufbar."; }
  }
  return { ok: true, period, date: day, ...(period === "week" ? { weekFrom: monday, weekTo: sunday } : {}), timeZone: zone, due: selected.slice(0, 40).map(minimal), dueCount: selected.length, overdue: overdue.slice(0, 20).map(minimal), overdueCount: overdue.length, completed: completed.slice(0, 40).map(minimal), completedCount: completedError ? null : completed.length, completedError, truncated: selected.length > 40 || completed.length > 40 || overdue.length > 20 };
}
const owner = (token: string) => createHash("sha256").update(token).digest("hex");
export async function prepareCompletion(token: string, taskId: string, signal?: AbortSignal) {
  if (!/^[\w-]{1,100}$/.test(taskId)) throw new Error("Ungültige Aufgaben-ID.");
  const task: Task = await (await request(`/tasks/${encodeURIComponent(taskId)}`, token, signal)).json();
  if (task.checked || task.is_completed || task.is_deleted) throw new Error("Diese Aufgabe ist nicht mehr offen.");
  for (const [key, value] of pending) if (value.until < Date.now()) pending.delete(key);
  const proof = randomUUID(); const title = task.content.slice(0, 300);
  pending.set(proof, { taskId, title, owner: owner(token), until: Date.now() + 300000 });
  return { ok: true, requiresConfirmation: true, pendingTask: { id: taskId, title, proof } };
}
export async function completeTask(token: string, proof: string, signal?: AbortSignal) {
  const task = pending.get(proof);
  if (!task || task.until < Date.now() || task.owner !== owner(token)) throw new Error("Aufgabenfreigabe abgelaufen. Aufgabe erneut auswählen.");
  pending.delete(proof); // Single use, including after an uncertain network result.
  await request(`/tasks/${encodeURIComponent(task.taskId)}/close`, token, signal, "POST");
  return { ok: true, completed: { id: task.taskId, title: task.title } };
}
