"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Key, Loader2, Plus, RefreshCw, X } from "lucide-react";

import { cyberAudio } from "@/lib/sound/cyberAudio";

/**
 * Todoist, as a working surface rather than a preview of one.
 *
 * The bar this has to clear is Onur's own: it must hold up against the real
 * app, or the 3D room around it is decoration. So the things a task list
 * actually needs are here — grouping by when something is due, ordering by
 * urgency inside each group, adding without reaching for the mouse, and
 * telling you when a write failed instead of quietly diverging from the
 * server.
 *
 * The version before this had a checkbox that always sent "close", so
 * unticking a task looked like it worked and changed nothing on Todoist; it
 * showed five invented tasks whenever the token was missing; and it passed the
 * token through the query string, which puts full account access into server
 * logs and browser history.
 */

type TodoistTask = {
  id: string;
  content: string;
  description?: string;
  isCompleted: boolean;
  priority: number;
  projectName?: string;
  dueDate?: string | null;
  dueText?: string | null;
  url?: string;
};

type Bucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "someday";

const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Überfällig",
  today: "Heute",
  tomorrow: "Morgen",
  week: "Diese Woche",
  later: "Später",
  someday: "Ohne Datum",
};

const BUCKET_ORDER: Bucket[] = ["overdue", "today", "tomorrow", "week", "later", "someday"];

/** Midnight today, so "overdue" means the day passed, not the hour. */
const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

function bucketFor(dueDate: string | null | undefined): Bucket {
  if (!dueDate) return "someday";
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "someday";
  const today = startOfToday();
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "week";
  return "later";
}

/** Todoist counts 4 as urgent down to 1 as none; the labels follow their UI. */
const PRIORITY_STYLE: Record<number, { label: string; dot: string; text: string }> = {
  4: { label: "P1", dot: "bg-rose-500", text: "text-rose-300" },
  3: { label: "P2", dot: "bg-amber-400", text: "text-amber-300" },
  2: { label: "P3", dot: "bg-sky-400", text: "text-sky-300" },
  1: { label: "P4", dot: "bg-slate-600", text: "text-slate-500" },
};

export function TodoistTerminalModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [token, setToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  const composerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setToken(localStorage.getItem("hermes_todoist_token") ?? "");
  }, []);

  const authHeaders = useCallback(
    (extra?: Record<string, string>) => ({
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    }),
    [token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/todoist/tasks", { headers: authHeaders() });
      const data = await res.json();
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setConnected(Boolean(data.connected));
      setReason(data.reason ?? null);
    } catch (cause) {
      setTasks([]);
      setConnected(false);
      setReason(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      // Slash focuses the composer, the way every list app worth using does.
      if (event.key === "/" && document.activeElement !== composerRef.current) {
        event.preventDefault();
        composerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggle = async (task: TodoistTask) => {
    const nextCompleted = !task.isCompleted;
    cyberAudio.playBlip();
    // Optimistic, but reversible: a write that fails must put the row back
    // rather than leave the screen disagreeing with the server.
    setTasks((prev) =>
      prev.map((item) => (item.id === task.id ? { ...item, isCompleted: nextCompleted } : item)),
    );
    markBusy(task.id, true);
    setError(null);
    try {
      const res = await fetch("/api/todoist/tasks", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ taskId: task.id, completed: nextCompleted }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.reason ?? `Fehler ${res.status}`);
    } catch (cause) {
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, isCompleted: task.isCompleted } : item,
        ),
      );
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      markBusy(task.id, false);
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !connected) return;
    setDraft("");
    setError(null);
    try {
      const res = await fetch("/api/todoist/tasks", {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        // Todoist parses the date out of the sentence itself, so "Steuer
        // morgen 9 Uhr" lands with a due date without a date picker.
        body: JSON.stringify({ content, dueString: content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.task) {
        throw new Error(data.reason ?? `Fehler ${res.status}`);
      }
      cyberAudio.playChime();
      setTasks((prev) => [data.task, ...prev]);
    } catch (cause) {
      setDraft(content);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const saveToken = () => {
    const trimmed = tokenDraft.trim();
    localStorage.setItem("hermes_todoist_token", trimmed);
    setToken(trimmed);
    setTokenPanelOpen(false);
  };

  const grouped = useMemo(() => {
    const open = tasks.filter((task) => !task.isCompleted);
    const buckets = new Map<Bucket, TodoistTask[]>();
    open.forEach((task) => {
      const bucket = bucketFor(task.dueDate);
      const list = buckets.get(bucket) ?? [];
      list.push(task);
      buckets.set(bucket, list);
    });
    buckets.forEach((list) =>
      list.sort(
        (a, b) => b.priority - a.priority || a.content.localeCompare(b.content, "de"),
      ),
    );
    return BUCKET_ORDER.map((bucket) => ({ bucket, items: buckets.get(bucket) ?? [] })).filter(
      (group) => group.items.length > 0,
    );
  }, [tasks]);

  const openCount = tasks.filter((task) => !task.isCompleted).length;
  const overdueCount = tasks.filter(
    (task) => !task.isCompleted && bucketFor(task.dueDate) === "overdue",
  ).length;

  if (!isOpen) return null;

  // z-[60], above every overlay in the room. The office also uses z-50, and at
  // equal depth the winner is decided by DOM order — not something to leave to
  // chance for a window that was reported as not opening at all.

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-[78vh] w-[min(720px,94vw)] flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-[#0b1017]/98 shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-white">Aufgaben</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {connected ? (
                <>
                  {openCount} offen
                  {overdueCount > 0 ? (
                    <span className="text-rose-400"> · {overdueCount} überfällig</span>
                  ) : null}
                </>
              ) : (
                "Nicht verbunden"
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
              title="Neu laden"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setTokenDraft(token);
                setTokenPanelOpen((open) => !open);
              }}
              className={`rounded-lg p-1.5 transition hover:bg-slate-800 hover:text-white ${
                connected ? "text-slate-400" : "text-amber-400"
              }`}
              title="Todoist-Token"
            >
              <Key size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title="Schließen (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {tokenPanelOpen ? (
          <div className="border-b border-slate-800 bg-[#0d141d] px-5 py-3.5">
            <label className="text-[11px] font-medium text-slate-300">
              API-Token — Todoist · Einstellungen · Integrationen · Entwickler
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={tokenDraft}
                onChange={(event) => setTokenDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && saveToken()}
                placeholder="Token einfügen"
                className="w-full rounded-lg border border-slate-700 bg-[#070c12] px-3 py-1.5 font-mono text-xs text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={saveToken}
                className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-200"
              >
                Speichern
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Bleibt in diesem Browser und wird nur als Kopfzeile an Todoist
              weitergereicht — nie in eine Adresszeile geschrieben.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start justify-between gap-3 border-b border-rose-900/50 bg-rose-950/40 px-5 py-2.5">
            <p className="text-[11px] leading-relaxed text-rose-200">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-rose-400 transition hover:text-rose-200"
            >
              <X size={13} />
            </button>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {!connected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <Key size={22} className="text-slate-600" />
              <p className="text-sm text-slate-300">Todoist ist nicht verbunden</p>
              <p className="max-w-sm text-[11px] leading-relaxed text-slate-500">
                {reason ?? "Unbekannter Grund."}
              </p>
            </div>
          ) : loading && tasks.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Check size={22} className="text-emerald-500" />
              <p className="text-sm text-slate-300">Nichts offen.</p>
            </div>
          ) : (
            grouped.map(({ bucket, items }) => (
              <section key={bucket} className="mb-4 last:mb-0">
                <h3
                  className={`px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest ${
                    bucket === "overdue" ? "text-rose-400" : "text-slate-500"
                  }`}
                >
                  {BUCKET_LABEL[bucket]}
                  <span className="ml-1.5 font-normal text-slate-600">{items.length}</span>
                </h3>
                <ul>
                  {items.map((task) => {
                    const priority = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE[1];
                    const busy = busyIds.has(task.id);
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => void toggle(task)}
                          disabled={busy}
                          className="group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-800/50 disabled:opacity-50"
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                              task.isCompleted
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-slate-600 group-hover:border-slate-400"
                            }`}
                          >
                            {task.isCompleted ? (
                              <Check size={11} className="text-slate-900" strokeWidth={3} />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-[13px] leading-snug ${
                                task.isCompleted
                                  ? "text-slate-600 line-through"
                                  : "text-slate-100"
                              }`}
                            >
                              {task.content}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                              <span className={`flex items-center gap-1 ${priority.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
                                {priority.label}
                              </span>
                              {task.projectName ? (
                                <span className="text-slate-500">{task.projectName}</span>
                              ) : null}
                              {task.dueText ? (
                                <span
                                  className={
                                    bucket === "overdue" ? "text-rose-400" : "text-slate-500"
                                  }
                                >
                                  {task.dueText}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        <form onSubmit={create} className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#070c12] px-3 py-2 focus-within:border-slate-500">
            <Plus size={15} className="shrink-0 text-slate-500" />
            <input
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!connected}
              placeholder={
                connected
                  ? "Aufgabe hinzufügen — „Steuer morgen 9 Uhr“ setzt das Datum mit"
                  : "Erst Token hinterlegen"
              }
              className="w-full bg-transparent text-[13px] text-white placeholder:text-slate-600 focus:outline-none disabled:cursor-not-allowed"
            />
            <kbd className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
              /
            </kbd>
          </div>
        </form>
      </div>
    </div>
  );
}
