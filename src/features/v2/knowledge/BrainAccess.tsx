"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { KNOWLEDGE_PULSE_EVENT } from "@/features/retro-office/scene/VaultStars";

/**
 * Sichtbar machen, dass Jarvis in Onurs Wissen greift.
 *
 * Seine Vorgabe war deutlich: man soll sehen, "dass sich dieser Hermespunkt
 * mit meinem Gehirn vernetzt, also so ein Strahl, der in den Index reinläuft".
 * Die erste Fassung hatte das falsche Bild: eine Welle, die vom Mittelpunkt
 * des Kosmos nach außen lief. Sie zeigte Betrieb, aber keine **Verbindung** —
 * niemand griff dort auf etwas zu, es pulsierte nur.
 *
 * Jetzt gibt es einen Absender. Der Strahl beginnt dort, wo die Kugel auf dem
 * Bildschirm steht: unten rechts. Weil das eine Bildschirmecke ist und keine
 * Stelle im Raum, wird der Ansatzpunkt jedes Bild aus der Kamera gerechnet —
 * er wandert mit dem Blick mit und bleibt trotzdem immer die Kugel.
 *
 * Drei Dinge passieren, und jedes hängt an einem echten Ereignis:
 *
 * 1. **Tastende Strahlen.** Solange gesucht wird, greifen kurze Strahlen aus
 *    der Kugel in die Wolke. Sie zeigen: er sucht, weiß aber noch nicht wo.
 * 2. **Leitungen.** Sobald feststeht, welche Notizen gelesen werden, spannt
 *    sich von der Kugel zu jeder eine Linie. Das ist die Vernetzung.
 * 3. **Rückfluss.** An jeder gelesenen Notiz löst sich Licht und läuft die
 *    Leitung entlang zurück in die Kugel. Das Wissen kommt zu ihm.
 *
 * Eine Animation auf einem Zeitgeber sähe in allen drei Fällen gleich aus,
 * ob etwas passiert ist oder nicht — deshalb hängt hier nichts an einer Uhr.
 */

/** Sagt dem Raum, dass eine Suche läuft oder vorbei ist. */
export const JARVIS_SCAN_EVENT = "hermes_jarvis_scan";

/** Wie lange das Licht von der Notiz bis zur Kugel braucht, in Sekunden. */
const FLIGHT = 1.7;

/** Wie lange eine Leitung danach noch steht, bevor sie verblasst. */
const AFTERGLOW = 3.2;

/** Höchstzahl gleichzeitiger Leitungen. Jarvis zitiert sechs; zehn ist Luft. */
const MAX_LINKS = 10;

/** Perlen je Leitung — der Schweif des zurücklaufenden Lichts. */
const BEADS = 7;

/** Abstand der Perlen entlang der Bahn, als Anteil der Gesamtstrecke. */
const BEAD_GAP = 0.035;

/** Wie viele tastende Strahlen während der Suche laufen. */
const FEELERS = 5;

/**
 * Wo die Kugel auf dem Bildschirm sitzt, von der rechten unteren Ecke aus.
 *
 * Muss zu JarvisOrb.tsx passen: dort steht sie 24 Bildpunkte vom Rand und ist
 * 56 groß, ihre Mitte liegt also 52 von rechts; unten sind es 96 plus 28.
 * Zwei Zahlen an zwei Stellen sind eine Gelegenheit auseinanderzulaufen —
 * darum stehen sie hier mit dem Grund dabei, warum sie diese Werte haben.
 */
const ORB_INSET_X = 52;
const ORB_INSET_Y = 124;

/** Wie weit vor der Kamera der Ansatzpunkt liegt. */
const ANCHOR_DISTANCE = 4.2;

type Link = { at: THREE.Vector3; born: number };

type Props = {
  /** Wo jede Notiz steht. Kommt aus dem Layout, wird hier nur gelesen. */
  positionsById: Map<string, THREE.Vector3>;
  /**
   * Woher der Strahl kommt.
   *
   * Im Wissenskosmos ist das die Kugel unten rechts — eine Bildschirmecke,
   * also aus der Kamera gerechnet. Zuhause ist es der **Kern in der Mitte des
   * Decks**: dort ist Hermes ein Ding im Raum und keine Ecke, und der Strahl
   * greift von dort in den Sternenhimmel, der Onurs Notizen ist.
   *
   * Beide Räume teilen sich diese Datei, weil sie dieselbe Sache zeigen. Zwei
   * Fassungen desselben Effekts wären zwei Gelegenheiten, ihn verschieden
   * aussehen zu lassen.
   */
  from?: "camera" | THREE.Vector3;
  /** Wie weit die tastenden Strahlen greifen. */
  reach?: number;
  reducedMotion?: boolean;
};

export function BrainAccess({
  positionsById,
  from = "camera",
  reach = 20,
  reducedMotion = false,
}: Props) {
  const { camera, size } = useThree();
  const linksRef = useRef<Link[]>([]);
  const scanRef = useRef({ active: false, since: 0 });

  const beadsRef = useRef<THREE.InstancedMesh>(null);
  const wiresRef = useRef<THREE.LineSegments>(null);

  const beadGeometry = useMemo(() => new THREE.SphereGeometry(0.1, 10, 10), []);
  const beadMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#cfefff"),
        transparent: true,
        // Additiv, weil das Licht ist und kein Körper: zwei, die sich
        // überlagern, sollen heller werden statt einander zu verdecken.
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  /**
   * Die Leitungen als ein einziges LineSegments-Objekt.
   *
   * Eine Linie je Quelle wären zehn Zeichenaufrufe für zehn Striche. Hier
   * liegen alle in einem Puffer, dessen Punkte jedes Bild neu geschrieben
   * werden — das ist der eine Fall, in dem Puffer-Schreiben billiger ist als
   * Objekte: 30 Zahlen, nicht 30.000.
   */
  const wireGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = (MAX_LINKS + FEELERS) * 2;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aFade", new THREE.BufferAttribute(new Float32Array(count), 1));
    return geo;
  }, []);
  const wireMatRef = useRef<THREE.ShaderMaterial>(null);

  useEffect(
    () => () => {
      beadGeometry.dispose();
      beadMaterial.dispose();
      wireGeometry.dispose();
    },
    [beadGeometry, beadMaterial, wireGeometry],
  );

  useEffect(() => {
    const onPulse = (event: Event) => {
      const ids: string[] = (event as CustomEvent).detail?.ids ?? [];
      const now = performance.now() / 1000;
      const fresh: Link[] = [];
      for (const id of ids) {
        const at = positionsById.get(id);
        if (!at) continue;
        // Leicht versetzt, sonst zünden sechs Leitungen im Gleichschritt und
        // sehen aus wie eine einzige breite.
        fresh.push({ at: at.clone(), born: now + fresh.length * 0.11 });
        if (fresh.length >= MAX_LINKS) break;
      }
      if (fresh.length > 0) linksRef.current = fresh;
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
  const anchor = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const probe = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (reducedMotion) return;
    const now = performance.now() / 1000;
    const scan = scanRef.current;
    const links = linksRef.current;

    const beads = beadsRef.current;
    const wires = wiresRef.current;
    const wireMat = wireMatRef.current;
    if (!beads || !wires || !wireMat) return;

    const anythingToShow = scan.active || links.length > 0;
    if (!anythingToShow) {
      if (beads.visible) {
        beads.visible = false;
        wires.visible = false;
      }
      return;
    }
    beads.visible = true;
    wires.visible = true;

    /**
     * Der Ansatzpunkt der Kugel, im Raum.
     *
     * Die Kugel steht unten rechts auf dem **Bildschirm**. Ein fester Punkt in
     * der Szene würde beim Drehen der Kamera irgendwohin wandern; deshalb wird
     * er aus der Blickrichtung gebaut: ein Stück nach vorn, nach rechts und
     * nach unten. So beginnt der Strahl aus jedem Blickwinkel dort, wo das
     * Licht tatsächlich leuchtet.
     */
    if (from === "camera") {
      /**
       * Der Punkt, an dem die Kugel wirklich leuchtet.
       *
       * Erst stand hier "ein Stück nach vorn, rechts und unten" mit von Hand
       * gewählten Zahlen. Das traf die Ecke ungefähr und wanderte, sobald sich
       * das Sichtfeld änderte. Richtig ist der umgekehrte Weg: aus der
       * Bildschirmlage der Kugel eine Bildkoordinate machen und die
       * zurückrechnen. Dann beginnt der Strahl genau dort, wo das Licht ist —
       * bei jedem Sichtfeld und jeder Fenstergröße.
       */
      const ndcX = 1 - (2 * ORB_INSET_X) / size.width;
      const ndcY = -1 + (2 * ORB_INSET_Y) / size.height;
      anchor.set(ndcX, ndcY, 0.5).unproject(camera);
      // Auf eine feste Entfernung vor die Kamera geschoben: die Rückrechnung
      // liefert nur eine Richtung, keine Tiefe.
      forward.copy(anchor).sub(camera.position).normalize();
      anchor.copy(camera.position).addScaledVector(forward, ANCHOR_DISTANCE);
    } else {
      // Ein fester Ort im Raum — der Kern auf dem Deck.
      anchor.copy(from);
    }

    // ---- Leitungen und tastende Strahlen --------------------------------
    const positions = wireGeometry.attributes.position.array as Float32Array;
    const fades = wireGeometry.attributes.aFade.array as Float32Array;
    let seg = 0;

    const pushSegment = (to: THREE.Vector3, fadeFar: number) => {
      const i = seg * 6;
      positions[i] = anchor.x;
      positions[i + 1] = anchor.y;
      positions[i + 2] = anchor.z;
      positions[i + 3] = to.x;
      positions[i + 4] = to.y;
      positions[i + 5] = to.z;
      // Hell an der Kugel, schwächer am fernen Ende: die Leitung geht von ihm
      // aus, und das soll man an ihr sehen.
      fades[seg * 2] = fadeFar * 1.4;
      fades[seg * 2 + 1] = fadeFar * 0.35;
      seg++;
    };

    if (scan.active) {
      // Tastende Strahlen: sie greifen in die Wolke und ziehen sich zurück,
      // zwei Sekunden je Zug, jeder in eine andere Richtung.
      for (let f = 0; f < FEELERS; f++) {
        const u = ((now - scan.since) * 0.55 + f / FEELERS) % 1;
        const angle = f * 2.399 + now * 0.35;
        const lift = Math.sin(f * 1.7 + now * 0.5) * 0.55;
        probe
          .set(Math.cos(angle), lift, Math.sin(angle))
          .normalize()
          // Um den Mittelpunkt des Kosmos herum, nicht um die Kamera: dort
          // stehen die Notizen, und dorthin greift er. Der Mittelpunkt ist
          // der Ursprung, also braucht es keine Verschiebung — und schon gar
          // keinen neuen Vektor je Bild.
          .multiplyScalar(reach * (0.25 + u * 0.85));
        // Auf und ab: hell beim Ausfahren, weg am Ende.
        pushSegment(probe, Math.sin(u * Math.PI) * 0.55);
      }
    }

    let written = 0;
    let alive = false;
    for (const link of links) {
      const age = now - link.born;
      if (age < 0) {
        alive = true;
        continue;
      }
      if (age > FLIGHT + AFTERGLOW) continue;
      alive = true;

      // Die Leitung zieht sich in der ersten halben Sekunde auf und bleibt
      // dann stehen, solange die Antwort gilt.
      const draw = Math.min(1, age / 0.45);
      const after = age <= FLIGHT ? 1 : Math.max(0, 1 - (age - FLIGHT) / AFTERGLOW);
      head.copy(anchor).lerp(link.at, draw);
      if (seg < MAX_LINKS + FEELERS) pushSegment(head, 0.75 * after);

      // Und das Licht läuft die fertige Leitung zurück.
      for (let b = 0; b < BEADS; b++) {
        const u = Math.min(1, age / FLIGHT) - b * BEAD_GAP;
        if (u < 0) continue;
        // Beschleunigt: langsam los, schnell an. Gleichmäßiges Tempo sieht
        // aus wie ein Fahrstuhl.
        head.copy(link.at).lerp(anchor, Math.min(1, u * u));
        const tail = 1 - b / BEADS;
        const scale = (0.45 + tail * 0.8) * after;
        if (scale < 0.02) continue;
        dummy.position.copy(head);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        if (written < MAX_LINKS * BEADS) beads.setMatrixAt(written++, dummy.matrix);
      }
    }

    // Nicht benutzte Strecken auf null zusammenziehen — der Puffer wird immer
    // ganz gezeichnet, also müssen die übrigen Punkte irgendwo liegen, und
    // "auf sich selbst" zeichnet nichts.
    for (let i = seg; i < MAX_LINKS + FEELERS; i++) {
      const o = i * 6;
      positions.fill(0, o, o + 6);
      fades[i * 2] = 0;
      fades[i * 2 + 1] = 0;
    }
    wireGeometry.attributes.position.needsUpdate = true;
    wireGeometry.attributes.aFade.needsUpdate = true;
    wireMat.uniforms.uTime.value = now;

    dummy.scale.setScalar(0);
    dummy.position.set(0, -9999, 0);
    dummy.updateMatrix();
    for (let i = written; i < MAX_LINKS * BEADS; i++) beads.setMatrixAt(i, dummy.matrix);
    beads.instanceMatrix.needsUpdate = true;

    if (!alive && links.length > 0) linksRef.current = [];
  });

  return (
    <group>
      <lineSegments ref={wiresRef} geometry={wireGeometry} frustumCulled={false} visible={false}>
        <shaderMaterial
          ref={wireMatRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={/* glsl */ `
            attribute float aFade;
            varying float vFade;
            void main() {
              vFade = aFade;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            uniform float uTime;
            varying float vFade;
            void main() {
              // Ein leises Flackern auf der Leitung — sie überträgt etwas.
              float pulse = 0.85 + 0.15 * sin(uTime * 9.0);
              gl_FragColor = vec4(vec3(0.55, 0.86, 1.0), clamp(vFade, 0.0, 1.0) * pulse);
            }
          `}
        />
      </lineSegments>
      <instancedMesh
        ref={beadsRef}
        args={[beadGeometry, beadMaterial, MAX_LINKS * BEADS]}
        frustumCulled={false}
        visible={false}
      />
    </group>
  );
}
