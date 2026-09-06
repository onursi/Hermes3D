"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { KNOWLEDGE_PULSE_EVENT } from "@/features/retro-office/scene/VaultStars";
import { activeJarvisHead } from "@/features/v2/jarvis/jarvisAnchor";

/**
 * Sichtbar machen, dass Jarvis in Onurs Wissen greift.
 *
 * Zwei Anläufe hat das gebraucht, und beide Male lag der Fehler nicht an der
 * Technik, sondern am Bild:
 *
 * 1. Eine Welle vom Mittelpunkt nach außen. Sie zeigte Betrieb, aber keine
 *    Verbindung — niemand griff dort auf etwas zu.
 * 2. Gerade Linien von der Kugel zu den Notizen. Die Verbindung stimmte, aber
 *    Onurs Urteil war eindeutig: "das mit den Linien hab ich als störend
 *    empfunden." Zu Recht. Ein gerader Strich über den halben Bildschirm ist
 *    ein Diagramm, kein Zugriff. Er liegt ruhig da, während er etwas
 *    Gewaltsames behaupten soll.
 *
 * Jetzt ist es ein **Blitz**. Derselbe Weg, dieselbe Aussage, aber die Form
 * stimmt: er zuckt, er springt, er steht nie still, und er ist nur da,
 * während wirklich zugegriffen wird. Am Ende jedes Blitzes läuft Licht die
 * Bahn zurück in die Kugel — das Heraussaugen.
 *
 * Zuhause dagegen **Radiowellen**: Ringe, die der Kern kreuz und quer ins All
 * schickt, um zu suchen. Auch das ist Onurs Bild, und es passt dort besser —
 * zuhause ist der Himmel weit und die Notizen stehen als Sterne darin. Man
 * ruft hinaus, statt zu greifen.
 *
 * Beide Formen hängen an echten Ereignissen. Nichts hier läuft auf einer Uhr.
 */

/** Sagt dem Raum, dass eine Suche läuft oder vorbei ist. */
export const JARVIS_SCAN_EVENT = "hermes_jarvis_scan";

/** Wie lange das Licht von der Notiz bis zur Kugel braucht, in Sekunden. */
const FLIGHT = 1.6;

/** Wie lange ein Blitz danach noch zuckt, bevor er erlischt. */
const AFTERGLOW = 2.4;

/** Höchstzahl gleichzeitiger Blitze. Jarvis zitiert sechs; acht ist Luft. */
const MAX_LINKS = 8;

/**
 * Knicke je Blitz.
 *
  * Bei 15 Knicken und weltbezogener Auslenkung kam ein Gebirgszug heraus:
 * wenige, sehr weite Zacken, die quer über den Bildschirm liefen. Ein Funke
 * ist fein und dicht gezackt. 24 Knicke bei einem Bruchteil der Auslenkung
 * sind das, was wie Strom aussieht.
 */
const KINKS = 40;

/** Perlen je Bahn — das Licht, das zurückläuft. */
const BEADS = 6;
const BEAD_GAP = 0.04;

/** Wie viele tastende Blitze während der Suche zucken. */
const FEELERS = 3;

/**
 * Falls kein Kopf gemeldet ist: dort, wo die Kugel steht.
 *
 * Das ist ein Notnagel und keine Rechnung. Der Ansatzpunkt kommt normalerweise
 * aus der **gemessenen** Lage des sichtbaren Kopfes (siehe jarvisAnchor.ts) —
 * feste Zahlen waren genau der Fehler, den Onur gesehen hat: der Blitz kam aus
 * der Ecke, während er das Gesicht im Fenster ansah.
 */
const FALLBACK_INSET_X = 52;
const FALLBACK_INSET_Y = 124;

/** Wie weit vor der Kamera der Ansatzpunkt liegt. */
const ANCHOR_DISTANCE = 4.2;

/** Wie viele Radiowellen zuhause gleichzeitig unterwegs sind. */
const RINGS = 7;

type Link = { at: THREE.Vector3; born: number };

type Props = {
  /** Wo jede Notiz steht. Kommt aus dem Layout, wird hier nur gelesen. */
  positionsById: Map<string, THREE.Vector3>;
  /**
   * Woher der Zugriff ausgeht.
   *
   * Im Wissenskosmos die Kugel unten rechts — eine Bildschirmecke, also aus
   * der Kamera zurückgerechnet. Zuhause der Kern in der Mitte des Decks.
   */
  from?: "camera" | THREE.Vector3;
  /** Blitz (Kosmos) oder Radiowellen (zuhause). */
  look?: "arc" | "waves";
  /** Wie weit die tastenden Blitze und die Wellen greifen. */
  reach?: number;
  reducedMotion?: boolean;
};

export function BrainAccess({
  positionsById,
  from = "camera",
  look = "arc",
  reach = 20,
  reducedMotion = false,
}: Props) {
  const { camera, size } = useThree();
  const linksRef = useRef<Link[]>([]);
  const scanRef = useRef({ active: false, since: 0 });

  const beadsRef = useRef<THREE.InstancedMesh>(null);
  const boltsRef = useRef<THREE.LineSegments>(null);
  const ringsRef = useRef<THREE.InstancedMesh>(null);

  const beadGeometry = useMemo(() => new THREE.SphereGeometry(0.1, 10, 10), []);
  const beadMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#cfefff"),
        transparent: true,
        // Additiv, weil das Licht ist und kein Körper.
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  /**
   * Ein Ring, sehr dünn.
   *
   * Zuhause reicht das: sieben Instanzen davon, jede in eine andere Richtung
   * gedreht und mit eigener Phase, ergeben das Bild von Rufen, die kreuz und
   * quer hinausgehen. Ein Zeichenaufruf für alle sieben.
   */
  const ringGeometry = useMemo(() => new THREE.RingGeometry(0.985, 1, 72), []);
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#8ad8ff"),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        // Von hinten gesehen wäre ein Ring sonst weg, und die Kamera steht
        // zuhause mitten zwischen ihnen.
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  /**
   * Die Blitze als ein einziges LineSegments-Objekt.
   *
   * Ein Blitz ist ein Streckenzug aus fünfzehn Knicken, dessen Punkte jedes
   * Bild neu gesetzt werden. Elf Blitze zu je fünfzehn Strecken sind gut
   * tausend Zahlen — das ist der Fall, in dem Pufferschreiben billiger ist
   * als Objekte, und der einzige Weg zu einer Form, die sich wirklich bewegt.
   */
  const boltGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = (MAX_LINKS + FEELERS) * KINKS * 2;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
    geo.setAttribute("aFade", new THREE.BufferAttribute(new Float32Array(vertices), 1));
    return geo;
  }, []);

  useEffect(
    () => () => {
      beadGeometry.dispose();
      beadMaterial.dispose();
      boltGeometry.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
    [beadGeometry, beadMaterial, boltGeometry, ringGeometry, ringMaterial],
  );

  useEffect(() => {
    const onPulse = (event: Event) => {
      const ids: string[] = (event as CustomEvent).detail?.ids ?? [];
      const now = performance.now() / 1000;
      const fresh: Link[] = [];
      for (const id of ids) {
        const at = positionsById.get(id);
        if (!at) continue;
        // Leicht versetzt, sonst schlagen sechs Blitze im Gleichschritt ein.
        fresh.push({ at: at.clone(), born: now + fresh.length * 0.13 });
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
  const dir = useMemo(() => new THREE.Vector3(), []);
  const perpA = useMemo(() => new THREE.Vector3(), []);
  const perpB = useMemo(() => new THREE.Vector3(), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  const previous = useMemo(() => new THREE.Vector3(), []);
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  useFrame(() => {
    if (reducedMotion) return;
    const now = performance.now() / 1000;
    const scan = scanRef.current;
    const links = linksRef.current;

    const beads = beadsRef.current;
    const bolts = boltsRef.current;
    const rings = ringsRef.current;
    if (!beads || !bolts || !rings) return;

    const showing = scan.active || links.length > 0;

    // ---- Ansatzpunkt -----------------------------------------------------
    if (from === "camera") {
      // Aus der **gemessenen** Lage des sichtbaren Kopfes zurückgerechnet.
      // Ist das Fenster offen, ist das das Gesicht darin; sonst die Kugel in
      // der Ecke. So gehört der Blitz immer zu dem Kopf, den man ansieht.
      const head = activeJarvisHead();
      const px = head ? head.x : size.width - FALLBACK_INSET_X;
      const py = head ? head.y : size.height - FALLBACK_INSET_Y;
      const ndcX = (px / size.width) * 2 - 1;
      const ndcY = -((py / size.height) * 2 - 1);
      anchor.set(ndcX, ndcY, 0.5).unproject(camera);
      forward.copy(anchor).sub(camera.position).normalize();
      anchor.copy(camera.position).addScaledVector(forward, ANCHOR_DISTANCE);
    } else {
      anchor.copy(from);
    }

    // ---- Radiowellen, zuhause -------------------------------------------
    if (look === "waves" && showing) {
      rings.visible = true;
      for (let i = 0; i < RINGS; i++) {
        // Jeder Ring hat seine eigene Phase und seine eigene Achse. Die Achsen
        // sind aus dem Index abgeleitet und nicht gewürfelt: so stehen sie
        // ruhig im Raum, statt Bild für Bild zu springen.
        const u = (now * 0.4 + i / RINGS) % 1;
        const axis = i * 2.399;
        euler.set(Math.sin(axis) * 1.4, axis, Math.cos(axis * 0.7) * 1.1);
        dummy.position.copy(anchor);
        dummy.rotation.copy(euler);
        dummy.scale.setScalar(1 + u * reach);
        dummy.updateMatrix();
        rings.setMatrixAt(i, dummy.matrix);
      }
      rings.instanceMatrix.needsUpdate = true;
      // Alle Ringe teilen ein Material und damit eine Deckkraft. Sie ist
      // bewusst klein: Onur wollte "so minimal wie Radiowellen".
      ringMaterial.opacity = 0.17;
    } else if (rings.visible) {
      ringMaterial.opacity *= 0.9;
      if (ringMaterial.opacity < 0.01) rings.visible = false;
    }

    // ---- Blitze und Rückfluss -------------------------------------------
    if (!showing) {
      if (beads.visible) {
        beads.visible = false;
        bolts.visible = false;
      }
      return;
    }
    beads.visible = true;
    bolts.visible = look === "arc";

    const positions = boltGeometry.attributes.position.array as Float32Array;
    const fades = boltGeometry.attributes.aFade.array as Float32Array;
    let seg = 0;
    const capacity = (MAX_LINKS + FEELERS) * KINKS;

    /**
     * Einen Blitz zeichnen: von `anchor` nach `to`, mit Knicken.
     *
     * Die Knicke kommen aus einer **im Takt springenden** Zeit, nicht aus
     * einer laufenden. Ein Blitz, dessen Zacken weich wandern, sieht aus wie
     * ein Seil im Wind; einer, der zwanzigmal je Sekunde eine neue Form
     * annimmt, sieht aus wie Strom.
     */
    const drawBolt = (to: THREE.Vector3, seed: number, strength: number, grown: number) => {
      dir.copy(to).sub(anchor);
      const length = dir.length();
      if (length < 0.001) return;
      dir.divideScalar(length);
      // Zwei Querrichtungen, damit der Blitz im Raum zackt und nicht nur in
      // einer Ebene — sonst sieht er aus wie eine gefaltete Schnur.
      perpA.crossVectors(dir, UP);
      if (perpA.lengthSq() < 0.01) perpA.set(1, 0, 0);
      perpA.normalize();
      perpB.crossVectors(dir, perpA).normalize();

      const snap = Math.floor(now * 22);

      previous.copy(anchor);
      for (let k = 1; k <= KINKS; k++) {
        if (seg >= capacity) return;
        const u = (k / KINKS) * grown;
        point.copy(anchor).addScaledVector(dir, length * u);
        if (k < KINKS) {
          /**
           * Die Auslenkung wird **auf dem Bildschirm** gemessen, nicht im Raum.
           *
           * Erst hing sie an der Länge des Blitzes. Das ging zweimal daneben:
           * die Kugel sitzt vier Einheiten vor der Kamera, die Notizen sechzig
           * dahinter, und ein fester Weltwert ist vorne riesig und hinten
           * unsichtbar. Herausgekommen sind flache Linien, die über den halben
           * Bildschirm wanderten — genau das, was Onur als störend bezeichnet
           * hat, nur krumm.
           *
           * Der Abstand zur Kamera als Maßstab dreht das um: ein fester
           * Bruchteil davon ist an jeder Stelle **gleich viele Bildpunkte**.
           * Der Blitz zackt vorne wie hinten gleich fein.
           */
          const depth = point.distanceTo(camera.position);
          // Zwei Grobheiten übereinander: eine weite Auslenkung, die dem
          // Blitz seinen Verlauf gibt, und ein feines Zittern darauf. Nur die
          // weite allein ergibt eine Wellenlinie, nur die feine ein Rauschen.
          const spread = depth * 0.013;
          // In der Mitte am stärksten ausgelenkt, an beiden Enden auf null:
          // ein Blitz, der neben seinem Ziel endet, trifft sichtbar daneben.
          const envelope = Math.sin(u * Math.PI);
          const a =
            Math.sin(snap * 1.7 + k * 5.9 + seed * 11.1) +
            0.5 * Math.sin(snap * 3.1 + k * 13.7 + seed * 4.2);
          const b =
            Math.sin(snap * 2.3 + k * 4.7 + seed * 7.7) +
            0.5 * Math.sin(snap * 4.3 + k * 11.3 + seed * 9.4);
          point.addScaledVector(perpA, a * spread * envelope);
          point.addScaledVector(perpB, b * spread * envelope);
        }
        const i = seg * 6;
        positions[i] = previous.x;
        positions[i + 1] = previous.y;
        positions[i + 2] = previous.z;
        positions[i + 3] = point.x;
        positions[i + 4] = point.y;
        positions[i + 5] = point.z;
        // Hell an der Kugel, schwächer weiter draußen.
        const near = 1 - u * 0.5;
        fades[seg * 2] = strength * near;
        fades[seg * 2 + 1] = strength * near;
        seg++;
        previous.copy(point);
      }
    };

    let written = 0;

    if (look === "arc" && scan.active) {
      /**
       * Das Abrastern.
       *
       * Vorher zuckten hier drei Blitze in zufällige Richtungen. Das sah nach
       * Betrieb aus, aber nicht nach **Suchen**: nichts daran hatte eine
       * Ordnung, und wer sucht, geht durch. Jetzt dreht sich eine Suchkeule
       * mit fester Geschwindigkeit um den Kosmos, und die Blitze fahren in
       * genau die Richtung, in der sie gerade steht.
       *
       * Und — das ist der Teil, der es zu einer Anzeige macht — jede Notiz,
       * über die die Keule streicht, blitzt kurz auf. Man sieht also, **was
       * gerade angesehen wird**, nicht nur, dass etwas passiert. Die Notizen
       * sind echt; sie kommen aus derselben Karte, aus der später die Treffer
       * kommen.
       */
      const sweep = (now - scan.since) * 1.25;
      for (let f = 0; f < FEELERS; f++) {
        // Ein schmaler Fächer um die Keule, damit die Front eine Breite hat.
        const angle = sweep + (f - (FEELERS - 1) / 2) * 0.22;
        probe
          .set(Math.cos(angle), Math.sin(now * 0.9 + f) * 0.35, Math.sin(angle))
          .normalize()
          .multiplyScalar(reach * 0.95);
        // In Schüben: ein Blitz, der ununterbrochen brennt, ist eine Leitung,
        // und Leitungen waren genau das Problem.
        const strobe = Math.sin(now * 26 + f * 2) > -0.35 ? 1 : 0.22;
        drawBolt(probe, f + 3, strobe * 0.55, 1);
      }

      // Die Notizen unter der Keule aufblitzen lassen.
      const cos = Math.cos(sweep);
      const sin = Math.sin(sweep);
      for (const at of positionsById.values()) {
        const len = Math.hypot(at.x, at.z);
        if (len < 0.001) continue;
        // Kosinus zwischen Notizrichtung und Keule — billiger als ein Winkel
        // und für einen Schwellwert genauso gut.
        const alignment = (at.x * cos + at.z * sin) / len;
        if (alignment < 0.985) continue;
        dummy.position.copy(at);
        dummy.rotation.set(0, 0, 0);
        // Klein: ein Streifschuss, kein Treffer. Treffer sehen anders aus.
        dummy.scale.setScalar(0.75);
        dummy.updateMatrix();
        if (written < MAX_LINKS * BEADS) beads.setMatrixAt(written++, dummy.matrix);
        else break;
      }
    }

    let alive = false;
    for (let index = 0; index < links.length; index++) {
      const link = links[index];
      const age = now - link.born;
      if (age < 0) {
        alive = true;
        continue;
      }
      if (age > FLIGHT + AFTERGLOW) continue;
      alive = true;

      // Der Blitz schlägt in gut einer Zehntelsekunde ein und zuckt weiter,
      // solange die Antwort gilt.
      const grown = Math.min(1, age / 0.12);
      const after = age <= FLIGHT ? 1 : Math.max(0, 1 - (age - FLIGHT) / AFTERGLOW);
      // Flackern: ein Blitz ist nie gleichmäßig hell.
      const flicker = 0.4 + 0.6 * Math.abs(Math.sin(now * 17 + index * 2.1));
      if (look === "arc") drawBolt(link.at, index, 0.95 * after * flicker, grown);

      // Und das Licht läuft die Bahn zurück — das Heraussaugen.
      for (let b = 0; b < BEADS; b++) {
        const u = Math.min(1, age / FLIGHT) - b * BEAD_GAP;
        if (u < 0) continue;
        head.copy(link.at).lerp(anchor, Math.min(1, u * u));
        const tail = 1 - b / BEADS;
        const scale = (0.4 + tail * 0.85) * after;
        if (scale < 0.02) continue;
        dummy.position.copy(head);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        if (written < MAX_LINKS * BEADS) beads.setMatrixAt(written++, dummy.matrix);
      }
    }

    // Nicht benutzte Strecken auf einen Punkt zusammenziehen — der Puffer
    // wird immer ganz gezeichnet, und "auf sich selbst" zeichnet nichts.
    for (let i = seg; i < capacity; i++) {
      positions.fill(0, i * 6, i * 6 + 6);
      fades[i * 2] = 0;
      fades[i * 2 + 1] = 0;
    }
    boltGeometry.attributes.position.needsUpdate = true;
    boltGeometry.attributes.aFade.needsUpdate = true;

    dummy.scale.setScalar(0);
    dummy.position.set(0, -9999, 0);
    dummy.updateMatrix();
    for (let i = written; i < MAX_LINKS * BEADS; i++) beads.setMatrixAt(i, dummy.matrix);
    beads.instanceMatrix.needsUpdate = true;

    if (!alive && links.length > 0) linksRef.current = [];
  });

  return (
    <group>
      <lineSegments ref={boltsRef} geometry={boltGeometry} frustumCulled={false} visible={false}>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          uniforms={{}}
          vertexShader={/* glsl */ `
            attribute float aFade;
            varying float vFade;
            void main() {
              vFade = aFade;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            varying float vFade;
            void main() {
              // Weiß im Kern, blau nach außen — so sieht ein Funke aus. Eine
              // Linie in genau einer Farbe sieht aus wie ein Diagramm.
              vec3 hot = vec3(0.92, 0.99, 1.0);
              vec3 cool = vec3(0.34, 0.72, 1.0);
              float f = clamp(vFade, 0.0, 1.0);
              gl_FragColor = vec4(mix(cool, hot, f), f);
            }
          `}
        />
      </lineSegments>

      <instancedMesh
        ref={ringsRef}
        args={[ringGeometry, ringMaterial, RINGS]}
        frustumCulled={false}
        visible={false}
      />

      <instancedMesh
        ref={beadsRef}
        args={[beadGeometry, beadMaterial, MAX_LINKS * BEADS]}
        frustumCulled={false}
        visible={false}
      />
    </group>
  );
}
