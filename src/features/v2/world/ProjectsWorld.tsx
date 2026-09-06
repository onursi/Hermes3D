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

  // Animation refs
  const coreRef = useRef<THREE.Group>(null);
  const ringInnerRef = useRef<THREE.Mesh>(null);
  const ringOuterRef = useRef<THREE.Mesh>(null);

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
    quellen: { centerAngle: (Math.PI * 7) / 6, radius: 9.2, color: "#38bdf8", label: "📂 QUELLEN & INPUTS" },
    werkstatt: { centerAngle: -(Math.PI * 1) / 6, radius: 9.2, color: "#fbbf24", label: "🛠️ WERKSTATT & ENTWÜRFE" },
    ergebnisse: { centerAngle: Math.PI / 2, radius: 9.2, color: "#34d399", label: "🏆 ERGEBNISSE & RELEASES" },
  };

  return (
    <>
      {/* ================= 4D INTERSTELLAR TESSERACT MODE ================= */}
      {worldMode === "tesseract" ? (
        <group>
          <TesseractMemoryWorld onClose={() => setWorldMode("werft")} />

          {/* 3D Floating Return Button */}
          <Billboard position={[0, 1.2, 5]}>
            <group
              onClick={(e) => {
                e.stopPropagation();
                setWorldMode("werft");
              }}
              onPointerOver={() => {
                if (typeof document !== "undefined") document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                if (typeof document !== "undefined") document.body.style.cursor = "auto";
              }}
            >
              <mesh>
                <planeGeometry args={[3.6, 0.7]} />
                <meshBasicMaterial color="#0284c7" transparent opacity={0.9} />
              </mesh>
              <Text fontSize={0.22} color="#ffffff" anchorX="center" anchorY="middle" position={[0, 0, 0.02]}>
                [ 🚢 Zurück zur Werft ]
              </Text>
            </group>
          </Billboard>
        </group>
      ) : (
        /* ================= SHIPYARD & MONUMENT MODE ================= */
        <group>
          {/* Dock Foundation Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
            <ringGeometry args={[12.0, 13.0, 64]} />
            <meshBasicMaterial color="#1e293b" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
            <circleGeometry args={[13.5, 64]} />
            <meshStandardMaterial color="#050a12" roughness={0.7} metalness={0.4} />
          </mesh>

          {/* Sector Floor Indicators */}
          {[SECTOR_CONFIG.quellen, SECTOR_CONFIG.werkstatt, SECTOR_CONFIG.ergebnisse].map((sec, idx) => {
            const x = Math.cos(sec.centerAngle) * 6.5;
            const z = Math.sin(sec.centerAngle) * 6.5;
            return (
              <group key={idx}>
                <mesh position={[x / 2, -0.05, z / 2]} rotation={[-Math.PI / 2, 0, -sec.centerAngle]}>
                  <planeGeometry args={[6.5, 0.08]} />
                  <meshBasicMaterial color={sec.color} transparent opacity={0.4} />
                </mesh>
                <mesh position={[x * 1.45, -0.03, z * 1.45]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[2.8, 3.0, 36]} />
                  <meshBasicMaterial color={sec.color} transparent opacity={0.5} side={THREE.DoubleSide} />
                </mesh>
                <Billboard position={[x * 1.45, 0.15, z * 1.45]}>
                  <Text fontSize={0.28} color={sec.color} anchorX="center" anchorY="middle" outlineWidth={0.015} outlineColor="#000000">
                    {sec.label}
                  </Text>
                </Billboard>
              </group>
            );
          })}

          {/* ================= 3D NAVIGATION CONSOLE (FOREGROUND) ================= */}
          <Billboard position={[0, 1.1, 4.2]}>
            <group position={[0, 0, 0]}>
              {/* Button 1: Endziel-Glasplatte öffnen */}
              <group
                position={[-2.4, 0, 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEndzielModal(true);
                }}
                onPointerOver={() => { if (typeof document !== "undefined") document.body.style.cursor = "pointer"; }}
                onPointerOut={() => { if (typeof document !== "undefined") document.body.style.cursor = "auto"; }}
              >
                <mesh>
                  <planeGeometry args={[2.3, 0.55]} />
                  <meshBasicMaterial color="#0284c7" transparent opacity={0.85} />
                </mesh>
                <Text fontSize={0.16} color="#ffffff" anchorX="center" anchorY="middle" position={[0, 0, 0.02]}>
                  💎 Endziel-Blueprint
                </Text>
              </group>

              {/* Button 2: 4D-Erinnerungsraum betreten */}
              <group
                position={[2.4, 0, 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  setWorldMode("tesseract");
                }}
                onPointerOver={() => { if (typeof document !== "undefined") document.body.style.cursor = "pointer"; }}
                onPointerOut={() => { if (typeof document !== "undefined") document.body.style.cursor = "auto"; }}
              >
                <mesh>
                  <planeGeometry args={[2.8, 0.55]} />
                  <meshBasicMaterial color="#9333ea" transparent opacity={0.85} />
                </mesh>
                <Text fontSize={0.16} color="#ffffff" anchorX="center" anchorY="middle" position={[0, 0, 0.02]}>
                  🪐 4D-Tesserakt (Interstellar)
                </Text>
              </group>
            </group>
          </Billboard>

          {/* ================= MONUMENTALE OBSIDIAN-GLASPLATTE (HINTERGRUND) ================= */}
          <group position={[0, 5.0, -8.2]}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setShowEndzielModal(true);
              }}
              onPointerOver={() => { if (typeof document !== "undefined") document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { if (typeof document !== "undefined") document.body.style.cursor = "auto"; }}
            >
              <planeGeometry args={[9.2, 4.4]} />
              <meshPhysicalMaterial
                color="#030814"
                roughness={0.1}
                metalness={0.2}
                transmission={0.8}
                thickness={0.6}
                transparent
                opacity={0.88}
                clearcoat={1}
                reflectivity={0.9}
              />
            </mesh>

            {/* Glowing Neon Border */}
            <lineSegments>
              <edgesGeometry args={[new THREE.PlaneGeometry(9.22, 4.42)]} />
              <lineBasicMaterial color="#00f0ff" transparent opacity={0.8} />
            </lineSegments>

            {/* Inscribed 3D Blueprint on Glass */}
            <Text position={[0, 1.5, 0.05]} fontSize={0.36} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#020612">
              💎 DAS ENDZIEL // HERMES AGENT OS
            </Text>

            <Text position={[0, 0.95, 0.05]} fontSize={0.18} color="#00f0ff" anchorX="center" anchorY="middle">
              SPRACHE (ONUR) ➔ KI-COUNCIL ➔ OBSIDIAN VAULT ➔ 3D-WELTEN ➔ REALE RESULTATE
            </Text>

            <Text position={[0, 0.35, 0.05]} fontSize={0.15} color="#cbd5e1" maxWidth={7.8} textAlign="center" lineHeight={1.45} anchorX="center" anchorY="middle">
              Du sprichst einfach deine Gedanken und Visionen ein. Das KI-Team (Claude, Antigravity, Codex) erledigt die Umsetzung. Dein Kopf bleibt frei.
            </Text>

            {/* Clickable Blueprint Trigger */}
            <group
              position={[0, -1.2, 0.06]}
              onClick={(e) => {
                e.stopPropagation();
                setShowEndzielModal(true);
              }}
            >
              <mesh>
                <planeGeometry args={[3.8, 0.6]} />
                <meshBasicMaterial color="#0284c7" transparent opacity={0.9} />
              </mesh>
              <Text fontSize={0.2} color="#ffffff" anchorX="center" anchorY="middle" position={[0, 0, 0.02]}>
                [ 💎 Klicke hier: Blueprint öffnen ]
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
                <meshStandardMaterial color="#0284c7" emissive="#38bdf8" emissiveIntensity={0.8} roughness={0.15} metalness={0.9} wireframe />
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
            <Billboard position={[0, 3.4, 0]}>
              <Text fontSize={0.42} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.02} outlineColor="#000000">
                {showcase.name.toUpperCase()}
              </Text>
              <Text position={[0, -0.08, 0]} fontSize={0.18} color="#38bdf8" anchorX="center" anchorY="top">
                PROJEKTZIEL & ERGEBNISWERFT
              </Text>
            </Billboard>
          </group>

          {/* ================= 3. SEKTOR-DOCKS & ELEMENTE (SAUBER GESTAFFELT) ================= */}
          {[
            { items: quellenItems, cfg: SECTOR_CONFIG.quellen },
            { items: werkstattItems, cfg: SECTOR_CONFIG.werkstatt },
            { items: ergebnisseItems, cfg: SECTOR_CONFIG.ergebnisse },
          ].map(({ items, cfg }, sIdx) => {
            return (
              <group key={sIdx}>
                {items.map((item, iIdx) => {
                  const angleSpread = 0.44;
                  const itemAngle = cfg.centerAngle - ((items.length - 1) * angleSpread) / 2 + iIdx * angleSpread;
                  // Stagger radius to prevent text collision
                  const dist = cfg.radius + (iIdx % 2 === 0 ? 0.7 : -0.7);
                  const x = Math.cos(itemAngle) * dist;
                  const z = Math.sin(itemAngle) * dist;
                  const isHovered = hoveredNode === item.id;

                  // Clean short title
                  const cleanTitle = item.title.length > 24 ? item.title.slice(0, 22) + "…" : item.title;

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
                          fontSize={0.16}
                          color="#ffffff"
                          anchorX="center"
                          anchorY="middle"
                          maxWidth={2.4}
                          textAlign="center"
                          outlineWidth={0.015}
                          outlineColor="#000000"
                        >
                          {cleanTitle}
                        </Text>
                        <Text
                          position={[0, -0.22, 0]}
                          fontSize={0.12}
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
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(12px)",
              padding: "1rem",
            }}
            onClick={() => setShowEndzielModal(false)}
          >
            <div
              style={{
                position: "relative",
                width: "min(96vw, 1080px)",
                height: "min(90vh, 760px)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: "20px",
                border: "1px solid rgba(0, 240, 255, 0.4)",
                backgroundColor: "rgba(6, 14, 28, 0.98)",
                boxShadow: "0 25px 80px rgba(0,0,0,0.9)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem 1.5rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span
                    style={{
                      backgroundColor: "rgba(0, 240, 255, 0.15)",
                      color: "#00f0ff",
                      border: "1px solid rgba(0, 240, 255, 0.4)",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "9999px",
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                    }}
                  >
                    💎 ENDZIEL-BLAUPAUSE
                  </span>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#fff", margin: 0 }}>
                    Hermes Agent OS auf 1 Blick
                  </h2>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <a
                    href="http://localhost:3420/diagramm.html"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#94a3b8",
                      padding: "0.35rem 0.85rem",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      textDecoration: "none",
                    }}
                  >
                    Vollbild ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowEndzielModal(false)}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      padding: "0.35rem 0.85rem",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    Schließen [Esc]
                  </button>
                </div>
              </div>

              {/* Embed the interactive diagram cleanly */}
              <iframe
                src="http://localhost:3420/diagramm.html"
                style={{
                  width: "100%",
                  flex: 1,
                  border: "none",
                  backgroundColor: "#020612",
                }}
                title="Endziel Diagramm"
              />
            </div>
          </div>
        </Html>
      )}
    </>
  );
}
