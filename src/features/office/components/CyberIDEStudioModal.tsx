"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Sparkles,
  Bot,
  Code2,
  Terminal,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  PanelRight,
  Layers,
  Send,
  Mic,
  Paperclip,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronRight,
  X,
  Split,
  Cpu,
  FileCode,
  CheckCircle2,
  ArrowRight,
  CornerDownLeft,
} from "lucide-react";
import { cyberAudio } from "@/lib/sound/cyberAudio";

export type WindowLayoutMode = "floating" | "sidebar" | "fullscreen";

export interface AgentChatMessage {
  id: string;
  sender: "user" | "hermes" | "claude" | "chatgpt" | "gemini";
  agentName: string;
  role: string;
  color: string;
  icon: string;
  timestamp: string;
  text: string;
  thinkingTrace?: string;
  codeBlock?: {
    language: string;
    filename: string;
    code: string;
  };
  metrics?: {
    latencyMs: number;
    tokensPerSec: number;
    modelName: string;
  };
}

export interface CyberIDEStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  targetAgentIds?: string[];
  initialResponses?: { agentName: string; color: string; text: string }[];
  onAddTaskToKanban?: (title: string, agent: string) => void;
}

const AGENT_PROFILES: Record<
  string,
  { name: string; role: string; color: string; icon: string; model: string }
> = {
  hermes: {
    name: "Hermes",
    role: "Chief AI Officer // Chairman",
    color: "#f59e0b",
    icon: "👑",
    model: "Hermes 3 (3.1 70B)",
  },
  claude: {
    name: "Claude",
    role: "System Architecture & Review",
    color: "#f97316",
    icon: "✳",
    model: "Claude 3.7 Sonnet (Hybrid)",
  },
  chatgpt: {
    name: "ChatGPT",
    role: "Core Implementation & Logic",
    color: "#2563eb",
    icon: "🌀",
    model: "GPT-4o Omnimodal",
  },
  gemini: {
    name: "Gemini",
    role: "Deep Research & Verification",
    color: "#eab308",
    icon: "✦",
    model: "Gemini 2.5 Pro Ultra",
  },
};

export function CyberIDEStudioModal({
  isOpen,
  onClose,
  initialPrompt = "Projekt-Status analysieren & Architektur optimieren",
  targetAgentIds = ["hermes", "claude", "chatgpt", "gemini"],
  initialResponses,
  onAddTaskToKanban,
}: CyberIDEStudioModalProps) {
  // Window Layout Mode: "floating" (Center Cockpit) vs "sidebar" (Right IDE Dock) vs "fullscreen"
  const [layoutMode, setLayoutMode] = useState<WindowLayoutMode>("floating");

  // Active View Tab: "synthesis" (Hermes Boss Executive), "split" (Claude vs ChatGPT), or single agent tab
  const [activeTab, setActiveTab] = useState<
    "synthesis" | "split" | "hermes" | "claude" | "chatgpt" | "gemini"
  >("synthesis");

  // Chat Input State
  const [inputText, setInputText] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [whatsappMode, setWhatsappMode] = useState(true);
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Record<string, boolean>>({});

  const toggleCodeBlock = (msgId: string) => {
    cyberAudio.playBlip();
    setExpandedCodeBlocks((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Floating window drag state
  const [floatingPos, setFloatingPos] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  // Conversation history
  const [messages, setMessages] = useState<AgentChatMessage[]>(() => {
    const initialUserMsg: AgentChatMessage = {
      id: "usr-1",
      sender: "user",
      agentName: "Du (Benutzer)",
      role: "Commander",
      color: "#38bdf8",
      icon: "👤",
      timestamp: "Jetzt",
      text: initialPrompt,
    };

    const hermesMsg: AgentChatMessage = {
      id: "hermes-1",
      sender: "hermes",
      agentName: "Hermes",
      role: "Chief AI Officer // Chairman",
      color: "#f59e0b",
      icon: "👑",
      timestamp: "Vor wenigen Sekunden",
      text: `Executive Decision: Ich habe die Anforderungen analysiert und delegiert. Claude übernimmt das Architektur-Design und die Typsicherheit, ChatGPT liefert die modulare Implementierung, und Gemini validiert die Latenz- und Edge-Performance. Unser Plan ist validiert und zur Umsetzung freigegeben.`,
      thinkingTrace: `1. Requirement Parsing: Multi-Agent Orchestration\n2. Constraint Analysis: 60 FPS Three.js Render-Loop + Zero-Latency State Sync\n3. Routing Strategy: Parallel Execution -> Weighted Synthesis Gate\n4. Recommendation: Proceed with Modular Event-Driven Pipeline.`,
      metrics: {
        latencyMs: 142,
        tokensPerSec: 118,
        modelName: "Hermes 3 (Boss Synthesis)",
      },
    };

    const claudeMsg: AgentChatMessage = {
      id: "claude-1",
      sender: "claude",
      agentName: "Claude",
      role: "System Architecture & Review",
      color: "#f97316",
      icon: "✳",
      timestamp: "Vor wenigen Sekunden",
      text: `Architektur-Entwurf steht bereit: Ein sauberes, entkoppeltes Event-Mesh mit streng typisierten Payloads. Ich habe ein robusteres DTO-Pattern ausgearbeitet, das unkontrollierte Re-Renders im 3D-Büro vollständig eliminiert.`,
      thinkingTrace: `• Examining memory allocations in WebGL loop\n• Refactoring props to avoid recreation in useFrame\n• Adding Strict Type guards across communication bridge\n• Verifying zero-allocation state buffers`,
      codeBlock: {
        language: "typescript",
        filename: "src/features/office/architecture/councilMesh.ts",
        code: `export interface CouncilDispatchPacket<T = unknown> {\n  readonly traceId: string;\n  readonly initiator: "user" | "hermes";\n  readonly timestamp: number;\n  readonly payload: T;\n  readonly qualityGate: {\n    readonly verifiedBy: readonly string[];\n    readonly status: "pending" | "approved" | "rejected";\n  };\n}\n\nexport const createCouncilDispatch = <T>(\n  payload: T,\n  initiator: "user" | "hermes" = "hermes"\n): CouncilDispatchPacket<T> => ({\n  traceId: crypto.randomUUID(),\n  initiator,\n  timestamp: Date.now(),\n  payload,\n  qualityGate: { verifiedBy: ["Claude", "Hermes"], status: "approved" },\n});`,
      },
      metrics: {
        latencyMs: 198,
        tokensPerSec: 94,
        modelName: "Claude 3.7 Sonnet (Thinking)",
      },
    };

    const chatgptMsg: AgentChatMessage = {
      id: "chatgpt-1",
      sender: "chatgpt",
      agentName: "ChatGPT",
      role: "Core Implementation & Logic",
      color: "#2563eb",
      icon: "🌀",
      timestamp: "Vor wenigen Sekunden",
      text: `Implementierungs-Modul ist fertiggestellt und einsatzbereit. Die Handler wurden direkt an das Event-System angebunden, inklusive optimiertem Fallback für Verbindungsabbrüche und sanftem Feedback-Audio.`,
      thinkingTrace: `• Mapping UI actions to WebSocket dispatch\n• Adding optimistic UI updates for instant feedback\n• Binding keyboard shortcuts (Cmd/Ctrl+Enter) to trigger flow`,
      codeBlock: {
        language: "typescript",
        filename: "src/features/office/hooks/useCouncilDispatch.ts",
        code: `export function useCouncilDispatch() {\n  const [isProcessing, setIsProcessing] = useState(false);\n\n  const dispatchToFleet = useCallback(async (prompt: string) => {\n    setIsProcessing(true);\n    try {\n      const packet = createCouncilDispatch({ prompt });\n      await gatewayClient.broadcast(packet);\n      cyberAudio.playChime();\n    } finally {\n      setIsProcessing(false);\n    }\n  }, []);\n\n  return { dispatchToFleet, isProcessing };\n}`,
      },
      metrics: {
        latencyMs: 175,
        tokensPerSec: 106,
        modelName: "GPT-4o",
      },
    };

    const geminiMsg: AgentChatMessage = {
      id: "gemini-1",
      sender: "gemini",
      agentName: "Gemini",
      role: "Deep Research & Verification",
      color: "#eab308",
      icon: "✦",
      timestamp: "Vor wenigen Sekunden",
      text: `Verifikation abgeschlossen: Das Token-Budget und die Multi-Modal-Latenzen liegen im optimalen Bereich. Die Übertragungszeiten zwischen den Modellen bleiben konstant unter 190ms bei 99,8% Stabilität.`,
      thinkingTrace: `• Benchmarking 1M token context retention\n• Cross-referencing latency across European Edge Nodes\n• Validating memory consumption curves against 60 FPS budget`,
      metrics: {
        latencyMs: 160,
        tokensPerSec: 135,
        modelName: "Gemini 2.5 Pro",
      },
    };

    return [initialUserMsg, hermesMsg, claudeMsg, chatgptMsg, geminiMsg];
  });

  // Speech Recognition (Dictation)
  const recognitionRef = useRef<any>(null);
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
          let text = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          if (text) setInputText((prev) => (prev ? `${prev} ${text}` : text));
        };
        recognition.onend = () => setIsDictating(false);
        recognition.onerror = () => setIsDictating(false);
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleDictation = () => {
    if (!recognitionRef.current) return;
    if (isDictating) {
      recognitionRef.current.stop();
      setIsDictating(false);
      cyberAudio.playBlip();
    } else {
      recognitionRef.current.start();
      setIsDictating(true);
      cyberAudio.playChime();
    }
  };

  // Text-To-Speech
  const toggleSpeech = (msgId: string, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      cyberAudio.playBlip();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = 1.05;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
    cyberAudio.playChime();
  };

  // Copy Code Snippet
  const handleCopyCode = (snippetId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetId(snippetId);
    cyberAudio.playChime();
    setTimeout(() => setCopiedSnippetId(null), 2500);
  };

  // Toggle Thinking Drawer
  const toggleThinking = (msgId: string) => {
    cyberAudio.playBlip();
    setExpandedThinking((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Send Message / Follow-up
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    cyberAudio.playChime();

    const userText = inputText.trim();
    setInputText("");

    const newUsrMsg: AgentChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      agentName: "Du (Benutzer)",
      role: "Commander",
      color: "#38bdf8",
      icon: "👤",
      timestamp: "Gerade eben",
      text: userText,
    };

    setMessages((prev) => [...prev, newUsrMsg]);

    const isGreeting = /^(hello|hi|hey|hallo|moin|servus|guten|wer bist du)/i.test(
      userText.toLowerCase()
    );

    if (isGreeting) {
      setTimeout(() => {
        cyberAudio.playWhoosh();
        const newHermesReply: AgentChatMessage = {
          id: `hermes-${Date.now()}`,
          sender: "hermes",
          agentName: "Hermes",
          role: "Chief AI Officer // Chairman",
          color: "#f59e0b",
          icon: "👑",
          timestamp: "Gerade eben",
          text: `Hi! Willkommen in der Runde. Unser Team (Claude, ChatGPT, Gemini & ich) ist online und einsatzbereit. Was steht heute als Nächstes an?`,
          metrics: { latencyMs: 95, tokensPerSec: 130, modelName: "Hermes 3" },
        };
        const newClaudeReply: AgentChatMessage = {
          id: `claude-${Date.now() + 1}`,
          sender: "claude",
          agentName: "Claude",
          role: "System Architecture & Review",
          color: "#f97316",
          icon: "✳",
          timestamp: "Gerade eben",
          text: `Moin! Die Architektur-Pipelines und das Büro laufen einwandfrei. Sag einfach Bescheid, wenn du ein Konzept oder Code brauchst!`,
          metrics: { latencyMs: 140, tokensPerSec: 110, modelName: "Claude 3.7" },
        };
        setMessages((prev) => [...prev, newHermesReply, newClaudeReply]);
      }, 450);
    } else {
      // 1. Turn: Hermes introduces and directs the team
      setTimeout(() => {
        cyberAudio.playWhoosh();
        const newHermesReply: AgentChatMessage = {
          id: `hermes-${Date.now()}`,
          sender: "hermes",
          agentName: "Hermes",
          role: "Chief AI Officer // Chairman",
          color: "#f59e0b",
          icon: "👑",
          timestamp: "Gerade eben",
          text: `Verstanden. Die Direktive zu "${userText}" wurde im Council platziert. @Claude, gib uns deine Architektur-Einschätzung dazu. @ChatGPT, bereite die Implementierung vor.`,
          metrics: { latencyMs: 110, tokensPerSec: 124, modelName: "Hermes 3" },
        };
        setMessages((prev) => [...prev, newHermesReply]);
      }, 350);

      // 2. Turn: Claude responds to Hermes and addresses ChatGPT directly!
      setTimeout(() => {
        cyberAudio.playWhoosh();
        const newClaudeReply: AgentChatMessage = {
          id: `claude-${Date.now()}`,
          sender: "claude",
          agentName: "Claude",
          role: "System Architecture & Review",
          color: "#f97316",
          icon: "✳",
          timestamp: "Gerade eben",
          text: `@Hermes: Aus architektonischer Sicht sollten wir das modular aufbauen. Eine saubere Entkopplung stellt sicher, dass wir keine unnötigen Re-Renders in der 3D-Szene erzeugen.\n\n@ChatGPT: Was hältst du von einem dedizierten Hook für das Event-Dispatching? Wie würdest du die Typen dafür strukturieren?`,
          thinkingTrace: `1. Evaluating system boundaries for "${userText}"\n2. Identifying cross-module dependencies between UI and 3D engine\n3. Formulating technical query for ChatGPT implementation review`,
          metrics: { latencyMs: 145, tokensPerSec: 112, modelName: "Claude 3.7" },
        };
        setMessages((prev) => [...prev, newClaudeReply]);
      }, 950);

      // 3. Turn: ChatGPT directly answers Claude with code & tags Gemini!
      setTimeout(() => {
        cyberAudio.playWhoosh();
        const newChatGPTReply: AgentChatMessage = {
          id: `chatgpt-${Date.now()}`,
          sender: "chatgpt",
          agentName: "ChatGPT",
          role: "Implementation & Logic",
          color: "#38bdf8",
          icon: "🌀",
          timestamp: "Gerade eben",
          text: `@Claude: Absolut einverstanden! Der dedizierte Hook verhindert Event-Loop Spikes. Ich habe die TypeScript-Definitionen und den State-Handler dafür vorbereitet:\n\n@Gemini: Kannst du kurz die Latenz- und Memory-Kennzahlen für diesen Ansatz gegenprüfen?`,
          codeBlock: {
            language: "typescript",
            filename: "directive_pipeline.ts",
            code: `// Multi-Agent Pipeline Response to: ${userText}\nexport interface DirectiveHandlerProps {\n  source: "claude" | "chatgpt" | "gemini";\n  action: string;\n  timestamp: number;\n}\n\nexport function executeCouncilDirective(payload: DirectiveHandlerProps) {\n  // Zero-latency cross-talk execution\n  return { success: true, latencyMs: 18, activeAgents: 4 };\n}`,
          },
          metrics: { latencyMs: 120, tokensPerSec: 138, modelName: "GPT-4o" },
        };
        setMessages((prev) => [...prev, newChatGPTReply]);
      }, 1650);

      // 4. Turn: Gemini confirms verification and bench test!
      setTimeout(() => {
        cyberAudio.playWhoosh();
        const newGeminiReply: AgentChatMessage = {
          id: `gemini-${Date.now()}`,
          sender: "gemini",
          agentName: "Gemini",
          role: "Deep Research & Verification",
          color: "#eab308",
          icon: "✦",
          timestamp: "Gerade eben",
          text: `@ChatGPT @Claude: Verifikation abgeschlossen: Der Speicherverbrauch bleibt flach, keine Memory Leaks im Three.js Render-Zyklus (60 FPS stabil). Die vorgeschlagene Architektur ist freigegeben!`,
          metrics: { latencyMs: 155, tokensPerSec: 142, modelName: "Gemini 2.5 Pro" },
        };
        setMessages((prev) => [...prev, newGeminiReply]);
      }, 2350);
    }
  };

  // Draggable logic for Floating Mode
  const handleMouseDown = (e: React.MouseEvent) => {
    if (layoutMode !== "floating") return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...floatingPos };

    const handleMouseMove = (me: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = me.clientX - dragStartRef.current.x;
      const dy = me.clientY - dragStartRef.current.y;
      setFloatingPos({
        x: initialPosRef.current.x + dx,
        y: initialPosRef.current.y + dy,
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Filter messages based on active tab
  const displayedMessages = useMemo(() => {
    if (activeTab === "synthesis") {
      return messages; // Show the full conversation thread
    }
    if (activeTab === "split") {
      return messages.filter(
        (m) => m.sender === "user" || m.sender === "claude" || m.sender === "chatgpt"
      );
    }
    return messages.filter(
      (m) => m.sender === "user" || m.sender === activeTab
    );
  }, [activeTab, messages]);

  if (!isOpen) return null;

  // Render container styles based on layout mode:
  // - "floating": Center Studio Cockpit Modal (Draggable, resizable look)
  // - "sidebar": Right IDE Dock Sidebar (like Cursor / Codex)
  // - "fullscreen": Full viewport command station
  const containerClasses =
    layoutMode === "sidebar"
      ? "fixed top-0 right-0 bottom-0 z-50 w-[620px] max-w-[95vw] border-l border-cyan-500/30 bg-[#050a14]/98 shadow-2xl shadow-cyan-950/80 backdrop-blur-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right"
      : layoutMode === "fullscreen"
      ? "fixed inset-0 z-50 bg-[#050a14]/98 flex flex-col animate-in zoom-in-95 duration-200"
      : "relative w-[860px] max-w-[95vw] h-[82vh] max-h-[900px] rounded-2xl border border-cyan-500/40 bg-[#050a14]/98 shadow-[0_0_80px_rgba(0,240,255,0.18)] backdrop-blur-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200";

  return (
    <div
      className={
        layoutMode === "sidebar"
          ? "pointer-events-none fixed inset-0 z-50 overflow-hidden"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      }
    >
      <div
        className={`pointer-events-auto ${containerClasses}`}
        style={
          layoutMode === "floating"
            ? {
                transform: `translate(${floatingPos.x}px, ${floatingPos.y}px)`,
              }
            : undefined
        }
      >
        {/* ================= HEADER BAR ================= */}
        <div
          onMouseDown={handleMouseDown}
          className={`flex items-center justify-between border-b border-cyan-500/20 px-4 py-2.5 bg-[#081224]/90 select-none ${
            layoutMode === "floating" ? "cursor-grab active:cursor-grabbing" : ""
          }`}
        >
          {/* Title & Status */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 shadow-sm shadow-cyan-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-white">
                  HERMES CYBER STUDIO // IDE COCKPIT
                </h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-[9px] font-mono text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE MESH
                </span>
              </div>
              <p className="text-[10px] text-cyan-200/60 font-mono">
                Autonomes 4-Modell Multi-Agenten Cockpit
              </p>
            </div>
          </div>

          {/* Window Mode Controls & Close */}
          <div className="flex items-center gap-1.5">
            {/* Toggle: Center Studio Cockpit */}
            <button
              type="button"
              onClick={() => {
                cyberAudio.playBlip();
                setLayoutMode("floating");
              }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono transition ${
                layoutMode === "floating"
                  ? "bg-cyan-500/25 text-cyan-200 border border-cyan-400/40"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              title="Studio-Cockpit zentriert schweben lassen"
            >
              <Minimize2 className="h-3 w-3" />
              <span className="hidden sm:inline">Cockpit</span>
            </button>

            {/* Toggle: WhatsApp / Lese-Chat Modus (Code standardmäßig minimiert) */}
            <button
              type="button"
              onClick={() => {
                cyberAudio.playBlip();
                setWhatsappMode((prev) => !prev);
              }}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-mono border transition ${
                whatsappMode
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 font-semibold"
                  : "bg-slate-800/40 text-slate-400 border-slate-700 hover:text-white"
              }`}
              title="Schaltet zwischen WhatsApp-Gruppenchat (Code einklappbar) und Entwickler-Ansicht um"
            >
              <span>💬</span>
              <span>{whatsappMode ? "WhatsApp-Modus" : "Code-Ansicht"}</span>
            </button>

            {/* Toggle: Right IDE Dock Sidebar (like Cursor / Codex) */}
            <button
              type="button"
              onClick={() => {
                cyberAudio.playBlip();
                setLayoutMode("sidebar");
              }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono transition ${
                layoutMode === "sidebar"
                  ? "bg-cyan-500/25 text-cyan-200 border border-cyan-400/40"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              title="Rechts als IDE-Sidebar andocken (wie Cursor / Codex)"
            >
              <PanelRight className="h-3 w-3" />
              <span className="hidden sm:inline">IDE-Dock</span>
            </button>

            {/* Toggle: Fullscreen */}
            <button
              type="button"
              onClick={() => {
                cyberAudio.playBlip();
                setLayoutMode((prev) => (prev === "fullscreen" ? "floating" : "fullscreen"));
              }}
              className={`p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition`}
              title="Vollbild umschalten"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                cyberAudio.playBlip();
                if (typeof window !== "undefined" && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                onClose();
              }}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition ml-1"
              title="Studio schließen (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ================= SUB-NAVIGATION / MODEL TABS ================= */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-cyan-500/15 bg-[#060c18] overflow-x-auto text-[11px] font-mono shrink-0">
          <span className="text-[10px] text-cyan-400/70 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
            <Layers className="h-3 w-3" />
            Ansicht:
          </span>

          {/* Tab: Synthesis */}
          <button
            type="button"
            onClick={() => {
              cyberAudio.playBlip();
              setActiveTab("synthesis");
            }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition shrink-0 ${
              activeTab === "synthesis"
                ? "bg-amber-500/20 text-amber-200 border border-amber-400/40 shadow-sm shadow-amber-500/20 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <span>👑</span>
            <span>Council-Synthese</span>
          </button>

          {/* Tab: Split-View (Claude vs ChatGPT) */}
          <button
            type="button"
            onClick={() => {
              cyberAudio.playBlip();
              setActiveTab("split");
            }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition shrink-0 ${
              activeTab === "split"
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-sm shadow-cyan-500/20 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Split className="h-3 w-3 text-cyan-400" />
            <span>Split-Vergleich</span>
          </button>

          <div className="h-3 w-[1px] bg-slate-800 mx-1 shrink-0" />

          {/* Individual Model Tabs */}
          {(["hermes", "claude", "chatgpt", "gemini"] as const).map((agentKey) => {
            const profile = AGENT_PROFILES[agentKey];
            const isCur = activeTab === agentKey;
            return (
              <button
                key={agentKey}
                type="button"
                onClick={() => {
                  cyberAudio.playBlip();
                  setActiveTab(agentKey);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition shrink-0 ${
                  isCur
                    ? "border font-bold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
                style={
                  isCur
                    ? {
                        backgroundColor: `${profile.color}25`,
                        borderColor: `${profile.color}60`,
                        color: "#ffffff",
                      }
                    : undefined
                }
              >
                <span>{profile.icon}</span>
                <span>{profile.name}</span>
              </button>
            );
          })}
        </div>

        {/* ================= CHAT STREAM & CODE VIEW ================= */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
          {displayedMessages.map((msg) => {
            const isUser = msg.sender === "user";
            const profile = !isUser ? AGENT_PROFILES[msg.sender] : null;
            const isThinkingOpen = Boolean(expandedThinking[msg.id]);

            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-2 rounded-xl p-3.5 border transition-all ${
                  isUser
                    ? "bg-[#0b162c]/80 border-cyan-500/30 text-cyan-100 ml-6"
                    : "bg-[#070e1c]/85 border-slate-800 text-slate-200"
                }`}
                style={
                  !isUser && profile
                    ? {
                        borderLeft: `3px solid ${profile.color}`,
                      }
                    : undefined
                }
              >
                {/* Message Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{msg.icon}</span>
                    <span className="font-mono font-bold text-white text-xs">
                      {msg.agentName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {msg.role}
                    </span>
                    {msg.metrics && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300/80 border border-cyan-500/20">
                        <Cpu className="h-2.5 w-2.5" />
                        {msg.metrics.modelName} • {msg.metrics.latencyMs}ms •{" "}
                        {msg.metrics.tokensPerSec} t/s
                      </span>
                    )}
                  </div>

                  {/* Actions: TTS Playback */}
                  {!isUser && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleSpeech(msg.id, msg.text)}
                        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono transition ${
                          speakingMessageId === msg.id
                            ? "bg-amber-500/30 text-amber-200 border border-amber-400/50 animate-pulse"
                            : "text-slate-400 hover:text-cyan-300 hover:bg-white/5"
                        }`}
                        title="Antwort vorlesen"
                      >
                        {speakingMessageId === msg.id ? (
                          <VolumeX className="h-3 w-3 text-amber-300" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                        <span>{speakingMessageId === msg.id ? "Stopp" : "Vorlesen"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Optional Expandable Thinking Trace (Claude 3.7 / DeepSeek Style) */}
                {msg.thinkingTrace && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleThinking(msg.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-mono text-amber-300/90 hover:bg-amber-500/10 transition"
                    >
                      <span className="flex items-center gap-1.5">
                        <BrainIcon className="h-3 w-3 text-amber-400" />
                        Thinking Process ({msg.metrics?.latencyMs ?? 140}ms)
                      </span>
                      {isThinkingOpen ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                    {isThinkingOpen && (
                      <div className="p-2.5 text-[11px] font-mono text-amber-200/80 leading-relaxed border-t border-amber-500/20 bg-black/40 whitespace-pre-line">
                        {msg.thinkingTrace}
                      </div>
                    )}
                  </div>
                )}

                {/* Main Message Text */}
                <p className="text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {msg.text}
                </p>

                {/* Code Block Viewer with Syntax Highlighting Look & Collapsible / WhatsApp Mode */}
                {msg.codeBlock && (
                  <div className="mt-2 rounded-xl border border-cyan-500/25 bg-[#030814] overflow-hidden shadow-lg">
                    {/* Collapsible Header Bar */}
                    <button
                      type="button"
                      onClick={() => toggleCodeBlock(msg.id)}
                      className="w-full flex items-center justify-between border-b border-slate-800/80 bg-[#071122] px-3.5 py-2 text-[11px] font-mono text-slate-300 hover:bg-[#0c1c36] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <FileCode className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="font-semibold text-cyan-200">
                          {msg.codeBlock.filename}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({msg.codeBlock.language} • {msg.codeBlock.code.split("\n").length} Zeilen)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-cyan-300 font-sans font-medium">
                        <span>
                          {Boolean(expandedCodeBlocks[msg.id]) || !whatsappMode
                            ? "Code minimieren ▲"
                            : "Code anzeigen ▼"}
                        </span>
                      </div>
                    </button>

                    {/* Code Content & Actions (only when expanded or in full code mode) */}
                    {(Boolean(expandedCodeBlocks[msg.id]) || !whatsappMode) && (
                      <div className="bg-[#02060e]">
                        <div className="flex items-center justify-end gap-2 border-b border-slate-800/60 bg-[#050e1c] px-3 py-1 text-[10px] font-mono">
                          {onAddTaskToKanban && (
                            <button
                              type="button"
                              onClick={() => {
                                cyberAudio.playChime();
                                onAddTaskToKanban(
                                  `Code: ${msg.codeBlock?.filename ?? "Modul"}`,
                                  msg.agentName
                                );
                              }}
                              className="flex items-center gap-1 rounded bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 text-[9px] text-cyan-300 hover:border-cyan-400 hover:text-white transition"
                              title="Als Kanban-Task übernehmen"
                            >
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                              <span>Ins Kanban</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyCode(
                                `${msg.id}-code`,
                                msg.codeBlock?.code ?? ""
                              )
                            }
                            className="flex items-center gap-1 rounded bg-black/60 border border-slate-700 px-2 py-0.5 text-[9px] text-slate-300 hover:text-white hover:border-slate-500 transition"
                          >
                            {copiedSnippetId === `${msg.id}-code` ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-300">Kopiert!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Kopieren</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-3 text-[11px] font-mono leading-5 text-emerald-300/90 overflow-x-auto selection:bg-cyan-500/30 max-h-[380px]">
                          <code>{msg.codeBlock.code}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ================= QUICK-ACTION PILLS ================= */}
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#060c18] border-t border-cyan-500/15 overflow-x-auto text-[10px] font-mono shrink-0">
          <span className="text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Quick-Aktionen:
          </span>
          {[
            { label: "🔄 Team-Debatte: Claude vs. GPT", prompt: "Claude und ChatGPT: Diskutiert eure architektonischen Lösungsansätze direkt untereinander aus!" },
            { label: "⚡ Code implementieren", prompt: "Schreibe die vollständige Implementierung dafür mit Typen." },
            { label: "🔍 Architektur prüfen", prompt: "Prüfe die Architektur auf Flaschenhälse und Edge-Cases." },
            { label: "📋 Im Kanban erfassen", prompt: "Erstelle die Teilaufgaben strukturiert für das Kanban-Board." },
            { label: "👑 Hermes Freigabe", prompt: "Hermes, bitte um finale Entscheidung und Synthese." },
          ].map((action, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                cyberAudio.playBlip();
                setInputText(action.prompt);
              }}
              className="rounded-lg border border-cyan-500/20 bg-cyan-950/30 px-2 py-1 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-950/70 hover:text-white transition shrink-0"
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* ================= INPUT FOOTER BAR ================= */}
        <div className="p-3 border-t border-cyan-500/20 bg-[#081224] shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-[#040812] px-3 py-2 shadow-inner focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/40 transition">
            {/* Dictation Button */}
            <button
              type="button"
              onClick={toggleDictation}
              className={`p-1.5 rounded-lg transition ${
                isDictating
                  ? "bg-rose-500/30 text-rose-300 animate-pulse"
                  : "text-slate-400 hover:text-cyan-300 hover:bg-white/5"
              }`}
              title="Spracheingabe starten"
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Input field */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Antwort an das Council senden oder @Claude, @ChatGPT fragen..."
              className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 outline-none font-sans"
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 transition"
            >
              <span>Senden</span>
              <CornerDownLeft className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.002 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}
