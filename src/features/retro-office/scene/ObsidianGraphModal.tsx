"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { X, Search, FileText, ExternalLink, Network, CornerDownLeft, Sparkles, Volume2, VolumeX } from "lucide-react";
import { Obsidian3DGraphCore, GraphNode, ObsidianGraphData } from "./Obsidian3DGraphCore";
import { cyberAudio } from "@/lib/sound/cyberAudio";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [isOpen, onClose]);

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
    cyberAudio.playSynapseBlip();
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

  const filters = [
    { id: "all", label: "🧠 Alle Neuronen", color: "#38bdf8" },
    { id: "projects", label: "🚀 Projekte", color: "#f59e0b" },
    { id: "knowledge", label: "🧠 Wissen", color: "#ec4899" },
    { id: "system", label: "⚙️ System", color: "#38bdf8" },
    { id: "identity", label: "🪪 Identität", color: "#34d399" },
    { id: "sources", label: "📚 Quellen", color: "#06b6d4" },
    { id: "ideas", label: "💡 Ideen", color: "#e879f9" },
    { id: "interests", label: "⭐ Interessen", color: "#fbbf24" },
    { id: "core", label: "⚡ Core", color: "#ffffff" },
  ];

  const handleFilterClick = (filterId: string) => {
    setActiveFilter(filterId);
    setFlyToLobe(filterId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      
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
            />

            <OrbitControls
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

        {/* Actions: Sound Mute Toggle & Close */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMuted((prev) => !prev)}
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 font-mono text-xs transition shadow-xl backdrop-blur-md cursor-pointer ${
              !isMuted
                ? "border-cyan-500/50 bg-cyan-950/80 text-cyan-300 shadow-cyan-500/20"
                : "border-slate-700 bg-[#070e1c]/90 text-slate-500 hover:text-slate-300"
            }`}
            title={!isMuted ? "Gehirnsound stummschalten" : "Gehirnsound aktivieren"}
          >
            {!isMuted ? <Volume2 size={15} className="text-cyan-400 animate-pulse" /> : <VolumeX size={15} />}
            <span className="text-[10px] font-bold">{!isMuted ? "SOUND AN" : "MUTE"}</span>
          </button>

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
            autoFocus
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-500 hover:text-white cursor-pointer px-1"
            >
              ✕
            </button>
          ) : (
            <span className="text-[10px] font-mono text-slate-500 rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5">
              Strg+K
            </span>
          )}
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
