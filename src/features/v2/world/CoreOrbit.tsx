"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
import type { RosterAgent } from "@/features/v2/useRoster";
import { providerTone } from "@/features/v2/world/AgentDeck";

/**
 * Eine Bahn um den Kern: ein Licht je Agent, in seiner Anbieterfarbe.
 *
 * Am Kern in der Mitte des Decks stand bisher nichts über die Lage. Wer
 * arbeitet gerade? Wie viel läuft? Man musste eine Figur anklicken und den
 * Inspektor lesen. Ein Punkt je Agent auf einer gemeinsamen Bahn beantwortet
 * dieselbe Frage im Vorbeigehen.
 *
 * **Und hier ist die unbequeme Hälfte:** Hermes liefert derzeit keine
 * Telemetrie. Es gibt keinen Weg zu erfahren, ob ein Profil gerade rechnet —
 * „5 Agenten" heißt fünf Profile, nicht fünf arbeitende. Also laufen alle
 * Lichter **gleich schnell**, und zwar ruhig. Das ist ehrlich konstant statt
 * vorgetäuschter Betrieb.
 *
 * Warum es trotzdem jetzt gebaut wird: Die Bahn ist die Stelle, an der die
 * Auslastung später steht. Sie kostet einen Zeichenaufruf, sie liest sich
 * heute schon als „hier gehören fünf hin", und wenn die Daten kommen, ist
 * nichts zu bauen — nur eine Zahl je Punkt zu setzen.
 */

/** Wie weit die Bahn vom Kern liegt und wie hoch sie sitzt. */
const ORBIT_RADIUS = 1.05;
const ORBIT_Y = 1.35;
/** Ruhiges Tempo. Wird zu einer Zahl je Agent, sobald Hermes eine liefert. */
const IDLE_SPEED = 0.28;

export function CoreOrbit({ agents }: { agents: RosterAgent[] }) {
  const { prefs } = useV2();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = Math.max(1, agents.length);

  const tones = useMemo(
    () => agents.map((agent) => new THREE.Color(providerTone(agent.provider))),
    [agents],
  );

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(1, 1, 1),
    }),
    [],
  );

  useEffect(() => {
    const target = mesh.current;
    if (!target) return;
    for (let i = 0; i < agents.length; i += 1) {
      target.setColorAt(i, tones[i]);
    }
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    // Eine grosszuegige Trefferkugel, damit die Punkte nie unsichtbar werden,
    // wenn die Matrizen noch nicht stehen — dieselbe Falle wie beim Deck.
    target.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, ORBIT_Y, 0), ORBIT_RADIUS + 1);
  }, [agents.length, tones, agents]);

  useFrame(({ clock }) => {
    const target = mesh.current;
    if (!target || agents.length === 0) return;
    const t = prefs.reducedMotion ? 0 : clock.elapsedTime;

    for (let i = 0; i < agents.length; i += 1) {
      // Gleichmässig verteilt und gleich schnell: Der Abstand zwischen zwei
      // Lichtern bleibt konstant, solange niemand mehr zu tun hat als ein
      // anderer. Genau das ist die Aussage, solange es keine Daten gibt.
      const angle = (i / agents.length) * Math.PI * 2 + t * IDLE_SPEED;
      scratch.position.set(
        Math.cos(angle) * ORBIT_RADIUS,
        ORBIT_Y + Math.sin(t * 0.6 + i) * 0.04,
        Math.sin(angle) * ORBIT_RADIUS,
      );
      scratch.scale.setScalar(1);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      target.setMatrixAt(i, scratch.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });

  if (agents.length === 0) return null;

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} raycast={() => {}}>
      <sphereGeometry args={[0.038, 10, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
