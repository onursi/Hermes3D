"use client";

import { Billboard, Text } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
import {CommandCore,CommandPlatform,CommandStations} from "./CommandCore";
import {useWorlds} from "../foundations/WorldsProvider";
import type { RosterAgent } from "@/features/v2/useRoster";
import { AgentDeck } from "@/features/v2/world/AgentDeck";
import { DeckDust } from "@/features/v2/world/DeckDust";

/**
 * The home stage.
 *
 * A compact floating oval of graphite, open at the front to the cosmos, with a
 * low curved brace behind that carries the light. No ceiling: the plan asks for
 * a room that reads from every angle, and a lid is the one thing that makes an
 * isometric room look like a box.
 *
 * The whole stage is about ten metres across. That is deliberate and it is the
 * central performance decision: V1 spent its budget on a nine-by-seven-metre
 * office where most of the floor was empty and every wall carried a screen. A
 * small stage can afford good materials, real contact shadows and clean edges
 * on a GPU that cannot afford a large one.
 */

const PLATFORM_RADIUS = 4.6;
const DOCK_RADIUS = 3.15;

export function HomeWorld({
  agents,
  rosterReachable,
  approvalsWaiting,
  onSelectAgent,
}: {
  agents: RosterAgent[];
  rosterReachable: boolean;
  approvalsWaiting: number;
  onSelectAgent: (id: string) => void;
}) {
  const { selection, focus, prefs } = useV2();
  const {objects}=useWorlds();

  /**
   * Seats are derived from the real roster, never from a fixed five.
   *
   * The plan is explicit: additional participants need a visible overflow, not
   * invisible chairs. Eight is what fits at this radius without the figures
   * touching; beyond that the inspector lists the rest.
   */
  const seats = useMemo(() => {
    const shown = agents.slice(0, 8);
    return shown.map((agent, index) => {
      // Start at the back and open toward the viewer, so the front stays clear
      // and nobody has their back to the camera in the composed view.
      const spread = Math.PI * 1.45;
      const t = shown.length === 1 ? 0.5 : index / (shown.length - 1);
      const angle = -Math.PI / 2 - spread / 2 + spread * t;
      return {
        agent,
        position: new THREE.Vector3(
          Math.cos(angle) * DOCK_RADIUS,
          0,
          Math.sin(angle) * DOCK_RADIUS,
        ),
        angle,
      };
    });
  }, [agents]);

  return (
    <group>
      <DeckDust />
      <Suspense fallback={<StagePlatform/>}><CommandPlatform/></Suspense>
      <CommandCore intensity={prefs.coreIntensity} reachable={rosterReachable} waiting={approvalsWaiting}/>
      <CommandStations projects={objects.filter(o=>o.kind==='project'&&!['fertig','abgeschlossen'].includes(o.state)).length} waiting={approvalsWaiting} reachable={rosterReachable}/>
      {seats.map(({agent,position})=><mesh key={agent.id} position={[position.x,-.08,position.z]}><cylinderGeometry args={[.48,.55,.15,6]}/><meshStandardMaterial color="#25323c" metalness={.65} roughness={.3}/></mesh>)}

      {/* Alle Agenten in einem Objekt statt einem pro Figur. Der Grund steht
          in AgentDeck.tsx und ist gemessen, nicht vermutet. */}
      <AgentDeck
        seats={seats}
        selectedId={selection.kind === "agent" ? selection.id : null}
        focus={focus}
        onSelect={onSelectAgent}
      />

      {/* No roster is a real state and says so, rather than showing empty
          seats that look like a room nobody came to. */}
      {!rosterReachable ? (
        <Billboard position={[0, 3.8, 0]}>
          <Text
            fontSize={0.19}
            color="#f43f5e"
            anchorX="center"
            outlineWidth={0.006}
            outlineColor="#000000"
          >
            Hermes nicht erreichbar — keine Agenten geladen
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}

/**
 * The platform: a shallow oval slab with an inset light channel.
 *
 * Two meshes and one ring. The quality comes from the material and the light
 * that grazes it, not from geometry — which is the only way to look expensive
 * on an integrated GPU.
 */
function StagePlatform() {
  return (
    <group>
      {/* Open orbital terraces: empty space remains visible between the decks. */}
      {[0, 1, 2].map((segment) => (
        <group key={segment} rotation={[0, segment * Math.PI * 2 / 3 + 0.2, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <ringGeometry args={[1.75, PLATFORM_RADIUS, 48, 1, 0, Math.PI * 0.56]} />
            <meshStandardMaterial color="#202933" roughness={0.34} metalness={0.65} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
            <ringGeometry args={[PLATFORM_RADIUS - 0.035, PLATFORM_RADIUS, 48, 1, 0, Math.PI * 0.56]} />
            <meshBasicMaterial color={segment === 1 ? "#c8a77c" : "#9dbbc8"} transparent opacity={0.65} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[1.18, 0.6, 0.36, 6]} />
        <meshStandardMaterial color="#26313c" roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
}
