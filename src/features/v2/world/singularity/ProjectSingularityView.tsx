"use client";

import { Billboard, Html, Text } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

import type { Project } from "@/features/v2/useProjects";
import { GargantuaBlackHole } from "@/features/v2/world/singularity/GargantuaBlackHole";
import {
  ProjectPlanet,
  type ProjectPlanetData,
} from "@/features/v2/world/singularity/ProjectPlanet";

interface ProjectSingularityViewProps {
  projects: Project[];
  onSwitchMode: (mode: "werft" | "tesseract") => void;
  onOpenEndziel: () => void;
}

// Curated goals and metadata for primary project domains
const PROJECT_METADATA: Record<
  string,
  {
    goal: string;
    importance: number;
    defaultDays: number;
    color: string;
    mdFiles: string[];
  }
> = {
  "01 Hermes Agent OS": {
    goal: "Das persönliche 3D-Betriebssystem für autonome Agenten und LifeOS erschaffen.",
    importance: 10,
    defaultDays: 1,
    color: "#38bdf8",
    mdFiles: [
      "Hermes 3D V2 - Architektur.md",
      "Spatial Life OS - Vision.md",
      "Endziel_Hermes_Agent_OS_Glasplatte.html",
      "Briefing für Hermes – Council bauen 2026-09-04.md",
    ],
  },
  "03 Arbeit & Karriere": {
    goal: "Passende Stellen automatisiert finden, bewerten und Bewerbungen vorbereiten.",
    importance: 8,
    defaultDays: 14,
    color: "#34d399",
    mdFiles: [
      "Hermes-Bewerbungsworkflow.md",
      "Techniker-Projektarbeit.pdf",
      "Stellenangebote.md",
    ],
  },
  "RPA & Automatisierung": {
    goal: "UiPath und Prozessautomatisierung praxisnah für Industrie und Agenten meistern.",
    importance: 6,
    defaultDays: 34,
    color: "#fbbf24",
    mdFiles: ["RPA-Lernplan.md", "UiPath-Workflows.md", "Automations.md"],
  },
  "KI Lead Pipeline": {
    goal: "Unternehmen mit Potenzial für maßgeschneiderte KI-Pilotprojekte bündeln.",
    importance: 7,
    defaultDays: 62,
    color: "#c084fc",
    mdFiles: ["Lead-Pipeline.md", "Analyse-Firmen.md", "Pitch-Entwurf.md"],
  },
  "Hermes Agent Office": {
    goal: "Mehrere KI-Mitarbeiter im virtuellen Office koordinieren und Aufgaben teilen.",
    importance: 9,
    defaultDays: 85,
    color: "#f43f5e",
    mdFiles: ["Agent-Office-Architektur.md", "Council-Rollen.md"],
  },
  "Altes App-Konzept": {
    goal: "Frühes mobiles App-Konzept prüfen: reaktivieren, archivieren oder loslassen.",
    importance: 3,
    defaultDays: 130,
    color: "#ef4444",
    mdFiles: ["App-Idee-2024.md", "Notizen-Archiv.md"],
  },
};

export function ProjectSingularityView({
  projects,
  onSwitchMode,
  onOpenEndziel,
}: ProjectSingularityViewProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [stabilizedOverrides, setStabilizedOverrides] = useState<Record<string, number>>({});
  const [showMdList, setShowMdList] = useState(false);
  const [isDiving, setIsDiving] = useState(false);

  // Compile planet data combining real vault projects and cosmic domains
  const planets = useMemo<ProjectPlanetData[]>(() => {
    const list: ProjectPlanetData[] = [];

    // Real vault projects first
    projects.forEach((proj, idx) => {
      const meta = PROJECT_METADATA[proj.folder] || {
        goal: `${proj.name} im LifeOS koordinieren und Ergebnisse sichern.`,
        importance: 7,
        defaultDays: (idx + 1) * 16,
        color: idx % 2 === 0 ? "#38bdf8" : "#fbbf24",
        mdFiles: [`${proj.name}-Overview.md`, "Ziele.md"],
      };

      const days = stabilizedOverrides[proj.folder] ?? meta.defaultDays;

      list.push({
        folder: proj.folder,
        name: proj.name,
        goal: meta.goal,
        daysSinceUpdate: days,
        noteCount: proj.noteCount || 5,
        importance: meta.importance,
        color: meta.color,
        orbitAngle: (idx / Math.max(1, projects.length)) * Math.PI * 2,
        orbitSpeed: 0.15 / (1 + idx * 0.2),
      });
    });

    // Add extra archetypes if vault has fewer projects so the cosmos feels rich
    const existingFolders = new Set(list.map((p) => p.folder));
    const extraArchetypes = [
      "RPA & Automatisierung",
      "KI Lead Pipeline",
      "Hermes Agent Office",
      "Altes App-Konzept",
    ];

    extraArchetypes.forEach((archKey, aIdx) => {
      if (!existingFolders.has(archKey)) {
        const meta = PROJECT_METADATA[archKey];
        if (meta) {
          const days = stabilizedOverrides[archKey] ?? meta.defaultDays;
          list.push({
            folder: archKey,
            name: archKey,
            goal: meta.goal,
            daysSinceUpdate: days,
            noteCount: 4 + aIdx * 3,
            importance: meta.importance,
            color: meta.color,
            orbitAngle: ((projects.length + aIdx) / 6) * Math.PI * 2 + 0.5,
            orbitSpeed: 0.12 / (1 + aIdx * 0.25),
          });
        }
      }
    });

    return list;
  }, [projects, stabilizedOverrides]);

  const selectedPlanet = useMemo(
    () => planets.find((p) => p.folder === selectedFolder) || null,
    [planets, selectedFolder]
  );

  const selectedMeta = selectedFolder ? PROJECT_METADATA[selectedFolder] : null;

  // Handler to push planet outward into safe orbit
  const handleStabilize = (folder: string) => {
    setStabilizedOverrides((prev) => ({
      ...prev,
      [folder]: 1, // Just updated today -> safe outer orbit!
    }));
  };

  return (
    <group>
      {/* ================= 1. GARGANTUA BLACK HOLE (CENTER) ================= */}
      <GargantuaBlackHole
        position={[0, 2.5, 0]}
        onDive={() => setIsDiving(true)}
      />

      {/* ================= 2. ALL PROJECT PLANETS IN GRAVITATIONAL ORBIT ================= */}
      {planets.map((planet) => (
        <ProjectPlanet
          key={planet.folder}
          data={planet}
          blackHoleCenter={[0, 2.5, 0]}
          isSelected={selectedFolder === planet.folder}
          onSelect={() => {
            setSelectedFolder(planet.folder);
            setShowMdList(false);
          }}
          onStabilizeOrbit={() => handleStabilize(planet.folder)}
        />
      ))}

      {/* ================= 3. 3D NAVIGATION CONSOLE (TOP / FOREGROUND) ================= */}
      <Billboard position={[0, 7.8, 0]}>
        <group>
          {/* Active Mode Pill */}
          <group position={[-3.2, 0, 0]}>
            <mesh>
              <planeGeometry args={[3.2, 0.65]} />
              <meshBasicMaterial color="#0284c7" transparent opacity={0.9} />
            </mesh>
            <Text
              fontSize={0.17}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              position={[0, 0, 0.02]}
            >
              🌌 Singularity (Aktiv)
            </Text>
          </group>

          {/* Switch to Ergebniswerft */}
          <group
            position={[0.2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSwitchMode("werft");
            }}
            onPointerOver={() => {
              if (typeof document !== "undefined") document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              if (typeof document !== "undefined") document.body.style.cursor = "auto";
            }}
          >
            <mesh>
              <planeGeometry args={[3.0, 0.65]} />
              <meshBasicMaterial color="#1e293b" transparent opacity={0.8} />
            </mesh>
            <Text
              fontSize={0.16}
              color="#38bdf8"
              anchorX="center"
              anchorY="middle"
              position={[0, 0, 0.02]}
            >
              🚢 Ergebniswerft
            </Text>
          </group>

          {/* Switch to 4D Tesseract */}
          <group
            position={[3.4, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSwitchMode("tesseract");
            }}
            onPointerOver={() => {
              if (typeof document !== "undefined") document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              if (typeof document !== "undefined") document.body.style.cursor = "auto";
            }}
          >
            <mesh>
              <planeGeometry args={[3.0, 0.65]} />
              <meshBasicMaterial color="#1e293b" transparent opacity={0.8} />
            </mesh>
            <Text
              fontSize={0.16}
              color="#c084fc"
              anchorX="center"
              anchorY="middle"
              position={[0, 0, 0.02]}
            >
              🪐 4D-Tesserakt
            </Text>
          </group>
        </group>
      </Billboard>

      {/* ================= 4. SINGULARITY DIVE OVERLAY (IF ACTIVE) ================= */}
      {isDiving && (
        <Html fullscreen zIndexRange={[100, 100]}>
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle, rgba(0,0,0,0.95) 20%, rgba(2,6,23,0.88) 100%)",
              backdropFilter: "blur(20px)",
              color: "#fff",
              padding: "2rem",
              zIndex: 9999,
            }}
          >
            <div style={{ textAlign: "center", maxWidth: "600px" }}>
              <div
                style={{
                  fontSize: "3.5rem",
                  marginBottom: "1rem",
                  animation: "pulse 2s infinite",
                }}
              >
                🌌
              </div>
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  marginBottom: "0.5rem",
                  background: "linear-gradient(135deg, #38bdf8, #f59e0b)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Singularity Dive
              </h2>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "1.05rem",
                  lineHeight: "1.6",
                  marginBottom: "2rem",
                }}
              >
                Du bist am Ereignishorizont eingetaucht. Die Zeitkrümmung der
                Projektvernachlässigung wird hier maximal spürbar. Alle
                Projekte, die im Sog verschwinden, verlangen eine bewusste
                Entscheidung: Reaktivieren oder Loslassen.
              </p>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                <button
                  onClick={() => setIsDiving(false)}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.25)",
                    padding: "0.75rem 1.75rem",
                    borderRadius: "0.75rem",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ↩️ Dive verlassen
                </button>
                <button
                  onClick={() => {
                    setIsDiving(false);
                    onOpenEndziel();
                  }}
                  style={{
                    background: "#0284c7",
                    color: "#fff",
                    border: "1px solid #38bdf8",
                    padding: "0.75rem 1.75rem",
                    borderRadius: "0.75rem",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  💎 Zum Endziel-Blueprint
                </button>
              </div>
            </div>
          </div>
        </Html>
      )}

      {/* ================= 5. REDUCED 2D GLASS PANEL (BRIEFING SEC 5.4) ================= */}
      {selectedPlanet && !isDiving && (
        <Html fullscreen zIndexRange={[50, 60]}>
          <div
            style={{
              position: "fixed",
              bottom: "2.5rem",
              right: "2.5rem",
              width: "420px",
              maxWidth: "calc(100vw - 3rem)",
              background: "rgba(10, 18, 35, 0.85)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              backdropFilter: "blur(24px)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(56,189,248,0.2)",
              color: "#f8fafc",
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              zIndex: 900,
            }}
          >
            {/* Header: Name + Close */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "0.75rem",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    background:
                      selectedPlanet.daysSinceUpdate > 30
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(52, 211, 153, 0.2)",
                    color:
                      selectedPlanet.daysSinceUpdate > 30 ? "#f87171" : "#34d399",
                    border: `1px solid ${
                      selectedPlanet.daysSinceUpdate > 30
                        ? "rgba(239, 68, 68, 0.4)"
                        : "rgba(52, 211, 153, 0.4)"
                    }`,
                    marginBottom: "0.35rem",
                  }}
                >
                  {selectedPlanet.daysSinceUpdate > 30
                    ? `⚠️ ${selectedPlanet.daysSinceUpdate} Tage inaktiv`
                    : `🟢 Aktiv vor ${selectedPlanet.daysSinceUpdate} Tag(en)`}
                </span>
                <h3
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: 800,
                    margin: 0,
                    color: "#ffffff",
                  }}
                >
                  {selectedPlanet.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFolder(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  padding: "0.2rem",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* 1-Sentence Goal (Briefing 5.4 requirement) */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: "0.75rem",
                padding: "0.85rem",
                marginBottom: "1rem",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  color: "#38bdf8",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                🎯 Kernziel
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.92rem",
                  color: "#e2e8f0",
                  lineHeight: 1.45,
                }}
              >
                {selectedPlanet.goal}
              </p>
            </div>

            {/* Markdown Files Collapsible (Briefing 5.4) */}
            {showMdList && selectedMeta && (
              <div
                style={{
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: "0.6rem",
                  padding: "0.6rem 0.8rem",
                  marginBottom: "1rem",
                  maxHeight: "120px",
                  overflowY: "auto",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "#94a3b8",
                    marginBottom: "0.3rem",
                    fontWeight: 600,
                  }}
                >
                  Obsidian Markdown-Dokumente:
                </div>
                {selectedMeta.mdFiles.map((f, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: "0.8rem",
                      color: "#38bdf8",
                      fontFamily: "monospace",
                      padding: "0.15rem 0",
                    }}
                  >
                    📄 {f}
                  </div>
                ))}
              </div>
            )}

            {/* Actions Grid */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {/* Primary: Stabilize Orbit */}
              <button
                onClick={() => handleStabilize(selectedPlanet.folder)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  padding: "0.65rem 1rem",
                  background: "linear-gradient(135deg, #0284c7, #0369a1)",
                  color: "#fff",
                  border: "1px solid #38bdf8",
                  borderRadius: "0.65rem",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 0 15px rgba(56, 189, 248, 0.4)",
                  transition: "transform 0.15s",
                }}
              >
                ⚡ Projekt aktualisieren (Orbit stabilisieren)
              </button>

              {/* Secondary Buttons Row */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <a
                  href="/deck.html"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.3rem",
                    padding: "0.55rem 0.75rem",
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    borderRadius: "0.65rem",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                >
                  🤖 Agenten-Deck
                </a>

                <button
                  onClick={() => setShowMdList(!showMdList)}
                  style={{
                    padding: "0.55rem 0.85rem",
                    background: "rgba(255,255,255,0.06)",
                    color: "#94a3b8",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "0.65rem",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  📄 {showMdList ? "Schließen" : "MD-Dateien"}
                </button>
              </div>

              {/* Tertiary Buttons Row */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => onSwitchMode("werft")}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.75rem",
                    background: "rgba(255,255,255,0.04)",
                    color: "#cbd5e1",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "0.65rem",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  🚢 Zur Ergebniswerft
                </button>
                <button
                  onClick={onOpenEndziel}
                  style={{
                    padding: "0.5rem 0.85rem",
                    background: "rgba(147, 51, 234, 0.15)",
                    color: "#c084fc",
                    border: "1px solid rgba(147, 51, 234, 0.35)",
                    borderRadius: "0.65rem",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  💎 Endziel
                </button>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
