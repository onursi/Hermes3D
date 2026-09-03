"use client";

import React, { useState } from "react";
import { X, CheckSquare, Save, Sparkles, FileText, Plus, Trash2 } from "lucide-react";
import { cyberAudio } from "@/lib/sound/cyberAudio";

interface WhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  onSave?: (text: string) => void;
}

export function WhiteboardModal({
  isOpen,
  onClose,
  initialText = "Projekt Hermes 3D — Hauptquartier",
  onSave,
}: WhiteboardModalProps) {
  const [activeTab, setActiveTab] = useState<"notes" | "checklist" | "agent_tasks">("notes");
  const [text, setText] = useState(initialText);
  const [todos, setTodos] = useState([
    { id: "1", text: "KI-Council Strategie-Meeting durchführen", done: true, agent: "Hermes" },
    { id: "2", text: "3D Orbital-Station Rendering optimieren", done: true, agent: "Claude" },
    { id: "3", text: "Stand-up Ablauf automatisieren", done: false, agent: "Gemini" },
    { id: "4", text: "Code-Synthese & Logik-Prüfung ausführen", done: false, agent: "ChatGPT" },
  ]);
  const [newTodoText, setNewTodoText] = useState("");

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    cyberAudio.playBlip();
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    cyberAudio.playBlip();
    setTodos((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: newTodoText.trim(),
        done: false,
        agent: "Hermes",
      },
    ]);
    setNewTodoText("");
  };

  const handleDeleteTodo = (id: string) => {
    cyberAudio.playBlip();
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = () => {
    cyberAudio.playChime();
    onSave?.(text);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-[92vw] max-w-2xl rounded-2xl border border-cyan-500/30 bg-[#090e1a]/95 p-6 shadow-2xl shadow-cyan-950/50 text-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wider text-cyan-300 uppercase">
                Cyber-Memo & Aufgabenpad
              </h2>
              <p className="text-xs text-slate-400">
                Wandnotizen & operative Aufgaben des Hauptquartiers
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              cyberAudio.playBlip();
              onClose();
            }}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-2 border-b border-slate-800/60 pb-2">
          <button
            onClick={() => {
              cyberAudio.playBlip();
              setActiveTab("notes");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "notes"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Whiteboard Notizen
          </button>
          <button
            onClick={() => {
              cyberAudio.playBlip();
              setActiveTab("checklist");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "checklist"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Operative Checkliste ({todos.filter((t) => t.done).length}/{todos.length})
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {activeTab === "notes" ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-400">
                Text auf dem linken Wanddisplay:
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-slate-800 bg-[#060a14] p-4 text-sm text-slate-200 font-mono focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                placeholder="Notizen oder Beschlüsse eintragen..."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Add Todo input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
                  placeholder="Neue Aufgabe hinzufügen..."
                  className="flex-1 rounded-xl border border-slate-800 bg-[#060a14] px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
                <button
                  onClick={handleAddTodo}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition"
                >
                  <Plus className="h-4 w-4" />
                  Hinzufügen
                </button>
              </div>

              {/* Todo List */}
              <div className="flex flex-col gap-2 mt-2">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    onClick={() => handleToggle(todo.id)}
                    className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                      todo.done
                        ? "border-emerald-500/20 bg-emerald-950/10 text-slate-400 line-through"
                        : "border-slate-800/80 bg-[#0b1220]/70 text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => {}}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                      />
                      <span className="text-sm">{todo.text}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-cyan-400">
                        {todo.agent}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTodo(todo.id);
                        }}
                        className="p-1 text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4">
          <div className="text-[11px] text-slate-500">
            Kanal: <span className="text-cyan-400 font-mono">HAUPTQUARTIER // INTERN</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                cyberAudio.playBlip();
                onClose();
              }}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 transition"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-900/30 hover:brightness-110 transition"
            >
              <Save className="h-3.5 w-3.5" />
              Speichern & Aktualisieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
