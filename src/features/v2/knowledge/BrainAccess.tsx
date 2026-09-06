"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { KNOWLEDGE_PULSE_EVENT } from "@/features/retro-office/scene/VaultStars";

/**
 * Sichtbar machen, dass Jarvis gerade in Onurs Wissen liest.
 *
 * Seine Frage war genau das: "wenn JavaScript beispielsweise mein Wissen
 * durchsucht — kann er dann so einen Effekt machen, dass er grade auf mein
 * Gehirn zugreift und dass das dann sichtbar wird?"
 *
 * Zwei Dinge passieren hier, und beide sind an echte Ereignisse gebunden:
 *
 * 1. **Die Abtastwelle.** Solange die Suche läuft, laufen Ringe vom Zentrum
 *    des Kosmos nach außen durch die Areale. Sie beginnen, wenn die Suche
 *    beginnt, und hören auf, wenn sie fertig ist. Eine Welle, die auf einem
 *    Zeitgeber liefe, sähe genauso aus, ob etwas gesucht wurde oder nicht —
 *    und wäre damit eine Behauptung statt einer Anzeige.
 *
 * 2. **Die Kometen.** Sobald feststeht, welche Notizen tatsächlich gelesen
 *    wurden, löst sich an jeder einzelnen ein Licht und fliegt zur Mitte.
 *    Man sieht also nicht "er sucht irgendwo", sondern **wo** die Antwort
 *    herkommt. Die Kennungen kommen aus derselben Antwort, die auch die
 *    Quellenliste füllt — es gibt keinen zweiten Weg, der etwas anderes
 *    behaupten könnte.
 *
 * Kosten: eine InstancedMesh und ein Ring. Wenn nichts läuft, ist die Gruppe
 * unsichtbar und die Schleife bricht nach zwei Vergleichen ab.
 */

/** Sagt dem Raum, dass eine Suche läuft oder vorbei ist. */
export const JARVIS_SCAN_EVENT = "hermes_jarvis_scan";

/** Wie lange ein Komet von seiner Notiz bis zur Mitte braucht, in Sekunden. */
const FLIGHT = 1.9;

/** Wie lange eine gelesene Notiz danach noch nachglüht. */
const AFTERGLOW = 2.6;

/** Höchstzahl gleichzeitiger Kometen. Jarvis zitiert sechs; zehn ist Luft. */
const MAX_COMETS = 10;

/** Perlen je Komet — der Schweif. Die erste ist der Kopf. */
const BEADS = 7;

/** Abstand der Perlen entlang der Bahn, als Anteil der Gesamtstrecke. */
const BEAD_GAP = 0.035;

const TARGET = new THREE.Vector3(0, 0, 0);

type Comet = { from: THREE.Vector3; born: number };

type Props = {
  /** Wo jede Notiz steht. Kommt aus dem Layout, wird hier nur gelesen. */
  positionsById: Map<string, THREE.Vector3>;
  /** Wie weit der Kosmos reicht — die Abtastwelle soll ihn ganz durchlaufen. */
  reach?: number;
  reducedMotion?: boolean;
};

export function BrainAccess({ positionsById, reach = 26, reducedMotion = false }: Props) {
  const cometsRef = useRef<Comet[]>([]);
  const scanRef = useRef({ active: false, since: 0 });

  const beadsRef = useRef<THREE.InstancedMesh>(null);
  const waveRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(0.11, 10, 10), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#bfe9ff"),
        transparent: true,
        // Additiv, weil die Kometen Licht sind und keine Körper: zwei, die
        // sich überlagern, sollen heller werden und nicht einander verdecken.
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  /**
   * Grob aufgelöst, und das ist keine Sparsamkeit.
   *
   * Die erste Fassung stand auf 40 × 24. Additiv gemischt waren das rund
   * neunzehnhundert Liniensegmente, die sich als heller Käfig über den ganzen
   * Raum legten — der Effekt verdeckte genau das, worauf er zeigen soll. Bei
   * 20 × 10 läuft eine Welle durchs Bild, und die Notizen bleiben sichtbar.
   */
  const waveGeometry = useMemo(() => new THREE.SphereGeometry(1, 20, 10), []);
  /**
   * Das Wellenmaterial liegt als ref am JSX-Element und nicht in einem Memo.
   *
   * Der Grund ist eine Lint-Regel, und sie hat recht: ein per useMemo
   * erzeugtes Objekt darf nicht Bild für Bild verändert werden, weil React
   * dann nichts mehr über den Zustand weiß, den es angeblich verwaltet. Die
   * Deckkraft ändert sich hier sechzig Mal je Sekunde — das gehört an einen
   * ref, nicht an ein Memo.
   */
  const waveMatRef = useRef<THREE.MeshBasicMaterial>(null);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      waveGeometry.dispose();
    },
    [geometry, material, waveGeometry],
  );

  // Die Ereignisse. `positionsById` steht in den Abhängigkeiten, weil ein
  // Komet ohne bekannte Startposition nirgends beginnen kann.
  useEffect(() => {
    const onPulse = (event: Event) => {
      const ids: string[] = (event as CustomEvent).detail?.ids ?? [];
      const now = performance.now() / 1000;
      const fresh: Comet[] = [];
      for (const id of ids) {
        const from = positionsById.get(id);
        if (!from) continue;
        // Leicht versetzt gestartet, sonst fliegen sechs Lichter im
        // Gleichschritt und sehen aus wie ein einziges.
        fresh.push({ from: from.clone(), born: now + fresh.length * 0.09 });
        if (fresh.length >= MAX_COMETS) break;
      }
      if (fresh.length > 0) cometsRef.current = fresh;
    };

    const onScan = (event: Event) => {
      const active = Boolean((event as CustomEvent).detail?.active);
      scanRef.current = { active, since: performance.now() / 1000 };
    };

    window.addEventListener(KNOWLEDGE_PULSE_EVENT, onPulse);
    window.addEventListener(JARVIS_SCAN_EVENT, onScan);
    return () => {
      window.removeEventListener(KNOWLEDGE_PULSE_EVENT, onPulse);
      window.removeEventListener(JARVIS_SCAN_EVENT, onScan);
    };
  }, [positionsById]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const head = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (reducedMotion) return;
    const now = performance.now() / 1000;

    // ---- Die Abtastwelle -------------------------------------------------
    const wave = waveRef.current;
    const waveMat = waveMatRef.current;
    if (wave && waveMat) {
      const scan = scanRef.current;
      if (scan.active) {
        // Zwei Sekunden je Durchlauf, dann von vorn — solange gesucht wird.
        const u = ((now - scan.since) / 2) % 1;
        const radius = 0.6 + u * reach;
        wave.scale.setScalar(radius);
        // Am Anfang hell, am Ende weg. Quadratisch, damit die Welle nicht als
        // harter Ring stirbt.
        waveMat.opacity = 0.13 * (1 - u) * (1 - u);
        wave.visible = true;
      } else if (wave.visible) {
        waveMat.opacity *= 0.86;
        if (waveMat.opacity < 0.005) wave.visible = false;
      }
    }

    // ---- Die Kometen -----------------------------------------------------
    const beads = beadsRef.current;
    if (!beads) return;
    const comets = cometsRef.current;
    if (comets.length === 0) {
      if (beads.visible) beads.visible = false;
      return;
    }
    beads.visible = true;

    let written = 0;
    let alive = false;
    for (const comet of comets) {
      const age = now - comet.born;
      if (age < 0) {
        alive = true;
        continue;
      }
      if (age > FLIGHT + AFTERGLOW) continue;
      alive = true;

      for (let b = 0; b < BEADS; b++) {
        // Der Kopf liegt bei u, der Schweif dahinter. Fertig geflogene
        // Kometen bleiben als Nachglühen an der Notiz-Seite nicht stehen —
        // sie sammeln sich in der Mitte, dort kommt die Antwort her.
        const u = Math.min(1, age / FLIGHT) - b * BEAD_GAP;
        if (u < 0) continue;
        // Beschleunigt: langsam los, schnell an. Ein Licht, das mit
        // gleichmäßigem Tempo fliegt, sieht aus wie ein Fahrstuhl.
        const eased = u * u;
        head.copy(comet.from).lerp(TARGET, Math.min(1, eased));

        const tailFade = 1 - b / BEADS;
        const afterFade =
          age <= FLIGHT ? 1 : Math.max(0, 1 - (age - FLIGHT) / AFTERGLOW);
        const scale = (0.45 + tailFade * 0.75) * afterFade;
        if (scale < 0.02) continue;

        dummy.position.copy(head);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        if (written < MAX_COMETS * BEADS) beads.setMatrixAt(written++, dummy.matrix);
      }
    }

    // Alles Übrige aus dem Bild schieben. Eine InstancedMesh zeichnet immer
    // ihre volle Zahl; nicht benutzte Plätze müssen irgendwo stehen, und
    // "irgendwo" ist hier weit weg statt mittendrin.
    dummy.scale.setScalar(0);
    dummy.position.set(0, -9999, 0);
    dummy.updateMatrix();
    for (let i = written; i < MAX_COMETS * BEADS; i++) beads.setMatrixAt(i, dummy.matrix);
    beads.instanceMatrix.needsUpdate = true;

    if (!alive) cometsRef.current = [];
  });

  return (
    <group>
      <mesh ref={waveRef} geometry={waveGeometry} visible={false} frustumCulled={false}>
        <meshBasicMaterial
          ref={waveMatRef}
          color="#7dd3fc"
          transparent
          opacity={0}
          wireframe
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          // Von innen betrachtet wäre die Welle sonst weg, sobald die Kamera
          // in ihr steht — und in diesem Raum steht sie ständig in ihr.
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <instancedMesh
        ref={beadsRef}
        args={[geometry, material, MAX_COMETS * BEADS]}
        frustumCulled={false}
        visible={false}
      />
    </group>
  );
}
