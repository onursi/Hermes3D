"use client";

import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Play, Pause, SkipForward, Users, Sparkles, CheckCircle2 } from "lucide-react";
import { cyberAudio } from "@/lib/sound/cyberAudio";

export interface TableMeetingState {
  isActive: boolean;
  isPaused: boolean;
  stageIndex: number; // 0..3
  speakerName: string;
  speakerColor: string;
  question: string;
  timerSeconds: number;
  totalStages: number;
}

interface TableMeetingHoloHubProps {
  position: [number, number, number];
  agentCount?: number;
  meetingState: TableMeetingState;
  onStartMeeting?: () => void;
  onTogglePause?: () => void;
  onNextStage?: () => void;
}

export function TableMeetingHoloHub({
  position,
  agentCount = 4,
  meetingState,
  onStartMeeting,
  onTogglePause,
  onNextStage,
}: TableMeetingHoloHubProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreHoloRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

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
        ringMatRef.current.color.set(meetingState.speakerColor || "#00f0ff");
      } else {
        ringRef.current.scale.setScalar(1.0 + pulse * 0.05);
        ringMatRef.current.opacity = 0.4 + pulse * 0.2;
        ringMatRef.current.color.set("#10b981");
      }
    }
  });

  const progressPercent = Math.round(
    ((meetingState.stageIndex + 1) / meetingState.totalStages) * 100
  );

  return (
    <group position={position}>
      {/* 1. Hologram Floor / Table Ring Projection */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.55, 0.68, 36]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color="#10b981"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Floating Diamond Holographic Core */}
      <mesh ref={coreHoloRef} position={[0, 0.22, 0]}>
        <octahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial
          color={meetingState.isActive ? meetingState.speakerColor : "#38bdf8"}
          emissive={meetingState.isActive ? meetingState.speakerColor : "#38bdf8"}
          emissiveIntensity={0.8}
          wireframe
        />
      </mesh>

      {/* 3. Interactive 3D HTML Billboard */}
      <Html
        position={[0, 0.42, 0]}
        center
        distanceFactor={6.2}
        style={{ pointerEvents: "auto", userSelect: "none" }}
      >
        <div className="flex flex-col items-center">
          {!meetingState.isActive ? (
            /* Idle / Ready State */
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-500/40 bg-[#091410]/92 px-4 py-2.5 shadow-xl shadow-emerald-950/60 backdrop-blur-md transition-all hover:scale-105">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-300 whitespace-nowrap">
                  Stand-up bereit ({agentCount} Agenten anwesend)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playChime();
                  onStartMeeting?.();
                }}
                className="mt-0.5 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-1 text-xs font-bold text-white shadow-lg shadow-emerald-900/40 hover:brightness-110 active:scale-95 transition"
              >
                <Play className="h-3 w-3 fill-white" />
                Meeting starten
              </button>
            </div>
          ) : (
            /* Active Stand-up / Council Stage */
            <div
              className="flex flex-col items-center gap-1.5 rounded-2xl border bg-[#060c18]/95 px-5 py-3 shadow-2xl backdrop-blur-md w-72 transition-all animate-in zoom-in-95 duration-200"
              style={{ borderColor: `${meetingState.speakerColor}55` }}
            >
              {/* Speaker Badge */}
              <div className="flex items-center justify-between w-full">
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
