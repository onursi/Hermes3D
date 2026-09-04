"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { X, Search, FileText, ExternalLink, Network, CornerDownLeft, Sparkles, Play, Square, Unlink, Volume2, VolumeX, Sliders, Waves, Radio, Music } from "lucide-react";
import { Obsidian3DGraphCore, AREAL_COLORS, GraphNode, ObsidianGraphData } from "./Obsidian3DGraphCore";
import { cyberAudio } from "@/lib/sound/cyberAudio";
import { JarvisPanel } from "./JarvisPanel";

/**
 * The areas of the vault, in the order their pills appear and their number
 * keys fire. Kept at module scope so the keyboard shortcuts and the pill row
 * cannot drift apart.
 */
const AREA_FILTERS = [
  { id: "all", label: "Alle Neuronen", color: "#38bdf8" },
  { id: "projects", label: "Projekte", color: "#f59e0b" },
  { id: "knowledge", label: "Wissen", color: "#ec4899" },
  { id: "system", label: "System", color: "#38bdf8" },
  { id: "identity", label: "Identität", color: "#34d399" },
  { id: "sources", label: "Quellen", color: "#06b6d4" },
  { id: "ideas", label: "Ideen", color: "#e879f9" },
  { id: "interests", label: "Interessen", color: "#fbbf24" },
  { id: "core", label: "Core", color: "#ffffff" },
];

export function ObsidianGraphModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<ObsidianGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [flyToNode, setFlyToNode] = useState<GraphNode | null>(null);
  const [flyToLobe, setFlyToLobe] = useState<string | null>(null);
  /** The hub list covers a corner of the brain, so it has to be foldable. */
  const [hubsCollapsed, setHubsCollapsed] = useState(false);
  /**
   * The guided flight through the vault.
   *
   * It looks like decoration and is not. Thirty seconds of watching the areas
   * go past tells you the shape of what you know — which regions are dense,
   * which are a handful of lonely dots, which ones you have not touched. That
   * is a stock-take nobody ever sits down to do deliberately.
   *
   * -1 means the tour is not running.
   */
  const [tourIndex, setTourIndex] = useState(-1);
  /** Loose ends: the notes nothing links to. */
  const [showOrphans, setShowOrphans] = useState(false);
  /** Jarvis: die Frage-an-den-Vault-Ansicht. */
  const [jarvisOpen, setJarvisOpen] = useState(false);
  const tourRunning = tourIndex >= 0;
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(60);
  const [soundMode, setSoundModeState] = useState<"alpha" | "cosmos" | "matrix" | "zen">("alpha");
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** OrbitControls, handed to the graph so a camera fly can borrow the camera. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphControlsRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || tourIndex < 0) return;
    // Skips "all" — the tour is about the areas, and the overview is where
    // it lands at the end anyway.
    const stops = AREA_FILTERS.filter((area) => area.id !== "all");
    const stop = stops[tourIndex % stops.length];
    if (!stop) return;
    setActiveFilter(stop.id);
    setFlyToLobe(stop.id);
    cyberAudio.playSynapseBlip();
    const timer = window.setTimeout(() => {
      if (tourIndex + 1 >= stops.length) {
        // Home again: the whole brain, unfiltered.
        setTourIndex(-1);
        setActiveFilter("all");
        setFlyToLobe("all");
        return;
      }
      setTourIndex((prev) => (prev < 0 ? prev : prev + 1));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [isOpen, tourIndex]);

  useEffect(() => {
    fetch("/api/obsidian-graph")
      .then((res) => res.json())
      .then((d) => {
        if (d && d.nodes && d.nodes.length > 0) setData(d);
      })
      .catch((err) => console.error("Failed to preload obsidian graph:", err));
  }, []);

  // Binaural Neural Ambience Sound Lifecycle
  useEffect(() => {
    if (isOpen && !isMuted) {
      cyberAudio.resume();
      cyberAudio.startNeuralAmbience();
    } else {
      cyberAudio.stopNeuralAmbience();
    }
    return () => {
      cyberAudio.stopNeuralAmbience();
    };
  }, [isOpen, isMuted]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          searchInputRef.current?.focus();
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
      if (e.code === "Space" && isOpen && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        cyberAudio.resume();
        cyberAudio.playElectricalZap();
        setFlyToLobe((prev) => (prev === "projects" ? "knowledge" : "projects"));
      }
      // The search field used to take focus the moment the window opened, so
      // every shortcut below was typed into it instead: space became a space
      // character, digits became digits, and none of this worked at all unless
      // you happened to click the scene first. It no longer autofocuses, and a
      // letter hands focus over instead — which is what "type to search"
      // promised in the first place.
      if (
        isOpen &&
        document.activeElement !== searchInputRef.current &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        /^[a-zA-ZäöüÄÖÜß]$/.test(e.key)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchQuery((prev) => prev + e.key);
        return;
      }
      // Space only ever toggled between two halves of the brain, which leaves
      // seven of the nine areas unreachable without hunting for their pill.
      // The digits fly straight to any of them, in the order the pills sit.
      if (isOpen && document.activeElement !== searchInputRef.current && /^[1-9]$/.test(e.key)) {
        const area = AREA_FILTERS[Number(e.key) - 1];
        if (area) {
          e.preventDefault();
          cyberAudio.resume();
          cyberAudio.playSynapseBlip();
          setActiveFilter(area.id);
          setFlyToLobe(area.id);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [isOpen, onClose]);

  /**
   * Connection count per note, and the busiest dozen.
   *
   * A graph that shows dots and lines but never says which note is central
   * leaves you to guess by squinting at line density. These are the vault's
   * actual hubs, and clicking one flies to it and lights up everything it is
   * wired to — the question "how is Religion & Glaube connected?" answered by
   * looking rather than by reading.
   */
  const { degreeById, topHubs, orphanCount } = useMemo(() => {
    const degree = new Map<string, number>();
    (data?.links ?? []).forEach((link) => {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    });
    const hubs = [...(data?.nodes ?? [])]
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
      .slice(0, 10);
    // Counted here rather than in the scene, so the button can say how many
    // loose ends there are before you decide whether to go looking.
    const orphans = (data?.nodes ?? []).filter((node) => !degree.get(node.id)).length;
    return { degreeById: degree, topHubs: hubs, orphanCount: orphans };
  }, [data]);

  const searchResults = useMemo(() => {
    if (!data || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return data.nodes
      .filter((n) => n.name.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q) || n.excerpt.toLowerCase().includes(q))
      .slice(0, 7);
  }, [data, searchQuery]);

  useEffect(() => {
    setActiveResultIndex(0);
  }, [searchQuery]);

  const handleSelectAndFly = (node: GraphNode) => {
    cyberAudio.playElectricalZap();
    setSelectedNode(node);
    setFlyToNode(node);
    setSearchQuery("");
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveResultIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveResultIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = searchResults[activeResultIndex] || searchResults[0];
      if (target) {
        handleSelectAndFly(target);
      }
    }
  };

  if (!isOpen) return null;

  const filters = AREA_FILTERS;

  /**
   * Fly the brain to a note Jarvis cited.
   *
   * Both halves identify a note by its path inside the vault, so an answer's
   * source needs no translation to become a node — which is the only reason
   * this is three lines instead of a lookup table.
   */
  const handleFlyToSource = (sourceId: string) => {
    const node = data?.nodes.find((candidate) => candidate.id === sourceId);
    if (!node) return;
    cyberAudio.resume();
    cyberAudio.playSynapseBlip();
    setSelectedNode(node);
    setFlyToNode(node);
  };

  const handleFilterClick = (filterId: string) => {
    // Touching anything ends the tour: it is a presentation, not a mode you
    // have to fight your way out of.
    setTourIndex(-1);
    cyberAudio.resume();
    cyberAudio.playSynapseBlip();
    setActiveFilter(filterId);
    setFlyToLobe(filterId);
  };

  return (
    <div
      onClick={() => {
        cyberAudio.resume();
        if (!isMuted) cyberAudio.startNeuralAmbience();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
    >
      
      {/* 3D Neural Canvas */}
      <div className="absolute inset-0">
        {data && data.nodes.length > 0 ? (
          <Canvas
            camera={{ position: [0, 5, 22], fov: 48, near: 0.1, far: 500 }}
            dpr={[1, 2]}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          >
            <color attach="background" args={["#020409"]} />
            <ambientLight intensity={0.45} />
            <pointLight position={[12, 16, 12]} intensity={1.4} color="#ffffff" />
            <pointLight position={[-12, -8, -12]} intensity={0.8} color="#38bdf8" />
            <pointLight position={[0, -10, 0]} intensity={0.5} color="#ec4899" />

            <Obsidian3DGraphCore
              data={data}
              selectedNodeId={selectedNode?.id}
              onSelectNode={handleSelectAndFly}
              searchQuery=""
              activeFilter={activeFilter}
              flyToNode={flyToNode}
              flyToLobe={flyToLobe}
              showOrphans={showOrphans}
              controlsRef={graphControlsRef}
            />

            <OrbitControls
              ref={graphControlsRef}
              enableDamping
              dampingFactor={0.05}
              rotateSpeed={1.8}
              zoomSpeed={8.0}
              minDistance={0.2}
              maxDistance={70}
            />
          </Canvas>
        ) : loading ? (
          <div className="flex h-full w-full items-center justify-center font-mono text-cyan-400">
            <div className="flex flex-col items-center gap-3">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              <span className="text-sm">Initialisiere LifeOS 3D Neural Graph...</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Top Header Controls */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-[#070e1c]/92 px-4 py-2 shadow-2xl backdrop-blur-md">
          <Network className="h-5 w-5 text-cyan-400 animate-pulse" />
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold text-white tracking-wider flex items-center gap-2">
              LIFE OS • CEREBRAL NEURAL KNOWLEDGE GRAPH
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] text-cyan-300 font-mono">
                {data ? `${data.totalNotes} Neuronen • ${data.totalLinks} Synapsen` : "Lädt..."}
              </span>
            </span>
            <span className="text-[9px] text-slate-400 font-mono">
              Linke Hemisphäre: Projekte & System · Rechte Hemisphäre: Wissen & Identität
            </span>
          </div>
        </div>

        {/* Actions: Sound Settings & Close */}
        <div className="pointer-events-auto relative flex items-center gap-2">
          {/* Sound Menu Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cyberAudio.resume();
              setShowSoundMenu((prev) => !prev);
            }}
            className={`flex h-9 items-center gap-2 rounded-xl border px-3 font-mono text-xs transition shadow-xl backdrop-blur-md cursor-pointer ${
              !isMuted
                ? "border-cyan-500/50 bg-[#070e1c]/95 text-cyan-300 shadow-cyan-500/20 hover:border-cyan-400"
                : "border-slate-700 bg-[#070e1c]/90 text-slate-500 hover:text-slate-300"
            }`}
            title="Klang-Einstellungen & Lautstärke"
          >
            {!isMuted ? <Volume2 size={15} className="text-cyan-400 animate-pulse" /> : <VolumeX size={15} />}
            <span className="text-[10px] font-bold uppercase">
              {!isMuted ? `${volume}% • ${soundMode}` : "MUTED"}
            </span>
            <Sliders size={12} className="text-slate-400" />
          </button>

          {/* Floating Sound Control Drawer */}
          {showSoundMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-11 right-11 w-72 rounded-2xl border border-cyan-500/40 bg-[#050b16]/98 p-4 font-mono shadow-2xl shadow-cyan-950/80 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 z-50 flex flex-col gap-3.5"
            >
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Music size={13} className="text-cyan-400" />
                  GEHIRN-AUDIO KONTROLLE
                </span>
                <button
                  type="button"
                  onClick={() => setShowSoundMenu(false)}
                  className="text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Lautstärke:</span>
                  <span className="font-bold text-cyan-300">{volume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setVolumeState(val);
                    cyberAudio.resume();
                    cyberAudio.setVolume(val / 100);
                    if (val === 0 && !isMuted) setIsMuted(true);
                    else if (val > 0 && isMuted) setIsMuted(false);
                  }}
                  className="h-1.5 w-full appearance-none rounded-lg bg-slate-800 accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Sound Mode Selection */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400">Klang-Atmosphäre:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "alpha", label: "🌌 Alpha", desc: "108 Hz Fokus" },
                    { id: "cosmos", label: "🌊 Cosmos", desc: "Tiefsee-Bass" },
                    { id: "matrix", label: "⚡ Matrix", desc: "Cyber-Takt" },
                    { id: "zen", label: "🍃 Zen", desc: "528 Hz Harmonie" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        const nextMode = m.id as "alpha" | "cosmos" | "matrix" | "zen";
                        setSoundModeState(nextMode);
                        cyberAudio.resume();
                        cyberAudio.setSoundMode(nextMode);
                        cyberAudio.playSynapseBlip();
                      }}
                      className={`flex flex-col items-start rounded-xl p-2 text-left border transition cursor-pointer ${
                        soundMode === m.id
                          ? "border-cyan-400 bg-cyan-500/20 text-white shadow-md shadow-cyan-500/20"
                          : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <span className="text-[10px] font-bold">{m.label}</span>
                      <span className="text-[8px] text-slate-500">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mute Toggle inside drawer */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-[10px] text-slate-400">Stummschalten:</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsMuted((prev) => {
                      const next = !prev;
                      if (!next) {
                        cyberAudio.startNeuralAmbience(soundMode);
                        cyberAudio.playSynapseBlip();
                      } else {
                        cyberAudio.stopNeuralAmbience();
                      }
                      return next;
                    });
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold border transition cursor-pointer ${
                    isMuted
                      ? "bg-rose-950/60 text-rose-300 border-rose-500/40"
                      : "bg-cyan-950/60 text-cyan-300 border-cyan-500/40"
                  }`}
                >
                  {isMuted ? "🔇 STUMM" : "🔊 AKTIV"}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-[#070e1c]/90 text-slate-400 hover:border-cyan-400 hover:text-white transition shadow-xl backdrop-blur-md cursor-pointer"
            title="Schließen [ESC]"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Spotlight Search & Results Dropdown (Instant Auto-Fly) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto z-30 w-[92%] max-w-xl">
        
        {/* Floating Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="w-full rounded-2xl border border-cyan-500/40 bg-[#050b16]/96 p-2 shadow-2xl shadow-cyan-950/80 backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-cyan-400/80 flex items-center justify-between border-b border-cyan-500/20">
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} />
                SOFORT-TREFFER (Pfeiltasten zum Navigieren, Enter zum Anfliegen)
              </span>
              <span className="text-slate-500 text-[9px]">{searchResults.length} Treffer</span>
            </div>
            
            <div className="mt-1 flex flex-col gap-1 max-h-56 overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-cyan-500/20">
              {searchResults.map((node, idx) => {
                const isActive = activeResultIndex === idx;
                return (
                  <div
                    key={node.id}
                    onClick={() => handleSelectAndFly(node)}
                    onMouseEnter={() => setActiveResultIndex(idx)}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition cursor-pointer ${
                      isActive
                        ? "bg-cyan-500/25 border border-cyan-400/60 text-white shadow-md shadow-cyan-500/20"
                        : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: node.color }} />
                      <span className="font-bold truncate">{node.name}</span>
                      <span className="text-[10px] text-cyan-400/70 truncate">({node.folder})</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-400">
                      <span>{node.wordCount} W.</span>
                      <div className="flex items-center gap-1 text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.5 rounded text-[9px]">
                        <span>Anfliegen</span>
                        <CornerDownLeft size={10} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Input Bar */}
        <div className="flex items-center gap-2 w-full rounded-2xl border border-cyan-500/40 bg-[#070e1c]/95 px-3.5 py-2 shadow-2xl backdrop-blur-md">
          <Search size={15} className="text-cyan-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Gedanke, Notiz oder Konzept durchsuchen... (Tippe zum sofortigen Anfliegen)"
            className="w-full bg-transparent font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-500 hover:text-white cursor-pointer px-1"
            >
              ✕
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span
                className="text-[9px] font-mono text-cyan-400/80 rounded bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5"
                title="1–9 fliegt direkt in einen Bereich, in der Reihenfolge der Chips darunter. Leertaste wechselt zwischen den beiden Gehirnhälften."
              >
                1–9: Bereiche
              </span>
              <span className="text-[10px] font-mono text-slate-500 rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5">
                Strg+K
              </span>
            </div>
          )}
        </div>

        <div className="mx-auto mb-2 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setTourIndex((prev) => (prev >= 0 ? -1 : 0))}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
            tourRunning
              ? "border-white/25 bg-white/[0.12] text-white"
              : "border-white/[0.09] bg-[#141619]/75 text-white/60 hover:text-white/90 hover:border-white/20"
          }`}
          title="Fliegt die Areale nacheinander an — dreißig Sekunden, in denen du die Form deines Wissens siehst"
        >
          {tourRunning ? <Square size={11} /> : <Play size={11} />}
          <span>{tourRunning ? "Rundflug stoppen" : "Rundflug"}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowOrphans((prev) => !prev)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
            showOrphans
              ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
              : "border-white/[0.09] bg-[#141619]/75 text-white/60 hover:text-white/90 hover:border-white/20"
          }`}
          title="Färbt die Notizen rot ein, auf die nichts verweist — die losen Enden im Vault"
        >
          <Unlink size={11} />
          <span>Lose Enden{orphanCount > 0 ? ` (${orphanCount})` : ""}</span>
        </button>
        <button
          type="button"
          onClick={() => setJarvisOpen((prev) => !prev)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
            jarvisOpen
              ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
              : "border-white/[0.09] bg-[#141619]/75 text-white/60 hover:text-white/90 hover:border-white/20"
          }`}
          title="Stell deinem Vault eine Frage — die Antwort kommt nur aus deinen Notizen, mit Quellen"
        >
          <Sparkles size={11} />
          <span>Fragen</span>
        </button>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleFilterClick(f.id)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono border transition-all duration-200 cursor-pointer ${
                activeFilter === f.id
                  ? "text-white shadow-lg scale-105"
                  : "bg-[#070e1c]/85 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200"
              }`}
              style={activeFilter === f.id ? {
                backgroundColor: f.color + "35",
                borderColor: f.color + "90",
                boxShadow: `0 0 12px ${f.color}40`,
              } : undefined}
            >
              <span className="h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: f.color, boxShadow: activeFilter === f.id ? `0 0 6px ${f.color}` : "none" }} />
              <span className="font-semibold">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tourRunning ? (
        <div className="pointer-events-none absolute left-1/2 top-24 z-40 -translate-x-1/2 text-center">
          <div className="text-3xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            {AREA_FILTERS.find((area) => area.id === activeFilter)?.label ?? ""}
          </div>
          <div className="mt-1 text-[11px] font-medium text-white/50">
            {data?.nodes.filter((node) => node.group === activeFilter).length ?? 0} Notizen
          </div>
        </div>
      ) : null}

      {jarvisOpen ? (
        <JarvisPanel onFlyToSource={handleFlyToSource} onClose={() => setJarvisOpen(false)} />
      ) : null}

      {/* The vault's busiest notes, bottom left. Clicking one flies to it and
          lights up its neighbourhood, so "how is this connected?" is answered
          by looking instead of by hunting. Folded, it shrinks to its own title:
          a folded panel at full width is just an empty box in front of the
          thing it was hiding. */}
      {topHubs.length > 0 && !selectedNode ? (
        <div
          className={`absolute bottom-6 left-6 z-30 rounded-2xl border border-white/[0.09] bg-[#141619]/75 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.55)] backdrop-blur-2xl transition-all duration-200 ${
            hubsCollapsed ? "w-auto px-2 py-1" : "w-60 p-3"
          }`}
        >
          <button
            type="button"
            onClick={() => setHubsCollapsed((prev) => !prev)}
            className="flex w-full items-center justify-between px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/45 hover:text-white/75"
            title={hubsCollapsed ? "Größte Knoten einblenden" : "Größte Knoten ausblenden — freie Sicht aufs Gehirn"}
          >
            <span>Größte Knoten</span>
            <span aria-hidden>{hubsCollapsed ? "+" : "−"}</span>
          </button>
          {!hubsCollapsed ? (
          <ul className="space-y-0.5">
            {topHubs.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => handleSelectAndFly(node)}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.08]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: AREAL_COLORS[node.group] ?? "#38bdf8" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-white/80">
                    {node.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/40">
                    {degreeById.get(node.id) ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          ) : null}
        </div>
      ) : null}

      {/* Right Side 2D Note Inspector Panel */}
      {selectedNode && (
        <div className="absolute top-20 right-6 w-80 max-h-[calc(100vh-160px)] overflow-y-auto rounded-2xl border border-cyan-500/30 bg-[#070e1c]/95 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-200 z-30 scrollbar-thin scrollbar-thumb-cyan-500/20">
          <div className="flex items-start justify-between border-b border-cyan-500/20 pb-2.5">
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedNode.color }} />
                {selectedNode.folder}
              </span>
              <h3 className="font-bold text-sm text-white">{selectedNode.name}</h3>
              {/* How connected a note is, which is the one number a knowledge
                  graph exists to show and the panel never showed. */}
              <span className="mt-0.5 font-mono text-[10px] text-slate-400">
                {degreeById.get(selectedNode.id) ?? 0} Verbindungen
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-slate-500 hover:text-white transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2.5 font-mono text-xs">
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-2">
              <span>Wörter: {selectedNode.wordCount}</span>
              <span className="text-cyan-300 font-semibold uppercase">{selectedNode.group}</span>
            </div>

            {selectedNode.excerpt ? (
              <div className="rounded-lg bg-slate-900/60 p-2.5 text-[11px] text-slate-200 leading-relaxed italic border border-slate-800/80">
                "{selectedNode.excerpt}"
              </div>
            ) : null}

            <div className="flex flex-col gap-1 pt-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Dateipfad:</span>
              <span className="text-[10px] text-cyan-300 break-all bg-[#030712] p-1.5 rounded border border-slate-800">
                {selectedNode.id}
              </span>
            </div>

            <a
              href={`obsidian://open?vault=Life%20OS&file=${encodeURIComponent(selectedNode.id)}`}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white py-2 font-mono text-xs font-semibold shadow-lg shadow-cyan-600/30 transition"
            >
              <ExternalLink size={13} />
              In Obsidian öffnen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
