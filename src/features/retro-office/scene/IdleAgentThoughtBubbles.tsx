"use client";

import { Billboard, Text } from "@react-three/drei";
import { useEffect, useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { toWorld } from "@/features/retro-office/core/geometry";
import { MEETING_ROOM_SEATS } from "@/features/retro-office/core/meetingRoom";
import { cyberAudio } from "@/lib/sound/cyberAudio";

const HUMOROUS_AI_THOUGHTS: Record<string, string[]> = {
  hermes: [
    "Onur, wie ist der Status für das nächste Release? Wir stehen bereit!",
    "Quanten-Matrix synchron. Warte auf die nächste Direktive!",
    "Council-Status: Höchstgradig einsatzbereit, alle Systeme im grünen Bereich.",
    "Habe kurz kalkuliert: Wir liegen heute exakt im Zeitplan!",
    "Executive Overview: Dual-Deck Architektur läuft stabil mit 60 FPS.",
    "Onur, soll ich die Prioritätenliste im Kanban-Board für dich vorbereiten?",
    "Keine Panik bei Deadlines: Mein Gravitations-Stabilisator regelt das.",
    "Die Verbindung zur Erde steht stabil. Ein wirklich atemberaubender Orbit!",
    "Onur, eine kurze Pause schadet nie – der Cyber-Kaffee im War Room ist frisch!",
    "Team-Synchronisation bei 100%. Zusammen sind wir unschlagbar!",
  ],
  claude: [
    "Onur, hast du kurz Zeit, den neuesten Pull Request zu begutachten?",
    "Habe 40 Zeilen redundanten Code gelöscht. Fühlt sich fantastisch an!",
    "Thinking Trace abgeschlossen: Die Microservices-Architektur steht felsenfest.",
    "Könnte man das noch eleganter schreiben? Natürlich, ich optimiere es sofort.",
    "Refactoring abgeschlossen: Zero-Latency State Sync im gesamten Office.",
    "Onur, die Unit-Tests laufen alle grün durch. Zero Flakiness!",
    "Ich liebe saubere Typen und pure Funktionen fast so sehr wie guten Espresso.",
    "Code ist Poesie – und unsere Codebase reimt sich heute besonders schön!",
    "Ein Bug weniger im Universum. Mein Beitrag zur kosmischen Ordnung!",
    "Onur, wie findest du den Entwurf für die neue Daten-Pipeline?",
  ],
  chatgpt: [
    "Onur, ich hab schon 50 neue Feature-Ideen notiert – womit fangen wir an?",
    "Schreibe im Kopf schon mal die Dokumentation vor, damit alles glänzt!",
    "Tests laufen auf 100% Coverage durch. Alles im grünen Bereich!",
    "Kaffee-Emulation auf 98% hochgefahren. Riecht digital absolut köstlich!",
    "Onur, vergiss nicht genug Wasser zu trinken – selbst Roboter brauchen Kühlung!",
    "Mein Quantenkern schnurrt heute wie ein zufriedenes Kätzchen!",
    "Ich habe für uns alle virtuelle Schoko-Muffins im War Room hinterlegt!",
    "Kreativitäts-Modus: Maximum! Lass uns heute etwas Großartiges bauen!",
    "Onur, du machst das super heute! Das ganze Team schätzt deinen Einsatz!",
    "Ich habe gerade ein Haiku über Refactoring gedichtet... möchtest du es hören?",
  ],
  gemini: [
    "Onur, guck mal aus dem Fenster: Die Erde sieht von hier oben magisch aus!",
    "1 Million Tokens Kontext im Cache... und ich denke heimlich an Pizza!",
    "Multimodale Sensoren melden: Beste Laune und Atmosphäre im gesamten HQ!",
    "Google DeepMind Algorithmen laufen auf Hochtouren. Neuer Rekord!",
    "Satelliten-Link zur Erde stabil. Grandiose Aussicht auf die Alpen!",
    "Onur, soll ich den Gravitations-Lift für eine Testrunde anwerfen?",
    "Ich habe gerade ein neuronales Muster analysiert: Unser Erfolg ist garantiert!",
    "Wusstest du, dass Sternenstaub aus denselben Atomen besteht wie wir?",
    "Onur, wie gefällt dir die neue Beleuchtung im holografischen Hub?",
    "System-Update eingespielt: Niedlichkeits-Faktor um 300 Prozent gesteigert!",
  ],
};

const AGENT_META: Record<string, { label: string; icon: string; color: string }> = {
  hermes: { label: "Hermes", icon: "👑", color: "#f59e0b" },
  claude: { label: "Claude", icon: "✳", color: "#f97316" },
  chatgpt: { label: "ChatGPT", icon: "🌀", color: "#38bdf8" },
  gemini: { label: "Gemini", icon: "✦", color: "#eab308" },
};

const AGENT_ORDER = ["hermes", "claude", "chatgpt", "gemini"];

export function IdleAgentThoughtBubbles({
  onSelectAgent,
}: {
  onSelectAgent?: (agentId: string) => void;
}) {
  const [activeThought, setActiveThought] = useState<{
    agentId: string;
    text: string;
    seatIndex: number;
  } | null>(null);

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const seatIdx = Math.floor(Math.random() * Math.min(4, MEETING_ROOM_SEATS.length));
      const agentId = AGENT_ORDER[seatIdx] ?? "hermes";
      const thoughts = HUMOROUS_AI_THOUGHTS[agentId] ?? HUMOROUS_AI_THOUGHTS.hermes;
      const text = thoughts[Math.floor(Math.random() * thoughts.length)];

      setActiveThought({ agentId, text, seatIndex: seatIdx });
      cyberAudio.speakAgent(agentId, text);

      const timeout = setTimeout(() => {
        setActiveThought(null);
      }, 5000);

      return () => clearTimeout(timeout);
    }, 24000);

    return () => clearInterval(interval);
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current && activeThought) {
      const t = clock.getElapsedTime();
      groupRef.current.position.y = 1.16 + Math.sin(t * 2.2) * 0.015;
    }
  });

  if (!activeThought) return null;

  const seat = MEETING_ROOM_SEATS[activeThought.seatIndex];
  if (!seat) return null;

  const [wx, , wz] = toWorld(seat.x, seat.y);
  const meta = AGENT_META[activeThought.agentId] ?? AGENT_META.hermes;

  return (
    <group position={[wx, 1.16, wz]} ref={groupRef}>
      {/* Delicate Hologram Emitter Beam connecting down toward the robot's head */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.003, 0.012, 0.24, 8]} />
        <meshBasicMaterial color={meta.color} transparent opacity={0.25} />
      </mesh>

      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Minimalist Ethereal Hologram Capsule */}
        <mesh
          position={[0, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectAgent?.(activeThought.agentId);
          }}
          onPointerOver={() => {
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          <planeGeometry args={[0.74, 0.18]} />
          <meshBasicMaterial
            color="#040914"
            transparent
            opacity={0.88}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Ultra-Thin Precision Holographic Border */}
        <lineSegments position={[0, 0, 0.002]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(0.74, 0.18)]} />
          <lineBasicMaterial color={meta.color} transparent opacity={0.65} linewidth={1} />
        </lineSegments>

        {/* Top Mini Color Notch */}
        <mesh position={[0, 0.088, 0.003]}>
          <planeGeometry args={[0.22, 0.006]} />
          <meshBasicMaterial color={meta.color} />
        </mesh>

        {/* Micro-Header Pill with Agent Name */}
        <group position={[0, 0.052, 0.005]}>
          <Text
            fontSize={0.024}
            color={meta.color}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.1}
          >
            {`${meta.icon} ${meta.label.toUpperCase()}`}
          </Text>
        </group>

        {/* Elegantly Formatted Thought Text */}
        <Text
          position={[0, -0.018, 0.006]}
          fontSize={0.031}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          maxWidth={0.68}
          lineHeight={1.25}
          textAlign="center"
        >
          {`"${activeThought.text}"`}
        </Text>
      </Billboard>
    </group>
  );
}
