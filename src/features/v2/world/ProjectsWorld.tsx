"use client";

import { Billboard, Text } from "@react-three/drei";
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

/**
 * PROJEKTWELT & ERGEBNISWERFT (Antigravity Signature Design)
 *
 * Im Zentrum steht das Projekt mit seinem Ziel.
 * Drumherum liegen drei strukturierte Bereiche:
 *   1. 📂 QUELLEN (Inputs, Visionen, Vault-Dateien)
 *   2. 🛠️ WERKSTATT (Code, Entwürfe, Workflows)
 *   3. 🏆 ERGEBNISSE (Deliverables, Releases, Audits)
 *
 * Flankiert von:
 *   - Dem Erinnerungsorbit (Zeitleiste mit belegten Meilensteinen)
 *   - Der Council-Entscheidungsstation (Status & Voten der 4 KI-Agenten)
 *   - Der scharfen 2D-Arbeitsfläche direkt im 3D-Raum (ProjectWorkspaceModal)
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
  const [activeProjectKey, setActiveProjectKey] = useState<string>("01 Hermes Agent OS");
  const [activeItem, setActiveItem] = useState<ProjectSectorItem | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<TimelineMilestone | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const showcase: ProjectShowcase =
    SHOWCASE_PROJECTS[activeProjectKey] || SHOWCASE_PROJECTS["01 Hermes Agent OS"];

  // Refs for dynamic animations
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

  // Sector Angles in the shipyard (120 degrees apart)
  // Quellen: Left-Front (-150°), Werkstatt: Right-Front (-30°), Ergebnisse: Back (90°)
  const SECTOR_CONFIG = {
    quellen: { centerAngle: (Math.PI * 7) / 6, radius: 8.8, color: "#38bdf8", label: "📂 QUELLEN & INPUTS" },
    werkstatt: { centerAngle: -(Math.PI * 1) / 6, radius: 8.8, color: "#fbbf24", label: "🛠️ WERKSTATT & ENTWÜRFE" },
    ergebnisse: { centerAngle: Math.PI / 2, radius: 8.8, color: "#34d399", label: "🏆 ERGEBNISSE & RELEASES" },
  };

  return (
    <>
      <group>
        {/* ================= 1. THE SHIPYARD FOUNDATION ================= */}
        {/* Outer Dock Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
          <ringGeometry args={[11.5, 12.2, 64]} />
          <meshBasicMaterial color="#1e293b" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>

        {/* Main Dock Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
          <circleGeometry args={[12.5, 64]} />
          <meshStandardMaterial color="#050a12" roughness={0.7} metalness={0.4} />
        </mesh>

        {/* Glowing Sector Indicator Rays on Floor */}
        {[SECTOR_CONFIG.quellen, SECTOR_CONFIG.werkstatt, SECTOR_CONFIG.ergebnisse].map((sec, idx) => {
          const x = Math.cos(sec.centerAngle) * 5.8;
          const z = Math.sin(sec.centerAngle) * 5.8;
          return (
            <group key={idx}>
              <mesh position={[x / 2, -0.05, z / 2]} rotation={[-Math.PI / 2, 0, -sec.centerAngle]}>
                <planeGeometry args={[5.8, 0.08]} />
                <meshBasicMaterial color={sec.color} transparent opacity={0.4} />
              </mesh>
              {/* Sector Platform */}
              <mesh position={[x * 1.5, -0.03, z * 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.5, 2.7, 36]} />
                <meshBasicMaterial color={sec.color} transparent opacity={0.5} side={THREE.DoubleSide} />
              </mesh>
              {/* Sector Label on Floor */}
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

        {/* ================= 2. ZENTRALER PROJEKT-KERN (MONOLITH) ================= */}
        <group position={[0, 0, 0]}>
          {/* Core Pedestal */}
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
            {/* Spinning Energy Rings */}
            <mesh ref={ringInnerRef}>
              <torusGeometry args={[1.05, 0.02, 12, 48]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} toneMapped={false} />
            </mesh>
            <mesh ref={ringOuterRef}>
              <torusGeometry args={[1.25, 0.015, 12, 48]} />
              <meshBasicMaterial color="#c084fc" transparent opacity={0.7} toneMapped={false} />
            </mesh>
          </group>

          {/* Project Title & Goal Billboard */}
          <Billboard position={[0, 4.4, 0]}>
            <Text
              fontSize={0.44}
              color="#ffffff"
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.02}
              outlineColor="#000000"
            >
              {showcase.name.toUpperCase()}
            </Text>
            <Text
              position={[0, -0.08, 0]}
              fontSize={0.2}
              color="#38bdf8"
              anchorX="center"
              anchorY="top"
              outlineWidth={0.012}
              outlineColor="#000000"
            >
              PROJEKTZIEL & ERGEBNISWERFT
            </Text>
            <Text
              position={[0, -0.42, 0]}
              fontSize={0.14}
              color="#94a3b8"
              anchorX="center"
              anchorY="top"
              maxWidth={5.5}
              textAlign="center"
              outlineWidth={0.008}
              outlineColor="#000000"
            >
              {showcase.goal}
            </Text>

            {/* Project Switcher Buttons */}
            <Text
              position={[-1.6, -1.1, 0]}
              fontSize={0.16}
              color={activeProjectKey === "01 Hermes Agent OS" ? "#38bdf8" : "#64748b"}
              anchorX="center"
              anchorY="top"
              outlineWidth={0.01}
              outlineColor="#000000"
              onClick={(e) => {
                e.stopPropagation();
                setActiveProjectKey("01 Hermes Agent OS");
              }}
              onPointerOver={() => {
                if (typeof document !== "undefined") document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                if (typeof document !== "undefined") document.body.style.cursor = "auto";
              }}
            >
              [ 1. Hermes Agent OS ]
            </Text>
            <Text
              position={[1.6, -1.1, 0]}
              fontSize={0.16}
              color={activeProjectKey === "02 Company OS" ? "#38bdf8" : "#64748b"}
              anchorX="center"
              anchorY="top"
              outlineWidth={0.01}
              outlineColor="#000000"
              onClick={(e) => {
                e.stopPropagation();
                setActiveProjectKey("02 Company OS");
              }}
              onPointerOver={() => {
                if (typeof document !== "undefined") document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                if (typeof document !== "undefined") document.body.style.cursor = "auto";
              }}
            >
              [ 2. Company OS Filmstudio ]
            </Text>
          </Billboard>
        </group>

        {/* ================= 3. SECTOR ITEMS (QUELLEN, WERKSTATT, ERGEBNISSE) ================= */}
        {/* Render item nodes distributed within their sectors */}
        {[
          { items: quellenItems, cfg: SECTOR_CONFIG.quellen },
          { items: werkstattItems, cfg: SECTOR_CONFIG.werkstatt },
          { items: ergebnisseItems, cfg: SECTOR_CONFIG.ergebnisse },
        ].map(({ items, cfg }, sIdx) => {
          return items.map((item, iIdx) => {
            // Arc spread around sector center angle
            const count = Math.max(1, items.length);
            const spread = (iIdx - (count - 1) / 2) * 0.28;
            const angle = cfg.centerAngle + spread;
            const dist = cfg.radius + ((iIdx % 2) * 1.4 - 0.7);
            const px = Math.cos(angle) * dist;
            const pz = Math.sin(angle) * dist;
            const isHovered = hoveredNode === item.id;

            return (
              <group
                key={item.id}
                position={[px, 0, pz]}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveItem(item);
                  setActiveMilestone(null);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredNode(item.id);
                  if (typeof document !== "undefined") document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                  setHoveredNode(null);
                  if (typeof document !== "undefined") document.body.style.cursor = "auto";
                }}
              >
                {/* Vertical Light Beacon */}
                <mesh position={[0, 1.2, 0]}>
                  <cylinderGeometry args={[0.02, 0.04, 2.4, 8]} />
                  <meshBasicMaterial
                    color={cfg.color}
                    transparent
                    opacity={isHovered ? 0.9 : 0.45}
                  />
                </mesh>

                {/* Pedestal Base */}
                <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.42, 0.5, 0.2, 16]} />
                  <meshStandardMaterial
                    color="#0b131e"
                    roughness={0.4}
                    metalness={0.6}
                  />
                </mesh>

                {/* Holographic Data Disc */}
                <mesh position={[0, isHovered ? 1.65 : 1.45, 0]} rotation={[0, 0, 0]}>
                  <boxGeometry args={[0.34, 0.34, 0.34]} />
                  <meshStandardMaterial
                    color={cfg.color}
                    emissive={cfg.color}
                    emissiveIntensity={isHovered ? 1.2 : 0.65}
                    wireframe={!isHovered}
                  />
                </mesh>

                {/* Ring Pulse */}
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.55, 0.68, 24]} />
                  <meshBasicMaterial
                    color={cfg.color}
                    transparent
                    opacity={isHovered ? 0.9 : 0.4}
                    side={THREE.DoubleSide}
                  />
                </mesh>

                {/* Billboard Label */}
                <Billboard position={[0, 2.35, 0]}>
                  <Text
                    fontSize={0.16}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="bottom"
                    outlineWidth={0.012}
                    outlineColor="#000000"
                    maxWidth={2.8}
                    textAlign="center"
                  >
                    {item.title}
                  </Text>
                  <Text
                    position={[0, -0.04, 0]}
                    fontSize={0.11}
                    color={cfg.color}
                    anchorX="center"
                    anchorY="top"
                    outlineWidth={0.008}
                    outlineColor="#000000"
                  >
                    [{item.badge}] · {item.date}
                  </Text>
                  {isHovered && (
                    <Text
                      position={[0, -0.22, 0]}
                      fontSize={0.095}
                      color="#cbd5e1"
                      anchorX="center"
                      anchorY="top"
                      outlineWidth={0.006}
                      outlineColor="#000000"
                    >
                      Klicken zum Öffnen (2D-Arbeitsfläche)
                    </Text>
                  )}
                </Billboard>
              </group>
            );
          });
        })}

        {/* ================= 4. ERINNERUNGSORBIT (ZEITLEISTE) ================= */}
        <group ref={timelineGroupRef} position={[0, 0.6, 0]}>
          {showcase.timeline.map((m, idx) => {
            // Arc along the front edge
            const count = showcase.timeline.length;
            const arcAngle = -Math.PI * 0.7 + (idx / Math.max(1, count - 1)) * Math.PI * 0.4;
            const tx = Math.cos(arcAngle) * 6.5;
            const tz = Math.sin(arcAngle) * 6.5;
            const isHovered = hoveredNode === m.id;

            return (
              <group
                key={m.id}
                position={[tx, 0.3, tz]}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMilestone(m);
                  setActiveItem(null);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredNode(m.id);
                  if (typeof document !== "undefined") document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                  setHoveredNode(null);
                  if (typeof document !== "undefined") document.body.style.cursor = "auto";
                }}
              >
                {/* Milestone Node Sphere */}
                <mesh position={[0, 0, 0]}>
                  <sphereGeometry args={[isHovered ? 0.22 : 0.16, 16, 16]} />
                  <meshStandardMaterial
                    color={m.color}
                    emissive={m.color}
                    emissiveIntensity={isHovered ? 1.4 : 0.8}
                  />
                </mesh>

                {/* Milestone Billboard */}
                <Billboard position={[0, 0.45, 0]}>
                  <Text
                    fontSize={0.12}
                    color="#f8fafc"
                    anchorX="center"
                    anchorY="bottom"
                    outlineWidth={0.008}
                    outlineColor="#000000"
                  >
                    {m.date}
                  </Text>
                  <Text
                    position={[0, -0.02, 0]}
                    fontSize={0.11}
                    color={m.color}
                    anchorX="center"
                    anchorY="top"
                    outlineWidth={0.007}
                    outlineColor="#000000"
                    maxWidth={1.8}
                    textAlign="center"
                  >
                    {m.title}
                  </Text>
                </Billboard>
              </group>
            );
          })}
        </group>

        {/* ================= 5. COUNCIL & ENTSCHEIDUNGSSTATION ================= */}
        <group position={[0, 0, -4.5]}>
          {/* Council Table Pad */}
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.5, 1.8, 32]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <Billboard position={[0, 1.8, 0]}>
            <Text
              fontSize={0.24}
              color="#c084fc"
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.012}
              outlineColor="#000000"
            >
              COUNCIL-ENTSCHEIDUNGSSTATION
            </Text>
            <Text
              position={[0, -0.04, 0]}
              fontSize={0.13}
              color="#e2e8f0"
              anchorX="center"
              anchorY="top"
              outlineWidth={0.008}
              outlineColor="#000000"
            >
              Konsens: Werft freigegeben & aktiv
            </Text>
          </Billboard>

          {/* 4 Agent Pedestals */}
          {showcase.council.map((agent, aIdx) => {
            const agAngle = -Math.PI * 0.75 + (aIdx / 3) * Math.PI * 0.5;
            const ax = Math.cos(agAngle) * 1.6;
            const az = Math.sin(agAngle) * 1.6;

            return (
              <group key={agent.provider} position={[ax, 0, az]}>
                <mesh position={[0, 0.25, 0]}>
                  <cylinderGeometry args={[0.18, 0.22, 0.5, 16]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.5} />
                </mesh>
                <mesh position={[0, 0.65, 0]}>
                  <sphereGeometry args={[0.08, 12, 10]} />
                  <meshStandardMaterial
                    color={agent.tone}
                    emissive={agent.tone}
                    emissiveIntensity={0.8}
                  />
                </mesh>
                <Billboard position={[0, 0.95, 0]}>
                  <Text
                    fontSize={0.11}
                    color={agent.tone}
                    anchorX="center"
                    anchorY="bottom"
                    outlineWidth={0.006}
                    outlineColor="#000000"
                  >
                    {agent.name}
                  </Text>
                  <Text
                    position={[0, -0.02, 0]}
                    fontSize={0.085}
                    color="#94a3b8"
                    anchorX="center"
                    anchorY="top"
                    outlineWidth={0.005}
                    outlineColor="#000000"
                  >
                    {agent.role}
                  </Text>
                </Billboard>
              </group>
            );
          })}
        </group>
      </group>

      {/* ================= 6. SCHARFE 2D-ARBEITSFLÄCHE IM RAUM ================= */}
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
    </>
  );
}
