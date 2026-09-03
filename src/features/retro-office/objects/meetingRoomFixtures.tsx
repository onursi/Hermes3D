"use client";

import { Billboard, Text } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { toWorld } from "@/features/retro-office/core/geometry";
import {
  MEETING_ROOM_APPROVAL_POSITION,
  MEETING_ROOM_RUG,
  MEETING_ROOM_SEATS,
  type MeetingRoomSeatRole,
} from "@/features/retro-office/core/meetingRoom";
import type { MeetingParticipantStatus } from "@/features/office/meeting-room/deriveParticipantStatus";

/**
 * The Council Corner's non-interactive, real-data-driven decor — a
 * freestanding knowledge screen, a per-seat status light, a floor rug, and
 * a human-approval marker. These are deliberately NOT furniture-editor
 * items (unlike the round table and chairs in furnitureDefaults.ts):
 * they're fixed fixtures whose only job is to display real
 * AgentState-derived status, the same way MeetingRoomImmersiveScreen.tsx's
 * flat overlay already did — no new data is fabricated here, only
 * re-rendered in-world.
 *
 * HQ v2 has no walls anywhere near this corner (see core/meetingRoom.ts and
 * furnitureDefaults.ts) — the screen stands on its own base rather than
 * mounting to a wall, the same way SAMS' reference boards are freestanding
 * panels on the open floor.
 *
 * Per-seat identity (name, model, role, live status) is deliberately NOT
 * shown as floating text over the seats or the room — it lives in the 2D
 * MeetingRoomHud roster in RetroOffice3D.tsx instead, so the corner itself
 * stays a calm, uncluttered space and reads at a glance from the actual
 * camera distance the fly-in leaves you at.
 */

// Reuses MeetingParticipantStatus (deriveParticipantStatus.ts) rather than
// declaring a second, drift-prone copy of the same status vocabulary — the
// flat 2D overlay and this in-world view must always agree on what
// "working"/"speaking"/"done" etc. mean.
export type MeetingRoomSeatStatus = MeetingParticipantStatus;

export const MEETING_ROOM_STATUS_COLOR: Record<MeetingRoomSeatStatus, string> = {
  available: "#6b7280",
  working: "#caa455",
  speaking: "#6674e0",
  waiting_approval: "#c68518",
  done: "#22a06b",
  error: "#c0392b",
};

export const MEETING_ROOM_STATUS_LABEL: Record<MeetingRoomSeatStatus, string> = {
  available: "Verfügbar",
  working: "Arbeitet",
  speaking: "Spricht",
  waiting_approval: "Wartet auf Freigabe",
  done: "Fertig",
  error: "Fehler",
};

export type MeetingRoomSeatData = {
  role: MeetingRoomSeatRole;
  agentName: string | null;
  agentModel: string | null;
  agentColor: string;
  status: MeetingRoomSeatStatus;
};

const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Deferred via setTimeout(0), not called synchronously in the effect
    // body — react-hooks/set-state-in-effect flags a direct setState()
    // call there as a cascading-render risk (same fix as
    // MeetingRoomImmersiveScreen.tsx's nowMs bootstrap).
    const timeoutId = window.setTimeout(() => setReduced(query.matches), 0);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handler);
    return () => {
      window.clearTimeout(timeoutId);
      query.removeEventListener("change", handler);
    };
  }, []);
  return reduced;
};

function SeatFixture({ seat, data }: { seat: (typeof MEETING_ROOM_SEATS)[number]; data: MeetingRoomSeatData | null }) {
  const [wx, , wz] = toWorld(seat.x, seat.y);
  const status: MeetingRoomSeatStatus = data?.status ?? "available";
  const color = MEETING_ROOM_STATUS_COLOR[status];
  const reducedMotion = usePrefersReducedMotion();
  const lightMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const isLive = status === "speaking" || status === "waiting_approval";

  useFrame(({ clock }) => {
    if (!lightMatRef.current) return;
    if (!isLive || reducedMotion) {
      lightMatRef.current.emissiveIntensity = isLive ? 1.4 : 0.9;
      return;
    }
    const pulse = 0.55 + Math.sin(clock.getElapsedTime() * 2.4) * 0.45;
    lightMatRef.current.emissiveIntensity = 0.9 + pulse * 1.1;
  });

  // No floating nameplate here (see file header) — just a small, discreet
  // status puck flush with the table edge. Shadow-casting is switched off:
  // these are tiny (3cm) fixtures whose contact shadow is imperceptible
  // from the room's normal viewing distance, and skipping them keeps the
  // shadow pass's draw-call count down (4 seats × 1 saved cast each).
  return (
    <group position={[wx, 0, wz]}>
      <mesh position={[0, 0.012, 0.16]}>
        <cylinderGeometry args={[0.028, 0.032, 0.024, 16]} />
        <meshStandardMaterial color="#26282d" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.026, 0.16]}>
        <sphereGeometry args={[0.014, 16, 16]} />
        <meshStandardMaterial
          ref={lightMatRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}

/** Rug removed so the luxury Calacatta Viola marble floor shows unbroken under the table */
function RoomRug() {
  return null;
}

function ApprovalMarker({ active }: { active: boolean }) {
  const [wx, , wz] = toWorld(MEETING_ROOM_APPROVAL_POSITION.x, MEETING_ROOM_APPROVAL_POSITION.y);
  const reducedMotion = usePrefersReducedMotion();
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    if (!active || reducedMotion) {
      matRef.current.emissiveIntensity = active ? 1.3 : 0.25;
      return;
    }
    const pulse = 0.55 + Math.sin(clock.getElapsedTime() * 2.1) * 0.45;
    matRef.current.emissiveIntensity = 0.8 + pulse * 1.2;
  });

  // Only rendered while there's an actual pending approval — sitting there
  // permanently as a small dark puck on the open floor read as a random,
  // purposeless stool when idle (which is most of the time).
  if (!active) return null;

  return (
    <group position={[wx, 0, wz]}>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.18, 24]} />
        <meshStandardMaterial color="#2a2c31" roughness={0.5} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.185, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.01, 24]} />
        <meshStandardMaterial
          ref={matRef}
          color={active ? "#c68518" : "#5c6068"}
          emissive={active ? "#c68518" : "#5c6068"}
          emissiveIntensity={active ? 1.3 : 0.25}
          roughness={0.3}
        />
      </mesh>
      {active ? (
        <Billboard position={[0, 0.42, 0]}>
          <Text fontSize={0.055} color="#f2c986" anchorX="center" anchorY="middle" maxWidth={0.8}>
            Freigabe erforderlich
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}

// The freestanding floor-mounted knowledge screen (base + support poles)
// that used to live here moved into scene/environment.tsx as
// WallCouncilScreen — recessed into the north wall itself, on request,
// instead of standing on its own base in the middle of the floor.

export function MeetingRoomFixtures({
  seats,
  approvalActive,
}: {
  seats: MeetingRoomSeatData[];
  approvalActive: boolean;
}) {
  return (
    <group>
      <RoomRug />
      {MEETING_ROOM_SEATS.map((seat, index) => (
        <SeatFixture key={index} seat={seat} data={seats[index] ?? null} />
      ))}
      <ApprovalMarker active={approvalActive} />
    </group>
  );
}
