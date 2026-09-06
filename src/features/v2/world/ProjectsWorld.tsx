"use client";

import { Billboard, Html, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { Project } from "@/features/v2/useProjects";
import {
  SHOWCASE_PROJECTS,
  type ProjectSectorItem,
  type ProjectShowcase,
  type TimelineMilestone,
} from "@/features/v2/world/projectData";
import { ProjectWorkspaceModal } from "@/features/v2/world/ProjectWorkspaceModal";
import { TesseractMemoryWorld } from "@/features/v2/world/TesseractMemoryWorld";

/**
 * PROJEKTWELT & ERGEBNISWERFT + 4D INTERSTELLAR TESSERAKT
 *
 * 1. DIE WERFT:
 *   - Monumentale Obsidian-Glasplatte (Endziel auf einen Blick)
 *   - 3 Sektoren: Quellen, Werkstatt, Ergebnisse
 *   - Council-Podest & Meilenstein-Orbiter
 *   - 2D-Arbeitsfläche im Raum
 *
 * 2. DER 4D-ERINNERUNGSRAUM (INTERSTELLAR TESSERAKT):
 *   - Unendliche Raumzeit-Gravitationsfäden (Gold & Cyan)
 *   - Schwebende Fotoplatten (Tokio, Alpen-Roadtrip, Pazifik, Hermes Urknall)
 *   - Hans Zimmer Drone & Uhrenticken
 *   - Zeitreise Fly-Through
 */
export function ProjectsWorld({
  projects,
  selectedFolder,
  onSelect,
}: {
  projects: Project[];
  selectedFolder: string | null;
  onSelect: (project: Project) => void;
}) {
  const [worldMode, setWorldMode] = useState<"werft" | "tesseract">("werft");
  const [activeProjectKey, setActiveProjectKey] = useState<string>("01 Hermes Agent OS");
  const [activeItem, setActiveItem] = useState<ProjectSectorItem | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<TimelineMilestone | null>(null);
  const [showEndzielModal, setShowEndzielModal] = useState<boolean>(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const showcase: ProjectShowcase =
    SHOWCASE_PROJECTS[activeProjectKey] || SHOWCASE_PROJECTS["01 Hermes Agent OS"];

  // Dynamic animation refs
  const coreRef = useRef<THREE.Group>(null);
  const ringInnerRef = useRef<THREE.Mesh>(null);
  const ringOuterRef = useRef<THREE.Mesh>(null);
  const timelineGroupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.45;
      coreRef.current.position.y = 2.4 + Math.sin(t * 1.5) * 0.12;
    }
    if (ringInnerRef.current) {
      ringInnerRef.current.rotation.z = -t * 0.35;
      ringInnerRef.current.rotation.x = Math.sin(t * 0.5) * 0.2;
    }
    if (ringOuterRef.current) {
      ringOuterRef.current.rotation.z = t * 0.25;
      ringOuterRef.current.rotation.y = Math.cos(t * 0.6) * 0.25;
    }
    if (timelineGroupRef.current) {
      timelineGroupRef.current.rotation.y = Math.sin(t * 0.2) * 0.04;
    }
  });

  // Split showcase items into sectors
  const quellenItems = useMemo(
    () => showcase.items.filter((i) => i.sector === "quellen"),
    [showcase],
  );
  const werkstattItems = useMemo(
    () => showcase.items.filter((i) => i.sector === "werkstatt"),
    [showcase],
  );
  const ergebnisseItems = useMemo(
    () => showcase.items.filter((i) => i.sector === "ergebnisse"),
    [showcase],
  );

  const SECTOR_CONFIG = {
    quellen: { centerAngle: (Math.PI * 7) / 6, radius: 8.8, color: "#38bdf8", label: "📂 QUELLEN & INPUTS" },
    werkstatt: { centerAngle: -(Math.PI * 1) / 6, radius: 8.8, color: "#fbbf24", label: "🛠️ WERKSTATT & ENTWÜRFE" },
    ergebnisse: { centerAngle: Math.PI / 2, radius: 8.8, color: "#34d399", label: "🏆 ERGEBNISSE & RELEASES" },
  };

  return (
    <>
      {/* ================= HUD MODE TOGGLE BAR (HTML OVERLAY) ================= */}
      <Html fullscreen style={{ pointerEvents: "none", zIndex: 900 }}>
        <div className="fixed top-14 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-[#060c18]/90 px-3 py-1.5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setWorldMode("werft")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold transition ${
              worldMode === "werft"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            <span>🚢</span>
            <span>Werft & Endziel</span>
          </button>

          <div className="h-4 w-px bg-white/15" />

          <button
            type="button"
            onClick={() => setWorldMode("tesseract")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold transition ${
              worldMode === "tesseract"
                ? "bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-[0_0_12px_rgba(192,132,252,0.3)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            <span>🪐</span>
            <span>4D-Erinnerungsorbit (Interstellar)</span>
          </button>

          <div className="h-4 w-px bg-white/15" />

          <button
            type="button"
            onClick={() => setShowEndzielModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 font-mono text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
          >
            <span>💎</span>
            <span>Endziel-Glasplatte</span>
          </button>
        </div>
      </Html>

      {/* ================= MODE 2: INTERSTELLAR 4D TESSERACT ================= */}
      {worldMode === "tesseract" ? (
        <TesseractMemoryWorld onClose={() => setWorldMode("werft")} />
      ) : (
        /* ================= MODE 1: THE SHIPYARD & MONUMENT ================= */
        <group>
          {/* Dock Foundation */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
            <ringGeometry args={[11.5, 12.2, 64]} />
            <meshBasicMaterial color="#1e293b" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
            <circleGeometry args={[12.5, 64]} />
            <meshStandardMaterial color="#050a12" roughness={0.7} metalness={0.4} />
          </mesh>

          {/* Sector Rays */}
          {[SECTOR_CONFIG.quellen, SECTOR_CONFIG.werkstatt, SECTOR_CONFIG.ergebnisse].map((sec, idx) => {
            const x = Math.cos(sec.centerAngle) * 5.8;
            const z = Math.sin(sec.centerAngle) * 5.8;
            return (
              <group key={idx}>
                <mesh position={[x / 2, -0.05, z / 2]} rotation={[-Math.PI / 2, 0, -sec.centerAngle]}>
                  <planeGeometry args={[5.8, 0.08]} />
                  <meshBasicMaterial color={sec.color} transparent opacity={0.4} />
                </mesh>
                <mesh position={[x * 1.5, -0.03, z * 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[2.5, 2.7, 36]} />
                  <meshBasicMaterial color={sec.color} transparent opacity={0.5} side={THREE.DoubleSide} />
                </mesh>
                <Billboard position={[x * 1.5, 0.15, z * 1.5]}>
                  <Text
                    fontSize={0.28}
                    color={sec.color}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.015}
                    outlineColor="#000000"
                  >
                    {sec.label}
                  </Text>
                </Billboard>
              </group>
            );
          })}

          {/* ================= MONUMENTALE OBSIDIAN-GLASPLATTE (3D IM RAUM) ================= */}
          <group position={[0, 4.6, -5.5]}>
            {/* Glass Plate Mesh */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setShowEndzielModal(true);
              }}
              onPointerOver={() => {
                if (typeof document !== "undefined") document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                if (typeof document !== "undefined") document.body.style.cursor = "auto";
              }}
            >
              <planeGeometry args={[7.2, 3.8]} />
              <meshPhysicalMaterial
                color="#030814"
                roughness={0.1}
                metalness={0.2}
                transmission={0.75}
                thickness={0.5}
                transparent
                opacity={0.88}
                clearcoat={1}
                reflectivity={0.9}
              />
            </mesh>

            {/* Glowing Neon Bezel */}
            <lineSegments>
              <edgesGeometry args={[new THREE.PlaneGeometry(7.22, 3.82)]} />
              <lineBasicMaterial color="#00f0ff" transparent opacity={0.7} />
            </lineSegments>

            {/* Subtle Grid on Glass */}
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[7.0, 3.6]} />
              <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.12} />
            </mesh>

            {/* Inscribed 3D Blueprint on Glass */}
            <Text
              position={[0, 1.4, 0.05]}
              fontSize={0.3}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.015}
              outlineColor="#020612"
            >
              💎 DAS ENDZIEL // HERMES AGENT OS
            </Text>

            <Text
              position={[0, 0.95, 0.05]}
              fontSize={0.16}
              color="#00f0ff"
              anchorX="center"
              anchorY="middle"
            >
              MENSCH (SPRACHE) ➔ KI-COUNCIL ➔ OBSIDIAN ➔ 3D-WELTEN ➔ ERGEBNISSE
            </Text>

            <Text
              position={[0, 0.45, 0.05]}
              fontSize={0.14}
              color="#cbd5e1"
              maxWidth={6.2}
              textAlign="center"
              lineHeight={1.4}
              anchorX="center"
              anchorY="middle"
            >
              Du sprichst deine Gedanken und Visionen ein. Das KI-Team erledigt die Umsetzung. Dein Kopf bleibt frei.
            </Text>

            {/* Interactive Click Button on Glass */}
            <group
              position={[-1.6, -1.0, 0.06]}
              onClick={(e) => {
                e.stopPropagation();
                setShowEndzielModal(true);
              }}
            >
              <mesh>
                <planeGeometry args={[2.8, 0.5]} />
                <meshBasicMaterial color="#0284c7" transparent opacity={0.85} />
              </mesh>
              <Text
                fontSize={0.16}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                position={[0, 0, 0.02]}
              >
                [ 💎 Blueprint öffnen ]
              </Text>
            </group>

            {/* Portal to 4D Tesseract */}
            <group
              position={[1.6, -1.0, 0.06]}
              onClick={(e) => {
                e.stopPropagation();
                setWorldMode("tesseract");
              }}
            >
              <mesh>
                <planeGeometry args={[2.8, 0.5]} />
                <meshBasicMaterial color="#9333ea" transparent opacity={0.85} />
              </mesh>
              <Text
                fontSize={0.16}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                position={[0, 0, 0.02]}
              >
                [ 🪐 4D-Tesserakt betreten ]
              </Text>
            </group>
          </group>

          {/* ================= 2. ZENTRALER PROJEKT-KERN (MONOLITH) ================= */}
          <group position={[0, 0, 0]}>
            <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[1.6, 1.9, 0.5, 32]} />
              <meshStandardMaterial color="#0c1420" roughness={0.3} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.3, 1.55, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} side={THREE.DoubleSide} />
            </mesh>

            {/* Floating Monolith Crystal */}
            <group ref={coreRef} position={[0, 2.4, 0]}>
              <mesh>
                <octahedronGeometry args={[0.7, 0]} />
                <meshStandardMaterial
                  color="#0284c7"
                  emissive="#38bdf8"
                  emissiveIntensity={0.8}
                  roughness={0.15}
                  metalness={0.9}
                  wireframe
                />
              </mesh>
              <mesh>
                <octahedronGeometry args={[0.45, 0]} />
                <meshBasicMaterial color="#67e8f9" transparent opacity={0.65} toneMapped={false} />
              </mesh>
              <mesh ref={ringInnerRef}>
                <torusGeometry args={[1.05, 0.02, 12, 48]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} toneMapped={false} />
              </mesh>
              <mesh ref={ringOuterRef}>
                <torusGeometry args={[1.25, 0.015, 12, 48]} />
                <meshBasicMaterial color="#c084fc" transparent opacity={0.7} toneMapped={false} />
              </mesh>
            </group>

            {/* Project Title Billboard */}
            <Billboard position={[0, 2.8, 1.8]}>
              <Text
                fontSize={0.36}
                color="#ffffff"
                anchorX="center"
                anchorY="bottom"
                outlineWidth={0.02}
                outlineColor="#000000"
              >
                {showcase.name.toUpperCase()}
              </Text>
              <Text
                position={[0, -0.06, 0]}
                fontSize={0.16}
                color="#38bdf8"
                anchorX="center"
                anchorY="top"
              >
                PROJEKTZIEL & ERGEBNISWERFT
              </Text>
            </Billboard>
          </group>

          {/* ================= 3. SEKTOR-DOCKS & ELEMENTE ================= */}
          {[
            { items: quellenItems, cfg: SECTOR_CONFIG.quellen },
            { items: werkstattItems, cfg: SECTOR_CONFIG.werkstatt },
            { items: ergebnisseItems, cfg: SECTOR_CONFIG.ergebnisse },
          ].map(({ items, cfg }, sIdx) => {
            return (
              <group key={sIdx}>
                {items.map((item, iIdx) => {
                  const angleSpread = 0.32;
                  const itemAngle = cfg.centerAngle - ((items.length - 1) * angleSpread) / 2 + iIdx * angleSpread;
                  const dist = cfg.radius;
                  const x = Math.cos(itemAngle) * dist;
                  const z = Math.sin(itemAngle) * dist;
                  const isHovered = hoveredNode === item.id;

                  return (
                    <group
                      key={item.id}
                      position={[x, 1.4, z]}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveItem(item);
                      }}
                      onPointerOver={() => {
                        setHoveredNode(item.id);
                        if (typeof document !== "undefined") document.body.style.cursor = "pointer";
                      }}
                      onPointerOut={() => {
                        setHoveredNode(null);
                        if (typeof document !== "undefined") document.body.style.cursor = "auto";
                      }}
                    >
                      <mesh position={[0, -0.9, 0]}>
                        <cylinderGeometry args={[0.3, 0.45, 0.8, 16]} />
                        <meshStandardMaterial color="#0a121e" roughness={0.4} metalness={0.7} />
                      </mesh>
                      <mesh position={[0, -0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[0.26, 0.42, 24]} />
                        <meshBasicMaterial color={cfg.color} transparent opacity={0.6} side={THREE.DoubleSide} />
                      </mesh>
                      <mesh position={[0, 0, 0]} scale={isHovered ? 1.25 : 1.0}>
                        <octahedronGeometry args={[0.32, 0]} />
                        <meshStandardMaterial
                          color={cfg.color}
                          emissive={cfg.color}
                          emissiveIntensity={isHovered ? 1.2 : 0.4}
                          roughness={0.2}
                          metalness={0.8}
                          wireframe={!isHovered}
                        />
                      </mesh>
                      <Billboard position={[0, 0.65, 0]}>
                        <Text
                          fontSize={0.2}
                          color="#ffffff"
                          anchorX="center"
                          anchorY="middle"
                          outlineWidth={0.015}
                          outlineColor="#000000"
                        >
                          {item.title}
                        </Text>
                        <Text
                          position={[0, -0.22, 0]}
                          fontSize={0.13}
                          color={cfg.color}
                          anchorX="center"
                          anchorY="middle"
                        >
                          {item.badge.toUpperCase()}
                        </Text>
                      </Billboard>
                    </group>
                  );
                })}
              </group>
            );
          })}
        </group>
      )}

      {/* ================= 2D-ARBEITSFLÄCHE IM RAUM ================= */}
      {(activeItem || activeMilestone) && (
        <ProjectWorkspaceModal
          item={activeItem}
          milestone={activeMilestone}
          onClose={() => {
            setActiveItem(null);
            setActiveMilestone(null);
          }}
        />
      )}

      {/* ================= ENDZIEL-BLAUPAUSEN-MODAL ================= */}
      {showEndzielModal && (
        <Html fullscreen style={{ pointerEvents: "auto", zIndex: 1000 }}>
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            onClick={() => setShowEndzielModal(false)}
          >
            <div
              className="relative flex max-h-[90vh] w-[min(94vw,980px)] flex-col overflow-hidden rounded-2xl border border-cyan-400/40 bg-[#060e1a]/95 p-6 shadow-2xl backdrop-blur-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-cyan-500/20 px-3 py-1 font-mono text-xs font-bold text-cyan-300 border border-cyan-500/40">
                    💎 ENDZIEL-BLAUPAUSE
                  </span>
                  <h2 className="text-lg font-bold text-white">Das Endziel von Hermes Agent OS</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEndzielModal(false)}
                  className="rounded-lg border border-white/15 px-3 py-1 font-mono text-xs text-white/60 hover:text-white"
                >
                  Schließen [Esc]
                </button>
              </div>

              <div className="my-6 overflow-y-auto">
                <iframe
                  src="http://localhost:3420/diagramm.html"
                  className="w-full h-[62vh] rounded-xl border border-white/10 bg-[#020612]"
                  title="Endziel Diagramm"
                />
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50 font-mono">
                <span>Hermes 3D · Transparente Obsidian-Glasplatte</span>
                <a
                  href="http://localhost:3420/diagramm.html"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-cyan-500/20 px-3 py-1 font-semibold text-cyan-300 hover:bg-cyan-500/30"
                >
                  Im Vollbild-Browser öffnen ↗
                </a>
              </div>
            </div>
          </div>
        </Html>
      )}
    </>
  );
}
