"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { atelierAudio } from "./atelierAudio";

export type IdeaItem = {
  id: string;
  title: string;
  category: "open" | "discarded" | "inbox";
  summary: string;
  date?: string;
  phase: number;
  phaseName: string;
  reife: number;
  status: "active" | "parked" | "discarded" | "promoted";
  decisionDeadline?: string;
  sourceFile: string;
  learning?: string;
  sourceGround?: "quran" | "hadith" | "interpretation" | "general";
  tags?: string[];
};

const EXITS = [
  { id: "singularity", label: "In Singularität starten", icon: "🚀", color: "#38bdf8", desc: "Befördert die Idee auf Orbit 1 als echtes Vorhaben." },
  { id: "moon", label: "Als Mond andocken", icon: "🪐", color: "#a855f7", desc: "Wird zum Teilziel eines bestehenden Projektplaneten." },
  { id: "wissen", label: "Ins Wissensnetz", icon: "📚", color: "#34d399", desc: "Übertragen nach 07🧠Wissen oder 06💡Interessen." },
  { id: "discard", label: "Erkenntnis-Bucht (Verwerfen)", icon: "💎", color: "#f59e0b", desc: "Erlischt mit 1 Satz Learning im Bernstein-Monument." },
  { id: "park", label: "Entscheidungsfrist setzen", icon: "⏳", color: "#fbbf24", desc: "Setzt ein festes Prüfdatum (Anti-Backlog-Frist)." },
  { id: "delegate", label: "Menschliche Übergabe", icon: "🤝", color: "#ec4899", desc: "Delegieren an Partner, Team oder Familie." },
];

const DEFAULT_IDEAS: IdeaItem[] = [
  {
    id: "youtube-3d-hadith-welten",
    title: "YouTube: Begehbare 3D-Räume nach Hadithen",
    category: "inbox",
    phase: 3,
    phaseName: "Silhouette",
    reife: 0.38,
    status: "active",
    decisionDeadline: "2026-09-21",
    sourceFile: "00📥Inbox/Idee.md",
    summary: "3D-Räume zu religiösen Szenen (Sirat-Brücke, Leben im Grab, Tag des Gerichts) nach Koran & authentischen Hadithen. Kreative Kunst & Dramaturgie, um Visualisierungen aus dem Kopf in Realität sichtbar zu machen.",
    sourceGround: "quran",
    tags: ["youtube", "religion", "hadith", "3d"]
  },
  {
    id: "ki-kontingent-sparen",
    title: "KI-Kontingent (Claude/GPT) schonen",
    category: "open",
    phase: 1,
    phaseName: "Funke",
    reife: 0.15,
    status: "active",
    decisionDeadline: "2026-09-18",
    sourceFile: "09🅿️Ideenparkplatz/Ideen.md",
    summary: "Triage-Workflow zur Entlastung des Hauptkontingents: Mechanische/repetitive Aufgaben an kostenlose Open-Code-Modelle auslagern, anspruchsvolle Systemarchitektur im Kern belassen.",
    tags: ["ki", "kontingent"]
  },
  {
    id: "journal-anwendung-mizan",
    title: "Journal-Anwendung statt Goodnotes",
    category: "open",
    phase: 5,
    phaseName: "Reality Check",
    reife: 0.68,
    status: "active",
    decisionDeadline: "2026-09-25",
    sourceFile: "09🅿️Ideenparkplatz/Ideen.md",
    summary: "MIZAN Daily Journal: 20-Tage Reflexionsjournal (Dankbarkeit, Fokus, 99 Namen, Qur'an-Vers) als fehlerfreie Web-App oder Goodnotes-PDF direkt mit Obsidian LifeOS synchronisiert.",
    tags: ["journal", "mizan"]
  },
  {
    id: "kanban-workflow-optimieren",
    title: "Kanban-Workflow optimieren",
    category: "open",
    phase: 4,
    phaseName: "Formung",
    reife: 0.52,
    status: "active",
    decisionDeadline: "2026-09-30",
    sourceFile: "09🅿️Ideenparkplatz/Ideen.md",
    summary: "Trennung von geschäftlichen und privaten Boards. KI-priorisierte To-do-Vorschläge und nahtlose Verknüpfung mit Projektordnern.",
    tags: ["kanban"]
  },
  {
    id: "tiktok-kanal-automation",
    title: "TikTok-Kanal für Automation & Content",
    category: "open",
    phase: 1,
    phaseName: "Funke",
    reife: 0.12,
    status: "active",
    decisionDeadline: "2026-10-05",
    sourceFile: "09🅿️Ideenparkplatz/Ideen.md",
    summary: "Erfolgreiche Automatisierungs-Workflows (Bewerbungsprozesse, Agenten) als kurzen, lehrreichen Video-Content für Reichweite und Vertrauen aufbereiten.",
    tags: ["tiktok", "content"]
  }
];

/** Morphing visual idea body based on reife level */
function MorphingIdeaBody({
  reife,
  isSelected,
  onClick,
  isHovered,
}: {
  reife: number;
  isSelected: boolean;
  onClick: () => void;
  isHovered: boolean;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * (0.4 + reife * 0.6);
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;

    if (ring1Ref.current) ring1Ref.current.rotation.x += delta * 1.2;
    if (ring2Ref.current) ring2Ref.current.rotation.y += delta * 1.5;
  });

  // Color gradient from Amber/Gold to Radiant Cyan as maturity increases
  const color = useMemo(() => {
    if (reife < 0.3) return "#e0a93f"; // Gold spark
    if (reife < 0.6) return "#f59e0b"; // Amber formation
    if (reife < 0.85) return "#00f0ff"; // Cyan prototype
    return "#38bdf8"; // Deep crystalline singularity planet
  }, [reife]);

  const scale = isSelected ? 1.35 : isHovered ? 1.15 : 1.0;

  return (
    <group ref={meshRef} onClick={(e) => { e.stopPropagation(); onClick(); }} scale={scale}>
      {/* Phase 1 & 2: Spark & Nebulous Cloud (reife < 0.35) */}
      {reife < 0.35 && (
        <>
          <mesh>
            <sphereGeometry args={[0.35 + reife * 0.4, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.8}
              transparent
              opacity={0.65}
              wireframe={reife < 0.2}
            />
          </mesh>
          <pointLight color={color} intensity={1.8} distance={3.5} />
        </>
      )}

      {/* Phase 3 & 4: Wireframe Silhouette & Faceted Form (0.35 <= reife < 0.65) */}
      {reife >= 0.35 && reife < 0.65 && (
        <>
          <mesh>
            <icosahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.6}
              roughness={0.2}
              metalness={0.8}
              flatShading
            />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.62, 0]} />
            <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.35} />
          </mesh>
          <pointLight color={color} intensity={2.2} distance={4} />
        </>
      )}

      {/* Phase 5 & 6: Reality Check Gimbal & Prototype (0.65 <= reife < 0.90) */}
      {reife >= 0.65 && reife < 0.9 && (
        <>
          <mesh>
            <octahedronGeometry args={[0.62, 0]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.9}
              roughness={0.1}
              metalness={0.95}
            />
          </mesh>
          {/* Reality Check evaluation rings */}
          <mesh ref={ring1Ref}>
            <torusGeometry args={[0.85, 0.02, 16, 40]} />
            <meshBasicMaterial color="#e0a93f" transparent opacity={0.7} />
          </mesh>
          <mesh ref={ring2Ref}>
            <torusGeometry args={[1.05, 0.018, 16, 40]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.7} />
          </mesh>
          <pointLight color={color} intensity={3.0} distance={5} />
        </>
      )}

      {/* Phase 7: Reife Idee / Mini Planet (reife >= 0.90) */}
      {reife >= 0.9 && (
        <>
          <mesh>
            <sphereGeometry args={[0.7, 32, 32]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={1.2}
              roughness={0.2}
              metalness={0.6}
            />
          </mesh>
          {/* Energy Atmosphere */}
          <mesh scale={1.18}>
            <sphereGeometry args={[0.7, 32, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} wireframe />
          </mesh>
          <pointLight color="#38bdf8" intensity={4.5} distance={6} />
        </>
      )}
    </group>
  );
}

export function IdeenatelierWorld() {
  const [ideas, setIdeas] = useState<IdeaItem[]>(DEFAULT_IDEAS);
  const [selectedId, setSelectedId] = useState<string>("youtube-3d-hadith-welten");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [currentReife, setCurrentReife] = useState<number>(0.38);
  const [activeGround, setActiveGround] = useState<"quran" | "hadith" | "interpretation">("quran");
  const [exitNotice, setExitNotice] = useState<string | null>(null);

  // Audio start & stop
  useEffect(() => {
    atelierAudio.startForgeDrone();
    return () => {
      atelierAudio.stopForgeDrone();
    };
  }, []);

  // Fetch Ideas from Vault API
  useEffect(() => {
    fetch("/api/vault/ideas")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.ideas) {
          setIdeas(data.ideas);
          const first = data.ideas.find((i: IdeaItem) => i.id === "youtube-3d-hadith-welten") || data.ideas[0];
          if (first) {
            setSelectedId(first.id);
            setCurrentReife(first.reife);
          }
        }
      })
      .catch((err) => console.error("Error loading ideas:", err));
  }, []);

  const selectedIdea = useMemo(() => {
    return ideas.find((i) => i.id === selectedId) || ideas[0] || null;
  }, [ideas, selectedId]);

  // Sync reife when selecting an idea
  const handleSelectIdea = (idea: IdeaItem) => {
    setSelectedId(idea.id);
    setCurrentReife(idea.reife);
    atelierAudio.playReifeChime(idea.reife);
  };

  const handleReifeChange = (newReife: number) => {
    setCurrentReife(newReife);
    atelierAudio.playReifeChime(newReife);
  };

  const handleExitClick = (exitId: string) => {
    atelierAudio.playExitSound(exitId);
    const exit = EXITS.find((e) => e.id === exitId);
    setExitNotice(`${exit?.icon} Ausgang "${exit?.label}" für "${selectedIdea?.title}" ausgelöst!`);
    setTimeout(() => setExitNotice(null), 4000);

    // Call POST API
    fetch("/api/vault/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "exit_action",
        ideaId: selectedId,
        exitId,
        reife: currentReife,
      }),
    }).catch(console.error);
  };

  const handleGroundStep = (ground: "quran" | "hadith" | "interpretation") => {
    setActiveGround(ground);
    atelierAudio.playGroundStep(ground);
  };

  // 3D positioning: Arrange open ideas in a gentle horseshoe arc around the workbench
  const openIdeas = useMemo(() => {
    return ideas.filter((i) => i.category === "open" || i.category === "inbox");
  }, [ideas]);

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Ambient Forge Lights */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 12, 6]} intensity={1.5} color="#fff8e7" />
      <pointLight position={[0, 4.5, 0]} intensity={2.2} color="#e0a93f" distance={14} />
      <pointLight position={[0, -2, 0]} intensity={1.2} color="#c8603c" distance={8} />

      {/* 2. Floating Workbench Platform (Schwebende Werkbank) */}
      <group position={[0, 0, 0]}>
        {/* Main dark glass hexagonal slab */}
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[5.2, 5.6, 0.4, 6]} />
          <meshStandardMaterial
            color="#14120e"
            roughness={0.25}
            metalness={0.8}
          />
        </mesh>
        {/* Glowing Amber Trim */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[5.25, 5.25, 0.04, 6]} />
          <meshBasicMaterial color="#e0a93f" wireframe transparent opacity={0.6} />
        </mesh>

        {/* Central Inspection Pedestal */}
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[1.2, 1.4, 0.7, 32]} />
          <meshStandardMaterial color="#1d1a15" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.71, 0]}>
          <cylinderGeometry args={[1.22, 1.22, 0.02, 32]} />
          <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={0.7} />
        </mesh>

        {/* Selected Idea Floating in Center of Workbench */}
        {selectedIdea && (
          <group position={[0, 2.0, 0]}>
            <MorphingIdeaBody
              reife={currentReife}
              isSelected={true}
              onClick={() => {}}
              isHovered={false}
            />
            {/* Hologram Label Above */}
            <Html position={[0, 1.3, 0]} center distanceFactor={14}>
              <div className="bg-[#0a1018]/95 border border-cyan-400/40 rounded-lg px-3 py-1.5 shadow-[0_0_20px_rgba(0,240,255,0.25)] text-center pointer-events-none whitespace-nowrap">
                <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                  STUFE {Math.min(7, Math.max(1, Math.ceil(currentReife * 7)))} • {
                    ["Funke", "Gedankenwolke", "Silhouette", "Formung", "Reality Check", "Prototype Gate", "Reife Idee"][
                      Math.min(6, Math.floor(currentReife * 7))
                    ]
                  }
                </div>
                <div className="text-xs font-semibold text-white tracking-wide">{selectedIdea.title}</div>
              </div>
            </Html>
          </group>
        )}
      </group>

      {/* 3. Orbiting Pedestals for Open Ideas (Horseshoe Arc) */}
      <group position={[0, 0, 0]}>
        {openIdeas.map((idea, idx) => {
          if (idea.id === selectedId) return null; // Already mounted on main inspection desk
          const total = Math.max(1, openIdeas.length - 1);
          const angle = -Math.PI * 0.75 + (idx / total) * Math.PI * 1.5;
          const radius = 4.2;
          const x = Math.sin(angle) * radius;
          const z = Math.cos(angle) * radius;
          const isHovered = hoveredId === idea.id;

          return (
            <group
              key={idea.id}
              position={[x, 0.3, z]}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId(idea.id); }}
              onPointerOut={() => setHoveredId(null)}
            >
              {/* Pedestal Stand */}
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.32, 0.4, 0.6, 16]} />
                <meshStandardMaterial color="#262119" roughness={0.4} metalness={0.7} />
              </mesh>

              {/* Idea Body */}
              <group position={[0, 0.75, 0]}>
                <MorphingIdeaBody
                  reife={idea.reife}
                  isSelected={false}
                  onClick={() => handleSelectIdea(idea)}
                  isHovered={isHovered}
                />
              </group>

              {/* Minimal Tag on Hover */}
              {isHovered && (
                <Html position={[0, 1.4, 0]} center distanceFactor={14}>
                  <div className="bg-[#14120e]/95 border border-amber-500/50 rounded px-2 py-1 text-[10px] font-mono text-amber-200 pointer-events-none whitespace-nowrap shadow-lg">
                    {idea.title.slice(0, 32)}… (Reife {(idea.reife * 100).toFixed(0)}%)
                  </div>
                </Html>
              )}
            </group>
          );
        })}
      </group>

      {/* 4. The 6 Exits (Die 6 Tore des Ateliers im Hintergrund) */}
      <group position={[0, 0, -6.8]}>
        {EXITS.map((exit, idx) => {
          const x = (idx - 2.5) * 2.1;
          const isSingularity = exit.id === "singularity";
          const isDiscard = exit.id === "discard";

          return (
            <group
              key={exit.id}
              position={[x, 1.2, 0]}
              onClick={(e) => { e.stopPropagation(); handleExitClick(exit.id); }}
            >
              {/* Archway Portal Mesh */}
              <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[1.7, 2.6, 0.2]} />
                <meshStandardMaterial
                  color={isDiscard ? "#2b1c11" : "#0d131f"}
                  roughness={0.3}
                  metalness={0.8}
                />
              </mesh>
              {/* Glowing Portal Edge */}
              <mesh position={[0, 0.4, 0.12]}>
                <boxGeometry args={[1.75, 2.65, 0.05]} />
                <meshBasicMaterial color={exit.color} wireframe transparent opacity={0.7} />
              </mesh>

              {/* Portal Center Core */}
              <mesh position={[0, 0.4, 0.05]}>
                <circleGeometry args={[0.55, 32]} />
                <meshBasicMaterial color={exit.color} transparent opacity={0.3} />
              </mesh>
              <pointLight color={exit.color} intensity={1.8} distance={3.5} />

              {/* 3D Label */}
              <Html position={[0, -1.3, 0.2]} center distanceFactor={13}>
                <button
                  type="button"
                  onClick={() => handleExitClick(exit.id)}
                  className="group flex flex-col items-center gap-1 p-2 bg-[#0e1224]/90 hover:bg-[#141b33] border border-white/15 hover:border-cyan-400 rounded-lg transition-all cursor-pointer shadow-xl text-center w-36"
                >
                  <span className="text-xl group-hover:scale-110 transition-transform">{exit.icon}</span>
                  <span className="text-[11px] font-bold text-white leading-tight">{exit.label}</span>
                  <span className="text-[9px] text-gray-400 leading-tight line-clamp-2">{exit.desc}</span>
                </button>
              </Html>
            </group>
          );
        })}
      </group>

      {/* 5. Der Quellenboden & Religions-Sandbox (Rechts neben der Plattform) */}
      <group position={[7.5, 0, 0]}>
        {/* Foundation Base */}
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[4.2, 0.3, 7.2]} />
          <meshStandardMaterial color="#1a1815" roughness={0.5} />
        </mesh>

        {/* Boden 1: Koran (Granit, Goldrunen) */}
        <group position={[0, 0.05, -2.2]} onClick={(e) => { e.stopPropagation(); handleGroundStep("quran"); }}>
          <mesh>
            <boxGeometry args={[3.8, 0.18, 2.1]} />
            <meshStandardMaterial
              color="#0d0c0a"
              roughness={0.2}
              metalness={0.9}
              emissive={activeGround === "quran" ? "#e0a93f" : "#000000"}
              emissiveIntensity={activeGround === "quran" ? 0.3 : 0}
            />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[3.85, 0.02, 2.15]} />
            <meshBasicMaterial color="#e0a93f" wireframe transparent opacity={activeGround === "quran" ? 0.9 : 0.4} />
          </mesh>
          <Html position={[0, 0.5, 0]} center distanceFactor={14}>
            <div className={`px-2.5 py-1 rounded text-center cursor-pointer transition-all ${activeGround === "quran" ? "bg-amber-950/90 border border-amber-400 shadow-[0_0_15px_#e0a93f]" : "bg-black/70 border border-amber-900/50"}`}>
              <div className="text-[10px] font-mono uppercase text-amber-400 font-bold">Boden 1: Koran-Fundament</div>
              <div className="text-[9px] text-amber-200">Massiver Granit • Fester Grund • Klares Licht</div>
            </div>
          </Html>
        </group>

        {/* Boden 2: Authentischer Hadith (Basalt/Kristall) */}
        <group position={[0, 0.05, 0]} onClick={(e) => { e.stopPropagation(); handleGroundStep("hadith"); }}>
          <mesh>
            <boxGeometry args={[3.8, 0.18, 2.1]} />
            <meshStandardMaterial
              color="#1a1610"
              roughness={0.4}
              metalness={0.6}
              emissive={activeGround === "hadith" ? "#d97706" : "#000000"}
              emissiveIntensity={activeGround === "hadith" ? 0.25 : 0}
            />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[3.85, 0.02, 2.15]} />
            <meshBasicMaterial color="#d97706" wireframe transparent opacity={activeGround === "hadith" ? 0.9 : 0.4} />
          </mesh>
          <Html position={[0, 0.5, 0]} center distanceFactor={14}>
            <div className={`px-2.5 py-1 rounded text-center cursor-pointer transition-all ${activeGround === "hadith" ? "bg-amber-950/90 border border-amber-500 shadow-[0_0_15px_#d97706]" : "bg-black/70 border border-amber-900/50"}`}>
              <div className="text-[10px] font-mono uppercase text-amber-500 font-bold">Boden 2: Authentischer Hadith</div>
              <div className="text-[9px] text-amber-200">Strukturierter Grund • Kette & Quelle abrufbar</div>
            </div>
          </Html>
        </group>

        {/* Boden 3: Künstlerische Interpretation (Translucent Glass) */}
        <group position={[0, 0.05, 2.2]} onClick={(e) => { e.stopPropagation(); handleGroundStep("interpretation"); }}>
          <mesh>
            <boxGeometry args={[3.8, 0.18, 2.1]} />
            <meshStandardMaterial
              color="#0d2133"
              roughness={0.1}
              metalness={0.9}
              transparent
              opacity={0.7}
              emissive={activeGround === "interpretation" ? "#00f0ff" : "#000000"}
              emissiveIntensity={activeGround === "interpretation" ? 0.4 : 0}
            />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[3.85, 0.02, 2.15]} />
            <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={activeGround === "interpretation" ? 0.9 : 0.4} />
          </mesh>
          <Html position={[0, 0.5, 0]} center distanceFactor={14}>
            <div className={`px-2.5 py-1 rounded text-center cursor-pointer transition-all ${activeGround === "interpretation" ? "bg-cyan-950/90 border border-cyan-400 shadow-[0_0_15px_#00f0ff]" : "bg-black/70 border border-cyan-900/50"}`}>
              <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold">Boden 3: Künstlerische Deutung</div>
              <div className="text-[9px] text-cyan-200">Durchscheinendes Glas • Signalisiert Deutungsraum</div>
            </div>
          </Html>
        </group>
      </group>

      {/* 6. Ergänzende DOM-Steuerungs-Ebene (Inspector & Reife-Slider) */}
      <Html position={[0, 0, 4.2]} center distanceFactor={13}>
        <div className="bg-[#0a1018]/95 backdrop-blur-xl border border-white/15 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] w-[520px] text-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛠️</span>
              <div>
                <div className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">
                  Hermes 3D • Ideenatelier
                </div>
                <div className="text-base font-bold text-white">
                  {selectedIdea?.title || "Idee auswählen"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Frist: {selectedIdea?.decisionDeadline || "2026-09-30"}
              </span>
            </div>
          </div>

          {/* Reife Schieberegler */}
          <div className="space-y-2 mb-4 bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase text-gray-300">
                Reifegrad (Achse: 0.0 – 1.0):
              </span>
              <span className="text-sm font-mono font-bold text-cyan-400">
                {(currentReife * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.01"
              value={currentReife}
              onChange={(e) => handleReifeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[9px] font-mono text-gray-400 pt-1">
              <span>1. Funke</span>
              <span>2. Wolke</span>
              <span>3. Silhouette</span>
              <span>4. Form</span>
              <span>5. Check</span>
              <span>6. Proto</span>
              <span className="text-cyan-400 font-bold">7. Reife</span>
            </div>
          </div>

          {/* Summary / Beschreibung */}
          <p className="text-xs text-gray-300 leading-relaxed mb-4 bg-black/40 p-3 rounded-lg border border-white/5 max-h-24 overflow-y-auto">
            {selectedIdea?.summary || "Keine Beschreibung verfügbar."}
          </p>

          {/* Quick Idea Picker */}
          <div className="mb-4">
            <div className="text-[10px] font-mono text-gray-400 uppercase mb-1.5">
              Vault-Ideen ({openIdeas.length} offen):
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
              {openIdeas.map((idea) => (
                <button
                  key={idea.id}
                  type="button"
                  onClick={() => handleSelectIdea(idea)}
                  className={`px-2.5 py-1 text-[10px] rounded-lg whitespace-nowrap transition-all cursor-pointer font-mono ${
                    selectedId === idea.id
                      ? "bg-amber-500 text-black font-bold shadow-[0_0_12px_#f59e0b]"
                      : "bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10"
                  }`}
                >
                  {idea.title.slice(0, 18)}…
                </button>
              ))}
            </div>
          </div>

          {/* Toast Notice */}
          {exitNotice && (
            <div className="p-2.5 bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-mono rounded-lg text-center animate-pulse">
              {exitNotice}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
