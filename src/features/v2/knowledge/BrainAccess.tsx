"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { KNOWLEDGE_PULSE_EVENT } from "@/features/retro-office/scene/VaultStars";
import { activeJarvisHead } from "@/features/v2/jarvis/jarvisAnchor";
import { reportBrainLink } from "@/features/v2/jarvis/brainLink";

/**
 * Die Verbindung von Jarvis zum Gehirn.
 *
 * Vier Anläufe hat das gebraucht, und am Ende hat Onur selbst eine HTML gebaut,
 * um mir zu zeigen, was er meint. Der entscheidende Satz stand darin:
 *
 *   "Verbindung aufbauen, Scan sichtbar machen, relevante Knoten aufleuchten
 *    lassen, Ergebnis zurück in Jarvis führen" — und: "keine globale
 *    Effektschlacht".
 *
 * Genau daran bin ich dreimal vorbeigelaufen. Ich habe **acht Blitze zu acht
 * einzelnen Notizen** gezogen, quer über den ganzen Bildschirm. Jeder einzelne
 * war rechnerisch richtig am Kopf verankert — und zusammen ergaben sie ein
 * Netz, in dem der Ursprung nicht mehr zu sehen war. Er hat nie acht
 * Verbindungen verlangt. Er wollte **eine**: von Jarvis ins Gehirn.
 *
 * Also jetzt:
 *
 * 1. **Ein Strahl.** Ein einziges breites Band vom Kopf zur Wissenswolke.
 *    Als Band aus Dreiecken, weil WebGL Linienbreite nicht kennt — ein
 *    sichtbarer Strahl braucht Fläche.
 * 2. **Das Abtasten.** Eine Keule dreht durch die Wolke; jede Notiz, über die
 *    sie streicht, blitzt auf. Man sieht, was gerade angesehen wird.
 * 3. **Die Treffer.** Sobald feststeht, welche Notizen gelesen werden, gehen
 *    kurze Stiche vom Strahlende zu genau diesen — **innerhalb** der Wolke,
 *    nicht über den halben Bildschirm.
 * 4. **Der Rückfluss.** Licht läuft den Strahl zurück in den Kopf.
 *
 * Alles im **Bildraum** gebaut und danach in den Raum zurückgerechnet: eine
 * gerade Weltlinie von einer fernen Notiz zu einem Punkt neben dem Auge
 * verlässt unterwegs das Sichtfeld — daran ist der dritte Anlauf gescheitert.
 */

/** Sagt dem Raum, dass eine Suche läuft oder vorbei ist. */
export const JARVIS_SCAN_EVENT = "hermes_jarvis_scan";

/** Wie lange das Licht vom Gehirn bis zum Kopf braucht, in Sekunden. */
const FLIGHT = 1.5;

/** Wie lange der Strahl nach dem Lesen noch steht. */
const AFTERGLOW = 2.6;

/** Wie viele Lichter gleichzeitig zurücklaufen. */
const RETURN_LIGHTS = 14;

/** Wie viele Notizen die Suchkeule gleichzeitig aufblitzen lässt. */
const SCAN_FLASHES = 12;

/** Höchstzahl kurzer Stiche zu gelesenen Notizen. */
const MAX_STITCHES = 8;
/** Knicke je Stich. Kurz und fein — sie liegen ganz in der Wolke. */
const STITCH_KINKS = 12;

/** Wie viele Plätze die Instanzenwolke insgesamt hat. */
const BEAD_SLOTS = RETURN_LIGHTS + SCAN_FLASHES + 1;

/**
 * Falls kein Kopf gemeldet ist: dort, wo die Kugel steht.
 *
 * Notnagel, keine Rechnung. Normalerweise kommt der Ansatzpunkt aus der
 * gemessenen Lage des sichtbaren Kopfes (jarvisAnchor.ts).
 */
const FALLBACK_INSET_X = 52;
const FALLBACK_INSET_Y = 124;

/** Wie weit vor der Kamera der Ansatzpunkt liegt. */
const ANCHOR_DISTANCE = 4.2;

/** Wie viele Radiowellen zuhause gleichzeitig unterwegs sind. */
const RINGS = 7;

type Props = {
  /** Wo jede Notiz steht. Kommt aus dem Layout, wird hier nur gelesen. */
  positionsById: Map<string, THREE.Vector3>;
  /**
   * Woher der Zugriff ausgeht: im Kosmos der Kopf auf dem Bildschirm,
   * zuhause der Kern in der Mitte des Decks.
   */
  from?: "camera" | THREE.Vector3;
  /** Strahl (Kosmos) oder Radiowellen (zuhause). */
  look?: "beam" | "waves";
  /** Wie weit die Wellen zuhause greifen. */
  reach?: number;
  reducedMotion?: boolean;
};

export function BrainAccess({
  positionsById,
  from = "camera",
  look = "beam",
  reach = 20,
  reducedMotion = false,
}: Props) {
  const { camera, size } = useThree();
  /** Die gelesenen Notizen und wann sie gemeldet wurden. */
  const readRef = useRef<{ at: THREE.Vector3[]; born: number }>({ at: [], born: 0 });
  const scanRef = useRef({ active: false, since: 0 });

  const beadsRef = useRef<THREE.InstancedMesh>(null);
  const stitchRef = useRef<THREE.LineSegments>(null);
  const ringsRef = useRef<THREE.InstancedMesh>(null);

  const beadGeometry = useMemo(() => new THREE.SphereGeometry(0.1, 10, 10), []);
  const beadMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#dff3ff"),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const ringGeometry = useMemo(() => new THREE.RingGeometry(0.985, 1, 72), []);
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#8ad8ff"),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  /** Die kurzen Stiche zu den gelesenen Notizen. */
  const stitchGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = MAX_STITCHES * STITCH_KINKS * 2;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
    geo.setAttribute("aFade", new THREE.BufferAttribute(new Float32Array(vertices), 1));
    return geo;
  }, []);

  useEffect(
    () => () => {
      beadGeometry.dispose();
      beadMaterial.dispose();
      stitchGeometry.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
    [beadGeometry, beadMaterial, stitchGeometry, ringGeometry, ringMaterial],
  );

  useEffect(() => {
    const onPulse = (event: Event) => {
      const ids: string[] = (event as CustomEvent).detail?.ids ?? [];
      const at: THREE.Vector3[] = [];
      for (const id of ids) {
        const position = positionsById.get(id);
        if (position) at.push(position.clone());
        if (at.length >= MAX_STITCHES) break;
      }
      if (at.length > 0) readRef.current = { at, born: performance.now() / 1000 };
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
  const anchor = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const ndcHead = useMemo(() => new THREE.Vector3(), []);
  const ndcAim = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);
  const previous = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  /**
   * Ein Hilfsvektor für Verschiebungen.
   *
   * Der Lint-Wächter verbietet  auf einem Wert, der aus einem Hook
   * kommt — Methodenaufrufe sind erlaubt, direkte Feldzuweisungen nicht. Das
   * ist kein Formalismus: eine Methode wie add() sagt, was passiert, eine
   * Zuweisung an .x versteckt es zwischen zwei Zeilen.
   */
  const shift = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (reducedMotion) return;
    const now = performance.now() / 1000;
    const scan = scanRef.current;
    const read = readRef.current;

    const beads = beadsRef.current;
    const stitches = stitchRef.current;
    const rings = ringsRef.current;
    if (!beads || !stitches || !rings) return;

    /**
     * Erst prüfen, dann anfassen.
     *
     * Im ersten Bild nach dem Einhängen trägt ein Mesh noch das
     * Standardmaterial — das Kind-Material ist dann noch nicht angeheftet.
     * Ein Zugriff auf  wirft dort, und ein Fehler in der
     * Bildschleife hält **die ganze Szene** an: der Wissenskosmos war
     * schwarz, und in der Konsole stand nichts. Ein Bild ohne Effekt ist
     * kein Problem; ein Bild ohne Szene ist eines.
     */
    const ringMat = rings.material as THREE.MeshBasicMaterial;
    const stitchAttrs = stitches.geometry.attributes as Record<string, THREE.BufferAttribute | undefined>;
    if (!ringMat || !stitchAttrs.aFade) return;

    const readAge = read.at.length > 0 ? now - read.born : Infinity;
    const readAlive = readAge < FLIGHT + AFTERGLOW;
    const showing = scan.active || readAlive;

    // ---- Der Ansatzpunkt: der sichtbare Jarvis-Kopf ----------------------
    if (from === "camera") {
      const head = activeJarvisHead();
      const px = head ? head.x : size.width - FALLBACK_INSET_X;
      const py = head ? head.y : size.height - FALLBACK_INSET_Y;
      ndcHead.set((px / size.width) * 2 - 1, -((py / size.height) * 2 - 1), 0.5);
      anchor.copy(ndcHead).unproject(camera);
      forward.copy(anchor).sub(camera.position).normalize();
      anchor.copy(camera.position).addScaledVector(forward, ANCHOR_DISTANCE);
    } else {
      anchor.copy(from);
    }
    ndcHead.copy(anchor).project(camera);

    // ---- Radiowellen, zuhause -------------------------------------------
    if (look === "waves" && showing) {
      rings.visible = true;
      for (let i = 0; i < RINGS; i++) {
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
      // Über das eingehängte Objekt, nicht über den Memo-Wert: was Bild für
      // Bild verändert wird, gehört der Bildschleife.
      ringMat.opacity = 0.17;
    } else if (rings.visible) {
      ringMat.opacity *= 0.9;
      if (ringMat.opacity < 0.01) rings.visible = false;
    }

    if (!showing) {
      if (beads.visible) {
        beads.visible = false;
        stitches.visible = false;
      }
      reportBrainLink({ strength: 0, onScreen: false });
      return;
    }
    beads.visible = true;
    stitches.visible = look === "beam" && readAlive;

    /**
     * Wohin der Strahl zeigt.
     *
     * Beim Suchen in die Mitte der Wolke — er greift ins Gehirn, noch ohne zu
     * wissen wohin. Sobald die Treffer feststehen, auf deren **Schwerpunkt**:
     * ein Strahl, der zur Sache zeigt, statt acht, die sie zerlegen.
     */
    target.set(0, 0, 0);
    if (readAlive) {
      for (const at of read.at) target.add(at);
      target.divideScalar(read.at.length);
    }
    ndcAim.copy(target).project(camera);

    // ---- Das Ziel an die Anzeige melden -------------------------------
    /**
     * Der Strahl selbst wird im DOM gezeichnet (BrainLinkBeam).
     *
     * Hier wird nur gesagt, **wohin** er zeigt: die Bildschirmkoordinate des
     * Ziels. In 3D gebaut hat derselbe Strahl die ganze Szene schwarz gemacht
     * — ein Band von vier Einheiten vor der Kamera bis in die Tiefe der Wolke
     * spannt einen Tiefenbereich auf, an dem der Nachbearbeitungspass
     * zerbricht. Auf dem Bildschirm verbindet er zwei Dinge auf dem
     * Bildschirm; dort gehört er hin.
     */
    reportBrainLink({
      x: ((ndcAim.x + 1) / 2) * size.width,
      y: ((1 - ndcAim.y) / 2) * size.height,
      onScreen: ndcAim.z > -1 && ndcAim.z < 1,
      strength: readAlive ? (readAge <= FLIGHT ? 1 : Math.max(0, 1 - (readAge - FLIGHT) / AFTERGLOW)) : 0.5,
    });

    // ---- Die Stiche zu den gelesenen Notizen ----------------------------
    const stitchAttr = stitchAttrs as Record<string, THREE.BufferAttribute>;
    const stitchPositions = stitchAttr.position.array as Float32Array;
    const stitchFades = stitchAttr.aFade.array as Float32Array;
    let seg = 0;
    if (readAlive) {
      const after = readAge <= FLIGHT ? 1 : Math.max(0, 1 - (readAge - FLIGHT) / AFTERGLOW);
      const snap = Math.floor(now * 20);
      for (let index = 0; index < read.at.length; index++) {
        const at = read.at[index];
        // Vom Strahlende zur Notiz — kurz, weil beide in der Wolke liegen.
        previous.copy(target);
        for (let k = 1; k <= STITCH_KINKS; k++) {
          if (seg >= MAX_STITCHES * STITCH_KINKS) break;
          const u = k / STITCH_KINKS;
          world.lerpVectors(target, at, u);
          if (k < STITCH_KINKS) {
            const envelope = Math.sin(u * Math.PI);
            world.add(
              shift.set(
                Math.sin(snap * 1.7 + k * 5.9 + index * 11.1) * 0.28 * envelope,
                Math.sin(snap * 2.3 + k * 4.7 + index * 7.7) * 0.28 * envelope,
                0,
              ),
            );
          }
          const o = seg * 6;
          stitchPositions[o] = previous.x;
          stitchPositions[o + 1] = previous.y;
          stitchPositions[o + 2] = previous.z;
          stitchPositions[o + 3] = world.x;
          stitchPositions[o + 4] = world.y;
          stitchPositions[o + 5] = world.z;
          const flicker = 0.5 + 0.5 * Math.abs(Math.sin(now * 15 + index * 2.1));
          stitchFades[seg * 2] = after * flicker;
          stitchFades[seg * 2 + 1] = after * flicker;
          seg++;
          previous.copy(world);
        }
      }
    }
    for (let i = seg; i < MAX_STITCHES * STITCH_KINKS; i++) {
      stitchPositions.fill(0, i * 6, i * 6 + 6);
      stitchFades[i * 2] = 0;
      stitchFades[i * 2 + 1] = 0;
    }
    stitchAttr.position.needsUpdate = true;
    stitchAttr.aFade.needsUpdate = true;

    // ---- Der Rückfluss und die Streiflichter ----------------------------
    let written = 0;

    /**
     * Das zurücklaufende Licht wandert mit dem Strahl in die Anzeige.
     *
     * Es lief vorher als kleine Kugeln entlang derselben Bahn durch die
     * Szene — und teilte deren Problem: der Weg endet vier Einheiten vor der
     * Kamera, und was dort liegt, ist entweder unsichtbar klein oder füllt
     * den halben Schirm. Auf dem Bildschirm gezeichnet stimmt beides von
     * selbst.
     */

    // Die Suchkeule: was sie streift, blitzt auf.
    if (scan.active) {
      const sweep = (now - scan.since) * 1.25;
      const cos = Math.cos(sweep);
      const sin = Math.sin(sweep);
      let flashes = 0;
      for (const at of positionsById.values()) {
        if (flashes >= SCAN_FLASHES || written >= BEAD_SLOTS) break;
        const len = Math.hypot(at.x, at.z);
        if (len < 0.001) continue;
        if ((at.x * cos + at.z * sin) / len < 0.985) continue;
        dummy.position.copy(at);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.85);
        dummy.updateMatrix();
        beads.setMatrixAt(written++, dummy.matrix);
        flashes++;
      }
    }

    dummy.scale.setScalar(0);
    dummy.position.set(0, -9999, 0);
    dummy.updateMatrix();
    for (let i = written; i < BEAD_SLOTS; i++) beads.setMatrixAt(i, dummy.matrix);
    beads.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <lineSegments ref={stitchRef} geometry={stitchGeometry} frustumCulled={false} visible={false}>
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
              gl_FragColor = vec4(0.78, 0.94, 1.0, clamp(vFade, 0.0, 1.0) * 0.9);
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
        args={[beadGeometry, beadMaterial, BEAD_SLOTS]}
        frustumCulled={false}
        visible={false}
      />
    </group>
  );
}
