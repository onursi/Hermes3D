"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ListTodo,
  MessageSquare,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { cyberAudio } from "@/lib/sound/cyberAudio";

interface CouncilDiagramModalProps {
  topic?: string | null;
  agents?: Array<{ id: string; name: string; [key: string]: any }>;
  onClose: () => void;
}

type CouncilStatement = {
  agent: string;
  role: string;
  color: string;
  statement: string;
  category: "analyse" | "architektur" | "risiko" | "strategie";
};

type CouncilSynthesis = {
  consensus: string;
  objections: string;
  recommendedDecision: string;
  nextActions: string[];
};

const DEFAULT_COUNCIL_DISCUSSIONS: Record<
  string,
  { question: string; statements: CouncilStatement[]; synthesis: CouncilSynthesis }
> = {
  "architektur": {
    question: "Sollen wir das Multi-Modell-Routing auf direktes Streaming umstellen?",
    statements: [
      {
        agent: "Claude",
        role: "Architektur & Code-Qualität",
        color: "#ea580c",
        statement: "Streaming reduziert Time-to-First-Token drastisch von 1.4s auf 180ms. Wir müssen jedoch Backpressure-Handling für Verbindungsabbrüche absichern.",
        category: "architektur",
      },
      {
        agent: "ChatGPT",
        role: "Entwickler- & User-Experience",
        color: "#0ea5e9",
        statement: "Aus UX-Sicht absolut notwendig. Benutzer spüren sofortige Reaktionsfähigkeit. Ein Fallback auf Batching bei Netzwerkschwankungen sollte integriert sein.",
        category: "analyse",
      },
      {
        agent: "Gemini",
        role: "Multi-Modal & Skalierung",
        color: "#eab308",
        statement: "Server-Sent Events (SSE) passen perfekt zu unserer Edge-Architektur. Das Token-Budget kann bei Streaming sogar dynamisch gecancelt werden.",
        category: "strategie",
      },
      {
        agent: "Hermes",
        role: "Chief AI Officer & Governance",
        color: "#f59e0b",
        statement: "Sicherheits- und Rate-Limit-Richtlinien müssen konsistent eingehalten werden. Streaming-Verbindungen werden zentral über das Gateway überwacht.",
        category: "strategie",
      },
    ],
    synthesis: {
      consensus: "Einführung von SSE-Streaming für alle Hauptinteraktionen zur Senkung der Reaktionszeit auf unter 200ms.",
      objections: "Claude fordert robusten Reconnect; Hermes verlangt strikte Einhaltung der Token-Budgets.",
      recommendedDecision: "Streaming sofort als Standard aktivieren, mit maximal 4 parallelen Streams pro Client und automatischem Fallback.",
      nextActions: [
        "SSE-Stream-Handler in Gateway Runtime implementieren (Claude)",
        "Connection-Pool-Limits & Token-Budgets verankern (Hermes)",
        "Client-Buffer mit Audio-Feedback verknüpfen (ChatGPT)",
        "End-to-End Latenzmessung auf Dashboard ausrollen (Gemini)",
      ],
    },
  },
  "roadmap": {
    question: "Welche KI-Fähigkeiten sollen für das nächste Release priorisiert werden?",
    statements: [
      {
        agent: "Hermes",
        role: "Orchestrator & Frontdoor",
        color: "#a855f7",
        statement: "Der Fokus liegt auf nahtloser Delegation: Der Nutzer soll eine komplexe Aufgabe stellen und das Council teilt sie eigenständig auf.",
        category: "strategie",
      },
      {
        agent: "Claude",
        role: "Qualität & Sicherheit",
        color: "#ea580c",
        statement: "Automatisierte Code-Reviews und Testgenerierung müssen als Quality Gate vorgeschaltet sein, bevor Code committet wird.",
        category: "architektur",
      },
      {
        agent: "Gemini",
        role: "Wissensvernetzung",
        color: "#eab308",
        statement: "Integration von Multi-Modal Context: Screenshots und UI-Mockups direkt im 3D-Büro per Drag & Drop analysieren.",
        category: "analyse",
      },
      {
        agent: "Hermes",
        role: "Chief AI Officer & Governance",
        color: "#f59e0b",
        statement: "Autonome Multi-Modell-Kollaboration und verlässliche Aufgabenteilung bieten den höchsten Hebel für das Gesamtsystem.",
        category: "strategie",
      },
    ],
    synthesis: {
      consensus: "Priorisierung von automatischer Aufgabenteilung (Hermes) und vorgeschalteten Code-Reviews (Claude) als Release-Kern.",
      objections: "Multi-Modal (Gemini) erfordert zusätzliche Bandbreite; UX-Rückmeldungen (ChatGPT) müssen schnell fließen.",
      recommendedDecision: "Release v2.5 fokussiert auf autonomes Multi-Modell-Pair-Programming mit integriertem Quality Gate.",
      nextActions: [
        "Delegations-Matrix in Hermes Core hinterlegen (Hermes)",
        "Automatisierte Code-Review-Pipeline fertigstellen (Claude)",
        "Multi-Modale Kontextverarbeitung aktivieren (Gemini)",
      ],
    },
  },
};

export function CouncilDiagramModal({ topic, agents, onClose }: CouncilDiagramModalProps) {
  const [activeTab, setActiveTab] = useState<"council_live" | "matrix" | "roles">("council_live");
  const [selectedTopic, setSelectedTopic] = useState<string>("architektur");
  const [discussionStep, setDiscussionStep] = useState<number>(0);
  const [customQuestion, setCustomQuestion] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  const currentDiscussion = DEFAULT_COUNCIL_DISCUSSIONS[selectedTopic] ?? DEFAULT_COUNCIL_DISCUSSIONS["architektur"];

  // Handle ESC key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleStartCouncil = () => {
    cyberAudio.playChime();
    setDiscussionStep(1);
    setIsSimulating(true);
  };

  const handleNextStep = () => {
    cyberAudio.playBlip();
    setDiscussionStep((prev) => Math.min(prev + 1, currentDiscussion.statements.length + 1));
  };

  const handleReset = () => {
    cyberAudio.playBlip();
    setDiscussionStep(0);
    setIsSimulating(false);
  };

  const AGENT_ROLES: Record<string, { role: string; desc: string; color: string; bg: string }> = {
    Hermes: {
      role: "Orchestrator & Synthese",
      desc: "Zentrale Ablaufsteuerung, Moderation, Konsensbildung & Entscheidungsvorlage",
      color: "#a855f7",
      bg: "rgba(168, 85, 247, 0.12)",
    },
    Claude: {
      role: "Lead Code Reviewer & Architektur",
      desc: "Code-Qualität, Refactoring, Systementwurf & Security Best Practices",
      color: "#ea580c",
      bg: "rgba(234, 88, 12, 0.12)",
    },
    ChatGPT: {
      role: "Entwickler- & User-Experience",
      desc: "Interface-Gestaltung, Usability, API-Design & intuitive Workflows",
      color: "#0ea5e9",
      bg: "rgba(14, 165, 233, 0.12)",
    },
    Gemini: {
      role: "Multi-Modal & Performance-Skalierung",
      desc: "Große Datenmengen, Bild-/Kontext-Analyse & Hochleistungs-Pipelines",
      color: "#eab308",
      bg: "rgba(234, 179, 8, 0.12)",
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-[95vw] max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-purple-500/30 bg-[#090b14]/95 p-6 shadow-2xl shadow-purple-950/50 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-wider text-purple-300 uppercase">
                  KI-Council // Exekutiv-Beratung
                </h2>
                <span className="rounded-full bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 text-[10px] font-mono text-purple-400">
                  LIVE STATUS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Hermes, Claude, ChatGPT und Gemini diskutieren strukturiert
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

        {/* Tab Selection */}
        <div className="mt-4 flex gap-2 border-b border-slate-800/80 pb-2">
          <button
            onClick={() => {
              cyberAudio.playBlip();
              setActiveTab("council_live");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "council_live"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Council-Diskussion & Synthese
          </button>
          <button
            onClick={() => {
              cyberAudio.playBlip();
              setActiveTab("roles");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "roles"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Rollenverteilung & Spezialisierung
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {activeTab === "council_live" ? (
            <div className="flex flex-col gap-4">
              {/* Question Bar & Topic Selector */}
              <div className="rounded-xl border border-slate-800 bg-[#060a14] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[10px] font-mono uppercase text-purple-400 tracking-wider">
                    Aktuelle Fragestellung
                  </span>
                  <h3 className="text-sm font-semibold text-slate-100 mt-0.5">
                    {currentDiscussion.question}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTopic}
                    onChange={(e) => {
                      setSelectedTopic(e.target.value);
                      handleReset();
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="architektur">Thema: Streaming-Architektur</option>
                    <option value="roadmap">Thema: Release-Roadmap</option>
                  </select>
                  {discussionStep === 0 ? (
                    <button
                      onClick={handleStartCouncil}
                      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:brightness-110 transition"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Diskussion starten
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {discussionStep <= currentDiscussion.statements.length ? (
                        <button
                          onClick={handleNextStep}
                          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition"
                        >
                          Nächster Sprecher ▶
                        </button>
                      ) : null}
                      <button
                        onClick={handleReset}
                        className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition"
                        title="Neu starten"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Discussion Cards */}
              <div className="flex flex-col gap-3">
                {currentDiscussion.statements.map((stmt, idx) => {
                  const isVisible = discussionStep > idx;
                  const isCurrent = discussionStep === idx + 1;
                  if (!isVisible) return null;

                  return (
                    <div
                      key={stmt.agent}
                      className={`relative rounded-xl border p-4 transition-all duration-300 animate-in fade-in slide-in-from-left-2 ${
                        isCurrent
                          ? "border-purple-400/80 bg-purple-950/20 shadow-lg shadow-purple-950/40"
                          : "border-slate-800 bg-[#080d1a]/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: stmt.color }}
                          />
                          <span className="font-bold text-sm text-slate-100">
                            {stmt.agent}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            // {stmt.role}
                          </span>
                        </div>
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider"
                          style={{
                            color: stmt.color,
                            backgroundColor: `${stmt.color}15`,
                            border: `1px solid ${stmt.color}35`,
                          }}
                        >
                          {stmt.category}
                        </span>
                      </div>
                      <p className="mt-2.5 text-xs md:text-sm text-slate-300 leading-relaxed font-sans">
                        "{stmt.statement}"
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Hermes Final Synthesis */}
              {discussionStep > currentDiscussion.statements.length ? (
                <div className="rounded-xl border border-purple-500/50 bg-gradient-to-b from-purple-950/30 to-[#0c0f20] p-5 animate-in zoom-in-95 duration-300 shadow-xl">
                  <div className="flex items-center gap-2.5 border-b border-purple-500/30 pb-3">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    <div>
                      <h4 className="text-sm font-bold text-purple-200 uppercase tracking-wider">
                        Hermes Exekutiv-Synthese & Beschluss
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Zusammenfassung der Positionen von Claude, ChatGPT und Gemini
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Konsens
                      </div>
                      <p className="text-xs text-slate-300 leading-normal">
                        {currentDiscussion.synthesis.consensus}
                      </p>
                    </div>

                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Offene Einwände
                      </div>
                      <p className="text-xs text-slate-300 leading-normal">
                        {currentDiscussion.synthesis.objections}
                      </p>
                    </div>

                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
                      <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold mb-1">
                        <Lightbulb className="h-3.5 w-3.5" />
                        Empfohlene Entscheidung
                      </div>
                      <p className="text-xs text-slate-300 leading-normal">
                        {currentDiscussion.synthesis.recommendedDecision}
                      </p>
                    </div>
                  </div>

                  {/* Action Items */}
                  <div className="mt-4 pt-3 border-t border-purple-500/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">
                      <ListTodo className="h-4 w-4" />
                      Generierte nächste Aktionen (Action Items):
                    </div>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                      {currentDiscussion.synthesis.nextActions.map((action, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 rounded-lg bg-slate-900/60 border border-slate-800 p-2"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 font-mono text-[10px]">
                            {i + 1}
                          </span>
                          <span className="text-[11px] leading-tight">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            /* Roles Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(AGENT_ROLES).map(([name, role]) => (
                <div
                  key={name}
                  className="rounded-xl border border-slate-800 bg-[#080d1a] p-4 flex flex-col gap-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <h4 className="font-bold text-sm text-white">{name}</h4>
                    </div>
                    <span
                      className="rounded-md px-2 py-0.5 text-[10px] font-mono"
                      style={{
                        color: role.color,
                        backgroundColor: `${role.color}15`,
                        border: `1px solid ${role.color}35`,
                      }}
                    >
                      {role.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {role.desc}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
          <div>
            Protokoll: <span className="text-purple-400 font-mono">COUNCIL_SESSION_V2</span>
          </div>
          <button
            onClick={() => {
              cyberAudio.playBlip();
              onClose();
            }}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
