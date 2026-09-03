"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Mic,
  MicOff,
  Paperclip,
  Users,
  Check,
  Sparkles,
  Bot,
  X,
  MessageSquare,
  FileText,
  Maximize2,
} from "lucide-react";
import { cyberAudio } from "@/lib/sound/cyberAudio";
import { CyberIDEStudioModal } from "./CyberIDEStudioModal";

export interface TeamAgent {
  id: string;
  name: string;
  role: string;
  color: string;
  model: string;
}

const DEFAULT_AGENTS: TeamAgent[] = [
  { id: "hermes", name: "Hermes", role: "Chief AI Officer (Boss)", color: "#f59e0b", model: "Hermes 3" },
  { id: "claude", name: "Claude", role: "System & Architecture", color: "#f97316", model: "Claude 3.7 Sonnet" },
  { id: "chatgpt", name: "ChatGPT", role: "Implementation & Logic", color: "#2563eb", model: "GPT-4o" },
  { id: "gemini", name: "Gemini", role: "Deep Research & Verification", color: "#eab308", model: "Gemini 2.5 Pro" },
];

export function TeamDispatchBar({
  onDispatch,
}: {
  onDispatch?: (prompt: string, targetAgentIds: string[], attachments: File[]) => void;
}) {
  const [promptText, setPromptText] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(
    DEFAULT_AGENTS.map((a) => a.id),
  );
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [activeDispatchSummary, setActiveDispatchSummary] = useState<{
    prompt: string;
    targets: string[];
    responses: { agentName: string; color: string; text: string }[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Web Speech API initialization for speech-to-text dictation
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "de-DE";

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setPromptText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Spracheingabe wird in diesem Browser nicht unterstützt. Bitte nutze Chrome oder Edge.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      cyberAudio.playBlip();
    } else {
      cyberAudio.playChime();
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const toggleAgent = (agentId: string) => {
    cyberAudio.playBlip();
    if (selectedAgentIds.includes(agentId)) {
      if (selectedAgentIds.length === 1) return; // Keep at least one
      setSelectedAgentIds(selectedAgentIds.filter((id) => id !== agentId));
    } else {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  const selectAll = () => {
    cyberAudio.playBlip();
    if (selectedAgentIds.length === DEFAULT_AGENTS.length) {
      setSelectedAgentIds([DEFAULT_AGENTS[0].id]);
    } else {
      setSelectedAgentIds(DEFAULT_AGENTS.map((a) => a.id));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...filesArray]);
      cyberAudio.playChime();
    }
  };

  const handleSend = () => {
    if (!promptText.trim() && attachments.length === 0) return;
    cyberAudio.playChime();

    const targets = DEFAULT_AGENTS.filter((a) => selectedAgentIds.includes(a.id));
    const targetNames = targets.map((t) => t.name);

    // Generate council response preview
    const responses = targets.map((agent) => {
      let sampleText = "";
      if (agent.id === "hermes") {
        sampleText = `Ich koordiniere den Auftrag: "${promptText}". Die Aufgabenverteilung im Headquarter ist initiiert.`;
      } else if (agent.id === "claude") {
        sampleText = `Architektur- und Systemanalyse für "${promptText}" läuft. Datenkonsistenz und Struktur werden gesichert.`;
      } else if (agent.id === "chatgpt") {
        sampleText = `Operative Implementierung gestartet. Die Teilaufgaben wurden ins Kanban-Board übernommen.`;
      } else if (agent.id === "gemini") {
        sampleText = `Recherche und Validierung der Quellen bezüglich "${promptText}" wird mit Live-Daten abgeglichen.`;
      } else {
        sampleText = `Tiefenoptimierung und Logikprüfung abgeschlossen. Performance-Vorgaben sind erfüllt.`;
      }
      return {
        agentName: agent.name,
        color: agent.color,
        text: sampleText,
      };
    });

    setActiveDispatchSummary({
      prompt: promptText,
      targets: targetNames,
      responses,
    });
    setResponseModalOpen(true);

    onDispatch?.(promptText, selectedAgentIds, attachments);
    setPromptText("");
    setAttachments([]);
  };

  const [minimized, setMinimized] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialOffsetRef = useRef({ x: 0, y: 0 });
  const snappedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialOffsetRef.current = { ...offset };
    snappedRef.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      let targetX = initialOffsetRef.current.x + dx;
      let targetY = initialOffsetRef.current.y + dy;

      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const barElem = document.getElementById("council-dispatch-bar");
      const actualW = barElem ? barElem.offsetWidth : 680;
      const halfW = actualW / 2;
      const barHeight = minimized ? 32 : 120;
      let didSnap = false;

      // 1. Horizontal Center Snap
      if (Math.abs(targetX) < 32) {
        targetX = 0;
        didSnap = true;
      }

      // 2. Left Screen Edge Snap (14px from left margin)
      const minTargetX = -(winW / 2 - halfW - 14);
      if (Math.abs(targetX - minTargetX) < 32) {
        targetX = minTargetX;
        didSnap = true;
      }

      // 3. Right Screen Edge Snap (14px from right margin)
      const maxTargetX = winW / 2 - halfW - 14;
      if (Math.abs(maxTargetX - targetX) < 32) {
        targetX = maxTargetX;
        didSnap = true;
      }

      // 4. Bottom Screen Edge Snap (Snaps down to resting dock at bottom-3)
      const maxBottomOffset = 0;
      if (Math.abs(targetY - maxBottomOffset) < 32) {
        targetY = maxBottomOffset;
        didSnap = true;
      }

      // 5. Top Screen Edge Snap
      const maxTopOffset = -(winH - 24 - barHeight - 16);
      if (Math.abs(targetY - maxTopOffset) < 32) {
        targetY = maxTopOffset;
        didSnap = true;
      }

      // Hard clamp inside visible viewport so bar NEVER slips out of view in any direction
      targetX = Math.min(Math.max(targetX, minTargetX), maxTargetX);
      targetY = Math.min(Math.max(targetY, maxTopOffset), maxBottomOffset);

      if (didSnap && !snappedRef.current) {
        cyberAudio.playSnap();
        snappedRef.current = true;
      } else if (!didSnap) {
        snappedRef.current = false;
      }

      setOffset({ x: targetX, y: targetY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const openChatHistoryModal = () => {
    cyberAudio.playBlip();
    if (!activeDispatchSummary) {
      setActiveDispatchSummary({
        prompt: "Aktuelle Lage & Task-Status im Headquarter",
        targets: ["Hermes", "Claude", "ChatGPT", "Gemini"],
        responses: [
          {
            agentName: "Hermes",
            color: "#f59e0b",
            text: "Council-Status: Alle 4 Modelle im Headquarter sind aktiv und einsatzbereit. Doppel-Deck Synchronisation läuft stabil.",
          },
          {
            agentName: "Claude",
            color: "#f97316",
            text: "Architekturprüfung: Zero-Latency State Sync und Echtzeit-Sockets aktiv. Codebase im optimalen Zustand.",
          },
          {
            agentName: "ChatGPT",
            color: "#38bdf8",
            text: "Task-Board synchronisiert. Aufgaben im War Room und Entwicklungs-Pods sind zugeteilt.",
          },
          {
            agentName: "Gemini",
            color: "#eab308",
            text: "Multimodale Sensoren online. Orbit-Verbindung und Gravitations-Lift einsatzbereit.",
          },
        ],
      });
    }
    setResponseModalOpen(true);
  };

  const isAllSelected = selectedAgentIds.length === DEFAULT_AGENTS.length;

  return (
    <>
      {/* Central Floating Command / Team Dispatch Bar (Frei verschiebbar über die gesamte Bildschirmbreite) */}
      <div
        id="council-dispatch-bar"
        className="fixed bottom-3 left-1/2 z-30 w-[640px] max-w-[calc(100vw-32px)] flex flex-col gap-1 pointer-events-auto"
        style={{
          transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`,
        }}
      >
        {/* Drag Grip Handle & History / Minimize Toggles */}
        <div className="flex items-center justify-between px-3 select-none">
          <div
            onMouseDown={handleMouseDown}
            className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing text-[10px] font-mono text-cyan-400/80 hover:text-cyan-300"
            title="Gedrückt halten zum Verschieben (CAD Snap)"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>::: Council-Leiste (CAD Docking) :::</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={openChatHistoryModal}
              className="flex items-center gap-1 text-cyan-300 hover:text-white px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/40 text-[10px] font-mono shadow-sm transition hover:border-cyan-300 hover:bg-cyan-900/60"
              title="Chatfenster sofort vergrößern & Verlauf ansehen (ohne etwas schreiben zu müssen)"
            >
              <MessageSquare className="h-3 w-3 text-cyan-400" />
              <span>Verlauf / Chat vergrößern</span>
            </button>
            <button
              type="button"
              onClick={() => setMinimized((prev) => !prev)}
              className="text-cyan-400 hover:text-white px-2 py-0.5 rounded bg-black/60 border border-cyan-500/30 text-[10px] font-mono"
              title={minimized ? "Ausklappen" : "Minimieren"}
            >
              {minimized ? "[ + Ausklappen ]" : "[ _ Minimieren ]"}
            </button>
          </div>
        </div>

        {!minimized ? (
          <>
            {/* 1. Agent Selection & Mentions Pill Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-cyan-500/25 bg-[#050b14]/90 px-2.5 py-1.5 shadow-xl shadow-cyan-950/40 backdrop-blur-md">
          <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-wider flex items-center gap-1 mr-1 shrink-0">
            <Users className="h-3 w-3" />
            Empfänger:
          </span>

          {/* @Alle Toggle */}
          <button
            type="button"
            onClick={selectAll}
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-mono font-semibold transition shrink-0 ${
              isAllSelected
                ? "bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-sm shadow-cyan-500/20"
                : "border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Check className={`h-3 w-3 ${isAllSelected ? "opacity-100" : "opacity-0"}`} />
            @Alle ({DEFAULT_AGENTS.length})
          </button>

          <div className="h-3 w-[1px] bg-slate-800 shrink-0" />

          {/* Individual Agent Toggle Pills */}
          {DEFAULT_AGENTS.map((agent) => {
            const isSelected = selectedAgentIds.includes(agent.id);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggleAgent(agent.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-mono transition shrink-0 ${
                  isSelected
                    ? "bg-white/10 text-white font-bold border"
                    : "border border-transparent text-slate-500 opacity-60 hover:opacity-90"
                }`}
                style={{
                  borderColor: isSelected ? `${agent.color}88` : "transparent",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: agent.color }}
                />
                <span>@{agent.name}</span>
              </button>
            );
          })}
        </div>

        {/* 2. Main Prompt Input Bar */}
        <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/35 bg-[#060e1b]/95 p-2 shadow-2xl shadow-cyan-950/60 backdrop-blur-xl">
          {/* File Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition shrink-0"
            title="Dokument oder Anhang hochladen"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
          />

          {/* Voice-to-Text Button */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition shrink-0 ${
              isRecording
                ? "bg-rose-600 border-rose-400 text-white animate-pulse shadow-lg shadow-rose-900/60"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40"
            }`}
            title={isRecording ? "Aufnahme stoppen" : "Spracheingabe starten (reinsprechen)"}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Prompt Text Input */}
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isRecording
                ? "Sprechen Sie jetzt... (Sprache wird erkannt)"
                : `Nachricht an ${
                    isAllSelected
                      ? "das gesamte Team"
                      : selectedAgentIds.length === 1
                        ? `@${DEFAULT_AGENTS.find((a) => a.id === selectedAgentIds[0])?.name}`
                        : `${selectedAgentIds.length} Agenten`
                  } senden...`
            }
            className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />

          {/* Direct History / Enlarge Button without typing */}
          <button
            type="button"
            onClick={openChatHistoryModal}
            className="flex h-9 items-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-2.5 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/60 hover:text-white transition shrink-0 font-mono text-[11px]"
            title="Chatfenster sofort vergrößern & Verlauf ansehen (ohne tippen zu müssen)"
          >
            <Maximize2 className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Verlauf</span>
          </button>

          {/* Send Action Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!promptText.trim() && attachments.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-900/40 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition shrink-0"
          >
            <span>Senden</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Display attached files if any */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto px-1">
            {attachments.map((file, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 text-[10px] text-cyan-200 font-mono"
              >
                <FileText className="h-3 w-3 text-cyan-400" />
                {file.name}
                <button
                  type="button"
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                  className="hover:text-rose-400 ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
          </>
        ) : null}
      </div>

      {/* High-End Cyber IDE Studio Cockpit & Right Dock Sidebar */}
      <CyberIDEStudioModal
        isOpen={responseModalOpen}
        onClose={() => setResponseModalOpen(false)}
        initialPrompt={activeDispatchSummary?.prompt}
        targetAgentIds={selectedAgentIds}
        initialResponses={activeDispatchSummary?.responses}
      />
    </>
  );
}
