"use client";

import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Text } from "@react-three/drei";
import * as THREE from "three";
import { Play, Pause, SkipForward, Users, Sparkles, CheckCircle2, X } from "lucide-react";
import { cyberAudio } from "@/lib/sound/cyberAudio";

export type ConferenceMode = "delphi" | "debate" | "standup";

export interface TableMeetingState {
  isActive: boolean;
  isPaused: boolean;
  mode?: ConferenceMode;
  stageIndex: number; // 0..3
  speakerName: string;
  speakerColor: string;
  question: string;
  timerSeconds: number;
  totalStages: number;
}

export function TableMeetingHoloHub({
  position = [0, 0.77, 0],
  agentCount = 4,
  meetingState,
  onStartMeeting,
  onTogglePause,
  onNextStage,
  onSelectMode,
}: {
  position?: [number, number, number];
  agentCount?: number;
  meetingState: TableMeetingState;
  onStartMeeting?: (mode?: ConferenceMode) => void;
  onTogglePause?: () => void;
  onNextStage?: () => void;
  onSelectMode?: (mode: ConferenceMode) => void;
}) {
  const coreHoloRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const [isDismissed, setIsDismissed] = useState(true);
  const [activeTabMode, setActiveTabMode] = useState<ConferenceMode>(meetingState.mode ?? "delphi");

  // Smooth animation for table ring and floating hologram core
  useFrame((_, delta) => {
    if (coreHoloRef.current) {
      coreHoloRef.current.rotation.y += delta * 0.8;
    }
    if (ringRef.current && ringMatRef.current) {
      const time = performance.now() * 0.003;
      const pulse = Math.sin(time) * 0.5 + 0.5;

      if (meetingState.isActive) {
        ringRef.current.scale.setScalar(1.0 + pulse * 0.12);
        ringMatRef.current.opacity = 0.65 + pulse * 0.3;
        ringMatRef.current.color.set(meetingState.speakerColor);
      } else {
        ringRef.current.scale.setScalar(1.0 + pulse * 0.05);
        ringMatRef.current.opacity = 0.45 + pulse * 0.25;
        ringMatRef.current.color.set("#00f0ff");
      }
    }
  });

  const progressPercent = Math.round(
    ((meetingState.stageIndex + 1) / meetingState.totalStages) * 100,
  );

  return (
    <group position={position}>
      {/* 1. Pulsing 3D Ring directly on the table surface */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
      >
        <ringGeometry args={[0.55, 0.68, 36]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color="#00f0ff"
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 2. Floating 3D Diamond Hologram Core */}
      <group ref={coreHoloRef} position={[0, 0.22, 0]}>
        <mesh>
          <octahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial
            color={meetingState.isActive ? meetingState.speakerColor : "#00f0ff"}
            wireframe
          />
        </mesh>
        <mesh>
          <octahedronGeometry args={[0.07, 0]} />
          <meshBasicMaterial
            color={meetingState.isActive ? meetingState.speakerColor : "#00f0ff"}
            transparent
            opacity={0.6}
          />
        </mesh>
      </group>
 
      {/* 2b. Station 4: Deliverables & Results Hologram (Native 3D Vector Text) */}
      {!meetingState.isActive && (
        <group position={[0, 0.44, 0]}>
          <Text
            position={[0, 0.12, 0]}
            fontSize={0.046}
            color="#38bdf8"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.002}
            outlineColor="#000000"
          >
            📦 TAGES-ERGEBNISSE & FREIGABEN
          </Text>
          <Text
            position={[0, 0.04, 0]}
            fontSize={0.034}
            color="#86efac"
            anchorX="center"
            anchorY="middle"
          >
            ✓ 4 Agenten im Orbit aktiv · 0 Blocker
          </Text>
          <Text
            position={[0, -0.03, 0]}
            fontSize={0.030}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
          >
            ✓ Alle Systeme operativ & synchron
          </Text>
        </group>
      )}

      {/* 3. Interactive 3D HTML Billboard */}
      <Html
        position={[0, 0.42, 0]}
        center
        distanceFactor={6.2}
        style={{ pointerEvents: "auto", userSelect: "none" }}
      >
        <div className="flex flex-col items-center">
          {isDismissed ? null : !meetingState.isActive ? (
            /* Idle / Conference Mode Selector State */
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-cyan-500/40 bg-[#060e1a]/95 px-4 py-3 shadow-2xl shadow-cyan-950/70 backdrop-blur-md transition-all w-80 relative">
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playBlip();
                  setIsDismissed(true);
                }}
                className="absolute top-2 right-2 text-cyan-400/60 hover:text-white p-0.5 rounded transition"
                title="Ausblenden"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center gap-1.5 w-full border-b border-cyan-500/20 pb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-200">
                  Hermes Konferenz-Zentrale
                </span>
              </div>

              {/* Mode Tabs */}
              <div className="grid grid-cols-3 gap-1 w-full bg-slate-900/80 p-1 rounded-xl border border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => {
                    cyberAudio.playBlip();
                    setActiveTabMode("delphi");
                    onSelectMode?.("delphi");
                  }}
                  className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-[9px] font-mono transition ${
                    activeTabMode === "delphi"
                      ? "bg-amber-500/25 text-amber-300 border border-amber-400/50 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>👑 Delphi</span>
                  <span className="text-[7px] text-amber-400/70">Blind-Synthese</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cyberAudio.playBlip();
                    setActiveTabMode("debate");
                    onSelectMode?.("debate");
                  }}
                  className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-[9px] font-mono transition ${
                    activeTabMode === "debate"
                      ? "bg-rose-500/25 text-rose-300 border border-rose-400/50 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>⚔️ Stress-Test</span>
                  <span className="text-[7px] text-rose-400/70">Advocate</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cyberAudio.playBlip();
                    setActiveTabMode("standup");
                    onSelectMode?.("standup");
                  }}
                  className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-[9px] font-mono transition ${
                    activeTabMode === "standup"
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>⚡ Stand-up</span>
                  <span className="text-[7px] text-emerald-400/70">Quick Round</span>
                </button>
              </div>

              {/* Mode Description */}
              <div className="text-[10px] text-slate-300 bg-black/40 border border-cyan-500/20 rounded-lg p-2 w-full text-center leading-relaxed">
                {activeTabMode === "delphi" && (
                  <span>
                    <strong className="text-amber-300 font-mono">Delphi-Methode:</strong> Claude, ChatGPT & Gemini entwerfen blind unabhängig. <strong className="text-amber-400">Hermes</strong> synthetisiert als Boss die Master-Lösung!
                  </span>
                )}
                {activeTabMode === "debate" && (
                  <span>
                    <strong className="text-rose-300 font-mono">Devil's Advocate:</strong> Ein Agent schlägt vor, die anderen testen Schwachstellen & Security. Hermes fällt das finale Urteil.
                  </span>
                )}
                {activeTabMode === "standup" && (
                  <span>
                    <strong className="text-emerald-300 font-mono">Agile Stand-up:</strong> Schneller 30s-Round-Robin über Fortschritt, Blocker und Freigaben.
                  </span>
                )}
              </div>

              {/* Start Button */}
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playChime();
                  onStartMeeting?.(activeTabMode);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-lg w-full transition active:scale-95 ${
                  activeTabMode === "delphi"
                    ? "bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:brightness-110 shadow-amber-900/40"
                    : activeTabMode === "debate"
                    ? "bg-gradient-to-r from-rose-600 to-red-600 hover:brightness-110 shadow-rose-900/40"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 shadow-emerald-900/40"
                }`}
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>
                  {activeTabMode === "delphi"
                    ? "Delphi-Konferenz starten"
                    : activeTabMode === "debate"
                    ? "Debatte starten"
                    : "Stand-up starten"}
                </span>
              </button>
            </div>
          ) : (
            /* Active Stand-up / Council Stage */
            <div
              className="flex flex-col items-center gap-1.5 rounded-2xl border bg-[#060c18]/95 px-5 py-3 shadow-2xl backdrop-blur-md w-72 transition-all animate-in zoom-in-95 duration-200 relative"
              style={{ borderColor: `${meetingState.speakerColor}55` }}
            >
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playBlip();
                  setIsDismissed(true);
                }}
                className="absolute top-2.5 right-2 text-slate-400 hover:text-white p-0.5 rounded transition"
                title="Minimieren"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {/* Speaker Badge */}
              <div className="flex items-center justify-between w-full pr-5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: meetingState.speakerColor }}
                  />
                  <span className="text-[11px] font-bold text-white tracking-wider font-mono uppercase">
                    {meetingState.speakerName} spricht
                  </span>
                </div>
                <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                  {meetingState.stageIndex + 1}/{meetingState.totalStages}
                </span>
              </div>

              {/* Active Question */}
              <div className="text-center text-xs font-semibold text-slate-100 my-0.5 leading-snug">
                "{meetingState.question}"
              </div>

              {/* Progress & Countdown */}
              <div className="flex items-center justify-between w-full text-[10px] text-slate-400 font-mono mt-0.5">
                <span>Fortschritt: {progressPercent}%</span>
                <span className="text-amber-300">
                  00:{meetingState.timerSeconds.toString().padStart(2, "0")}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: meetingState.speakerColor,
                  }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    cyberAudio.playBlip();
                    onTogglePause?.();
                  }}
                  className="flex items-center gap-1 rounded-lg bg-slate-800/80 px-2.5 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  {meetingState.isPaused ? (
                    <>
                      <Play className="h-2.5 w-2.5 fill-current" />
                      Fortsetzen
                    </>
                  ) : (
                    <>
                      <Pause className="h-2.5 w-2.5 fill-current" />
                      Pause
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cyberAudio.playBlip();
                    onNextStage?.();
                  }}
                  className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500 transition"
                >
                  <SkipForward className="h-2.5 w-2.5 fill-current" />
                  Weiter
                </button>
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
