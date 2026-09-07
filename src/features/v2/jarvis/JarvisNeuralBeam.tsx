"use client";

import { useEffect, useRef, useState } from "react";
import { readBeamAnchors } from "./beamAnchors";

export interface JarvisNeuralBeamProps {
  active: boolean;
  isScanning?: boolean;
  onDismiss?: () => void;
  onFlyToSource?: (sourceId: string) => void;
  targetLabel?: string;
}

const MAX_TARGETS = 5;
const PACKETS_PER_BEAM = 3;
const MAX_SWEEP_PULSES = 8;
const SCAN_PERIOD_SEC = 2.8;

const BRANCH_COLORS = [
  "rgba(0, 240, 255, 0.95)", // Cyan
  "rgba(192, 132, 252, 0.85)", // Purple
  "rgba(52, 211, 153, 0.85)", // Emerald
  "rgba(251, 191, 36, 0.85)", // Amber
  "rgba(244, 63, 94, 0.85)", // Rose
];

export function JarvisNeuralBeam({
  active,
  isScanning = false,
  onDismiss,
  onFlyToSource,
  targetLabel,
}: JarvisNeuralBeamProps) {
  const labelText = useRef(targetLabel);
  useEffect(() => {
    labelText.current = targetLabel;
  }, [targetLabel]);

  // Refs für SVG-Elemente zur direkten High-FPS-Manipulation ohne React-Rerender-Stau
  const containerRef = useRef<HTMLDivElement>(null);
  const headGlowRef = useRef<SVGCircleElement>(null);
  const centerTargetRef = useRef<SVGGElement>(null);
  const centerTextRef = useRef<SVGTextElement>(null);
  const sweepLineRef = useRef<SVGLineElement>(null);

  const mainBeamRef = useRef<SVGLineElement>(null);
  const mainCoreRef = useRef<SVGLineElement>(null);

  const branchBeamRefs = useRef<(SVGLineElement | null)[]>([]);
  const branchCoreRefs = useRef<(SVGLineElement | null)[]>([]);
  const packetRefs = useRef<(SVGCircleElement | null)[]>([]);
  const sweepSparkRefs = useRef<(SVGCircleElement | null)[]>([]);

  // DOM Node Overlays für klickbare Targets
  const [domTargets, setDomTargets] = useState<
    Array<{ id: string; label: string; x: number; y: number }>
  >([]);

  useEffect(() => {
    if (!active) {
      setDomTargets([]);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();
    let lastDomUpdate = 0;

    const tick = () => {
      const now = performance.now();
      const t = (now - startTime) / 1000;
      const { head, brainCenter, targets, sweep } = readBeamAnchors();

      // Fallback-Position für den Kopf (Standard: unten rechts)
      const headPos = head ?? {
        x: window.innerWidth - 60,
        y: window.innerHeight - 60,
      };

      // Fallback-Position für das Gehirn-Zentrum (Standard: Bildschirmmitte)
      const centerPos = brainCenter ?? {
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.46,
      };

      // 1. Kopf-Aura animieren
      if (headGlowRef.current) {
        headGlowRef.current.setAttribute("cx", String(headPos.x));
        headGlowRef.current.setAttribute("cy", String(headPos.y));
        const pulse = Math.sin(t * 5) * 4 + 20;
        headGlowRef.current.setAttribute("r", String(pulse));
      }

      const hasRealTargets = targets.length > 0;

      // 2. Scan-Effekt (Sweep-Welle durch das neuronale Netz)
      if (sweep.length > 0) {
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        for (const p of sweep) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }

        const sweepProgress = (t % SCAN_PERIOD_SEC) / SCAN_PERIOD_SEC;
        const pingPong =
          sweepProgress < 0.5 ? sweepProgress * 2 : 2 - sweepProgress * 2;
        const curY = minY + (maxY - minY) * pingPong;

        if (sweepLineRef.current) {
          sweepLineRef.current.setAttribute("x1", String(Math.max(20, minX - 40)));
          sweepLineRef.current.setAttribute("x2", String(Math.min(window.innerWidth - 20, maxX + 40)));
          sweepLineRef.current.setAttribute("y1", String(curY));
          sweepLineRef.current.setAttribute("y2", String(curY));
          sweepLineRef.current.setAttribute("opacity", isScanning ? "0.85" : "0.35");
        }

        // Funken an getroffenen Sweep-Notizen
        for (let i = 0; i < MAX_SWEEP_PULSES; i++) {
          const spark = sweepSparkRefs.current[i];
          if (!spark) continue;
          const pt = sweep[(i * 7 + Math.floor(t * 12)) % sweep.length];
          if (pt && Math.abs(pt.y - curY) < 45) {
            spark.setAttribute("cx", String(pt.x));
            spark.setAttribute("cy", String(pt.y));
            spark.setAttribute("opacity", "0.9");
            spark.setAttribute("r", String(Math.sin(t * 10 + i) * 1.5 + 3));
          } else {
            spark.setAttribute("opacity", "0");
          }
        }
      }

      // 3. Haupt-Verbindung (entweder zu Gehirnmitte während Scan oder zu Notiz 1)
      const primaryTarget = hasRealTargets ? targets[0] : centerPos;

      if (mainBeamRef.current && mainCoreRef.current) {
        mainBeamRef.current.setAttribute("x1", String(headPos.x));
        mainBeamRef.current.setAttribute("y1", String(headPos.y));
        mainBeamRef.current.setAttribute("x2", String(primaryTarget.x));
        mainBeamRef.current.setAttribute("y2", String(primaryTarget.y));

        mainCoreRef.current.setAttribute("x1", String(headPos.x));
        mainCoreRef.current.setAttribute("y1", String(headPos.y));
        mainCoreRef.current.setAttribute("x2", String(primaryTarget.x));
        mainCoreRef.current.setAttribute("y2", String(primaryTarget.y));

        mainBeamRef.current.setAttribute(
          "stroke-width",
          hasRealTargets ? "12" : isScanning ? "14" : "8"
        );
        mainBeamRef.current.setAttribute("opacity", hasRealTargets ? "0.9" : "0.7");
      }

      // Zentrum-Reticle (nur aktiv, wenn noch keine konkreten Notizen feststehen)
      if (centerTargetRef.current) {
        if (!hasRealTargets) {
          centerTargetRef.current.setAttribute("opacity", "1");
          centerTargetRef.current.setAttribute(
            "transform",
            `translate(${centerPos.x}, ${centerPos.y}) rotate(${t * 40})`
          );
          if (centerTextRef.current) {
            centerTextRef.current.textContent = isScanning
              ? "NEURAL SCAN • DURCHSUCHE GEHIRN"
              : labelText.current ?? "HERMES KERNEL";
          }
        } else {
          centerTargetRef.current.setAttribute("opacity", "0");
        }
      }

      // 4. Verzweigte Strahlen zu weiteren Notizen
      for (let i = 0; i < MAX_TARGETS; i++) {
        const branchBeam = branchBeamRefs.current[i];
        const branchCore = branchCoreRefs.current[i];
        const tgt = targets[i];

        if (!hasRealTargets || !tgt) {
          branchBeam?.setAttribute("opacity", "0");
          branchCore?.setAttribute("opacity", "0");
          continue;
        }

        const color = BRANCH_COLORS[i % BRANCH_COLORS.length];

        if (branchBeam && branchCore) {
          branchBeam.setAttribute("x1", String(headPos.x));
          branchBeam.setAttribute("y1", String(headPos.y));
          branchBeam.setAttribute("x2", String(tgt.x));
          branchBeam.setAttribute("y2", String(tgt.y));
          branchBeam.setAttribute("stroke", color);
          branchBeam.setAttribute("opacity", "0.6");

          branchCore.setAttribute("x1", String(headPos.x));
          branchCore.setAttribute("y1", String(headPos.y));
          branchCore.setAttribute("x2", String(tgt.x));
          branchCore.setAttribute("y2", String(tgt.y));
          branchCore.setAttribute("opacity", "0.9");
        }
      }

      // 5. Datenpakete (fließen entlang der Strahlen)
      for (let i = 0; i < MAX_TARGETS; i++) {
        const tgt = hasRealTargets ? targets[i] : (i === 0 ? centerPos : null);
        for (let p = 0; p < PACKETS_PER_BEAM; p++) {
          const packetIdx = i * PACKETS_PER_BEAM + p;
          const packetEl = packetRefs.current[packetIdx];
          if (!packetEl) continue;

          if (!tgt) {
            packetEl.setAttribute("opacity", "0");
            continue;
          }

          const progress = ((t * 0.75 + p / PACKETS_PER_BEAM + i * 0.15) % 1);
          const px = headPos.x + (tgt.x - headPos.x) * progress;
          const py = headPos.y + (tgt.y - headPos.y) * progress;

          packetEl.setAttribute("cx", String(px));
          packetEl.setAttribute("cy", String(py));
          packetEl.setAttribute("opacity", "0.95");
          packetEl.setAttribute("r", i === 0 ? "3.5" : "2.5");
        }
      }

      // 6. DOM-Targets alle ~80ms synchronisieren
      if (now - lastDomUpdate > 80) {
        lastDomUpdate = now;
        if (hasRealTargets) {
          setDomTargets(
            targets.map((tg) => ({
              id: tg.id,
              label: tg.label,
              x: tg.x,
              y: tg.y,
            }))
          );
        } else {
          setDomTargets([]);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [active, isScanning]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {/* SVG Canvas für Laser, Glüheffekte, Scanwellen und Datenpakete */}
      <svg className="h-full w-full">
        <defs>
          <filter id="jarvis-laser-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Kopf-Aura */}
        <circle
          ref={headGlowRef}
          fill="none"
          stroke="#00f0ff"
          strokeWidth="2"
          opacity="0.8"
          filter="url(#jarvis-laser-glow)"
        />

        {/* Scan-Horizont-Linie */}
        <line
          ref={sweepLineRef}
          stroke="rgba(0, 240, 255, 0.7)"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          filter="url(#jarvis-laser-glow)"
          opacity="0"
        />

        {/* Sweep-Notizfunken */}
        {Array.from({ length: MAX_SWEEP_PULSES }).map((_, i) => (
          <circle
            key={`spark-${i}`}
            ref={(el) => {
              sweepSparkRefs.current[i] = el;
            }}
            fill="#38bdf8"
            opacity="0"
            filter="url(#jarvis-laser-glow)"
          />
        ))}

        {/* Verzweigte Strahlen zu den Notizen */}
        {Array.from({ length: MAX_TARGETS }).map((_, i) => (
          <g key={`branch-${i}`}>
            <line
              ref={(el) => {
                branchBeamRefs.current[i] = el;
              }}
              strokeWidth="6"
              filter="url(#jarvis-laser-glow)"
              opacity="0"
            />
            <line
              ref={(el) => {
                branchCoreRefs.current[i] = el;
              }}
              stroke="#ffffff"
              strokeWidth="1.8"
              opacity="0"
            />
          </g>
        ))}

        {/* Haupt-Strahl */}
        <line
          ref={mainBeamRef}
          stroke="#00f0ff"
          strokeWidth="10"
          filter="url(#jarvis-laser-glow)"
          opacity="0"
        />
        <line
          ref={mainCoreRef}
          stroke="#ffffff"
          strokeWidth="2.8"
          opacity="0"
        />

        {/* Fließende Datenpakete */}
        {Array.from({ length: MAX_TARGETS * PACKETS_PER_BEAM }).map((_, i) => (
          <circle
            key={`packet-${i}`}
            ref={(el) => {
              packetRefs.current[i] = el;
            }}
            fill="#ffffff"
            filter="url(#jarvis-laser-glow)"
            opacity="0"
          />
        ))}

        {/* Dreh-Reticle im Gehirn-Zentrum (vor Notiz-Erfassung) */}
        <g ref={centerTargetRef} opacity="0">
          <circle
            r="32"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="1.5"
            strokeDasharray="8 6"
            filter="url(#jarvis-laser-glow)"
          />
          <circle r="6" fill="#00f0ff" opacity="0.9" />
          <text
            ref={centerTextRef}
            y="-42"
            textAnchor="middle"
            fill="#38bdf8"
            fontSize="10"
            fontFamily="monospace"
            letterSpacing="0.14em"
            fontWeight="bold"
          >
            HERMES NEURAL SCAN
          </text>
        </g>
      </svg>

      {/* Oberes Steuerungs-HUD: Verbindung trennen & Status */}
      <div className="pointer-events-auto absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-cyan-500/40 bg-[#0a1018]/90 px-4 py-1.5 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.25)]">
        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shadow-[0_0_8px_#00f0ff]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200 font-bold">
          {isScanning
            ? "NEURAL SCAN AKTIV • DURCHSUCHE GEHIRN"
            : domTargets.length > 0
            ? `VERBINDUNG STEHT • ${domTargets.length} QUELLEN IM GEHIRN ZITIERT`
            : "JARVIS NEURAL LINK AKTIV"}
        </span>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Verbindung trennen"
            className="ml-2 flex items-center gap-1 rounded-full bg-white/10 hover:bg-rose-500/20 hover:border-rose-500/50 border border-white/20 px-2.5 py-0.5 font-mono text-[10px] text-white/80 transition-all hover:text-white"
          >
            <span>×</span>
            <span>TRENNEN</span>
          </button>
        )}
      </div>

      {/* Klickbare Ziel-HUDs für jede gefundene Notiz im 3D-Gehirn */}
      {domTargets.map((target, idx) => (
        <div
          key={target.id}
          className="pointer-events-auto absolute z-50 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
          style={{ left: `${target.x}px`, top: `${target.y}px` }}
        >
          <div className="group relative flex flex-col items-center">
            {/* Ziel-Puls-Ring */}
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-2 border-cyan-400/80 animate-ping" />
              <span className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#00f0ff]" />
            </div>

            {/* Notiz-Label & Heranfliegen-Button */}
            <div className="mt-1 flex flex-col items-center gap-1 rounded-lg border border-white/20 bg-[#0a1018]/95 px-2.5 py-1.5 shadow-2xl backdrop-blur-md">
              <span className="max-w-[200px] truncate text-[11.5px] font-semibold text-white/95">
                {target.label}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-400">
                  QUELLE #{idx + 1}
                </span>
                {onFlyToSource && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFlyToSource(target.id);
                    }}
                    className="rounded bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/40 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 transition-colors"
                  >
                    HERANFLIEGEN
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
