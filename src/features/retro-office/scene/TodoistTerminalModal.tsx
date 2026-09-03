"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, Smartphone, Plus, Key, RefreshCw, X, ArrowUpRight } from "lucide-react";

type TodoistTask = {
  id: string;
  content: string;
  is_completed?: boolean;
  priority?: number;
  project_name?: string;
  due?: { string?: string };
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
  const [tokenInput, setTokenInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [showTokenSettings, setShowTokenSettings] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("hermes_todoist_token") || "";
    if (saved) {
      setToken(saved);
      setTokenInput(saved);
    }
  }, []);

  const fetchTasks = async (overrideToken?: string) => {
    setLoading(true);
    const activeToken = overrideToken !== undefined ? overrideToken : token;
    try {
      const res = await fetch(`/api/todoist/tasks?token=${encodeURIComponent(activeToken)}`);
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
        setIsConnected(data.isConnected);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen, token]);

  const handleSaveToken = () => {
    const trimmed = tokenInput.trim();
    localStorage.setItem("hermes_todoist_token", trimmed);
    setToken(trimmed);
    fetchTasks(trimmed);
    setShowTokenSettings(false);
  };

  const handleToggleTask = async (task: TodoistTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_completed: !t.is_completed } : t))
    );

    try {
      await fetch("/api/todoist/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, token }),
      });
    } catch (err) {
      console.error("Failed to close task:", err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const text = newTaskText.trim();
    setNewTaskText("");

    try {
      const res = await fetch("/api/todoist/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, priority: 3, token }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => [data.task, ...prev]);
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  if (!isOpen) return null;

  const getPriorityBadge = (priority?: number) => {
    switch (priority) {
      case 4:
        return <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-400 border border-rose-500/30">P1 Notfall</span>;
      case 3:
        return <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/30">P2 Hoch</span>;
      case 2:
        return <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400 border border-cyan-500/30">P3 Normal</span>;
      default:
        return <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">P4 Routine</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-3xl border border-red-500/30 bg-[#070b14]/95 p-6 shadow-2xl shadow-red-950/40 backdrop-blur-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/30">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-base font-bold text-white tracking-wide">
                  TODOIST • IPHONE MISSION CONTROL
                </h2>
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono border ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                  {isConnected ? "Live mit iPhone synchronisiert" : "LifeOS Offline Modus"}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Aufgaben in 3D abhaken markiert sie in Echtzeit auf deinem iPhone
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTokenSettings((prev) => !prev)}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-2.5 text-xs text-slate-300 hover:border-red-400 hover:text-white transition cursor-pointer"
              title="API-Token konfigurieren"
            >
              <Key size={13} />
              <span className="font-mono text-[10px]">Token</span>
            </button>
            <button
              type="button"
              onClick={() => fetchTasks()}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white transition cursor-pointer"
              title="Neu laden"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-red-400 hover:text-white transition cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Token Settings Drawer */}
        {showTokenSettings && (
          <div className="mt-3 rounded-2xl border border-red-500/30 bg-black/50 p-4 font-mono text-xs flex flex-col gap-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                <Key size={13} className="text-red-400" />
                Todoist API-Token einbinden
              </span>
              <a
                href="https://todoist.com/app/settings/integrations/developer"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-red-400 hover:underline flex items-center gap-1"
              >
                Token in Todoist kopieren <ArrowUpRight size={10} />
              </a>
            </div>
            <p className="text-[10px] text-slate-400">
              Kopiere deinen persönlichen Token aus <i>Einstellungen → Integrationen → Entwickler → API-Token</i> und füge ihn hier ein:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Füge hier deinen Todoist API-Token ein..."
                className="w-full rounded-xl border border-slate-700 bg-[#070e1c] px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-red-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveToken}
                className="rounded-xl bg-red-600 px-4 py-1.5 font-bold text-white hover:bg-red-500 transition text-xs shrink-0 cursor-pointer"
              >
                Speichern
              </button>
            </div>
          </div>
        )}

        {/* Quick Add Form */}
        <form onSubmit={handleCreateTask} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="+ Neue Aufgabe für dein iPhone erstellen..."
            className="w-full rounded-xl border border-slate-800 bg-[#070e1c] px-3.5 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-red-400 focus:outline-none shadow-inner"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 font-mono text-xs font-bold text-white hover:brightness-110 shadow-lg shadow-red-600/30 transition shrink-0 cursor-pointer"
          >
            <Plus size={14} />
            <span>Erstellen</span>
          </button>
        </form>

        {/* Task List */}
        <div className="mt-4 flex max-h-[380px] flex-col gap-2 overflow-y-auto pr-1 font-mono scrollbar-thin scrollbar-thumb-red-500/20">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <CheckCircle2 size={32} className="text-slate-600 mb-2" />
              <span className="text-xs">Alle Aufgaben auf deinem iPhone erledigt!</span>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task)}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition cursor-pointer ${
                  task.is_completed
                    ? "border-slate-800/60 bg-black/20 opacity-50"
                    : "border-slate-800 bg-[#080d1a]/80 hover:border-red-500/40 hover:bg-[#0c1324] shadow-md"
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-400 transition cursor-pointer"
                  >
                    {task.is_completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-500 hover:text-red-400" />
                    )}
                  </button>
                  <span
                    className={`text-xs ${
                      task.is_completed ? "line-through text-slate-500" : "text-slate-200 font-medium"
                    }`}
                  >
                    {task.content}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getPriorityBadge(task.priority)}
                  {task.due?.string && (
                    <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
                      {task.due.string}
                    </span>
                  )}
                  {task.project_name && (
                    <span className="text-[9px] text-slate-500 font-mono">
                      #{task.project_name}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-[10px] font-mono text-slate-500">
          <span>{tasks.filter((t) => !t.is_completed).length} offene Aufgaben synchronisiert</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Smartphone size={11} className="text-red-400" />
            iOS / Todoist REST API v2
          </span>
        </div>

      </div>
    </div>
  );
}
