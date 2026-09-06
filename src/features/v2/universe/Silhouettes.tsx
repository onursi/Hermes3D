"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { AREA_COLORS, DISTANT_TINT, SELECTION_COLOR } from "@/features/v2/palette";
import { Portal, type PortalHandle } from "@/features/v2/universe/Portal";
import type { Place } from "@/features/v2/universe/places";

/**
 * Every place except the one you are in, drawn as cheaply as it can be.
 *
 * The plan's third rule made structural: one canvas, one coordinate system,
 * and only the place you entered gets real geometry. Everything else is a
 * silhouette — enough to recognise and steer toward, not enough to cost
 * anything. The library proxy is nine boxes; the library itself is 132 draws.
 *
 * "Keine austauschbaren Säulen" is the requirement that shaped this file.
 * Three columns with three labels would have been half a day's work and would
 * have told Onur nothing: he would read the label, never the shape. So the
 * shelves have shelves, the knowledge body is a body of points with lobes,
 * and a project station is a platform with a mast. From a hundred units out
 * you can tell them apart with the labels covered — which is the test.
 */

/**
 * Distance at which a label is drawn at its authored size.
 * Closer than this it is scaled down, further it is scaled up.
 */
const LABEL_REFERENCE = 70;

/**
 * Was für ein Tor es ist, sieht man an seiner Farbe.
 *
 * Die Farben stammen aus der Arealpalette und bedeuten dasselbe wie dort:
 * Wissen ist das eine Blau im System, Quellen sind Ocker, Projekte sind grün.
 * Ein Tor, das aussieht wie das nächste, wäre genau die austauschbare Säule,
 * die der Plan verbietet — nur mit besserem Shader.
 */
const PORTAL_RIM: Record<string, string> = {
  cosmos: AREA_COLORS["07🧠Wissen"],
  library: AREA_COLORS["08📚Quellen"],
  project: AREA_COLORS["05 🚀 Projekte"],
  home: DISTANT_TINT,
};

/** Die Tiefe dahinter. Dunkel, damit das Innere ein Innen bleibt. */
const PORTAL_CORE: Record<string, string> = {
  cosmos: "#232a45",
  library: "#332614",
  project: "#123026",
  home: "#1a1814",
};

/** Reused every frame by the label loop. Never read outside it. */
const SCRATCH = new THREE.Vector3();

export function Silhouettes({
  places,
  /** The place currently entered, if any. It is drawn for real, not here. */
  activeId,
  /** What the flight is currently offering to enter. */
  reachableId,
  reducedMotion = false,
  showLabels = true,
  onFocus,
}: {
  places: Place[];
  activeId: string | null;
  reachableId: string | null;
  reducedMotion?: boolean;
  /**
   * Namen im Raum zeichnen.
   *
   * Unterwegs uebernimmt das Cockpit die Beschriftung — es nennt jeden Ort
   * samt Entfernung und haelt ihn am Bildrand fest, wenn er hinausläuft. Beides
   * gleichzeitig waere derselbe Name zweimal, einmal davon ohne Entfernung.
   */
  showLabels?: boolean;
  onFocus?: (place: Place) => void;
}) {
  const labels = useRef(new Map<string, THREE.Object3D>());
  /**
   * Alle Tore in einer Schleife statt jedes in seiner eigenen.
   *
   * Acht Tore mit acht Bildschleifen haben die Bildrate halbiert — gemessen,
   * 56 gegen 32, bei identischer Szene. Hier liegen sie zusammen: Ausrichtung
   * zur Kamera, Zeit, Farben und das Aufhellen bei Naehe, alles in einem
   * Durchgang.
   */
  const portals = useRef(new Map<string, { handle: PortalHandle; rim: THREE.Color; core: THREE.Color; open: boolean; still: boolean }>());

  /**
   * One frame callback for every label in the universe, not one each.
   *
   * A name written in world space grows as you approach it, and at fourteen
   * units "Zuhause" was four hundred pixels tall across the middle of the
   * screen. Scaling with distance keeps a label roughly the same size however
   * far away its place is — which is what a label is for.
   *
   * Nine objects read and written once per frame, in a single callback that
   * lives and dies with this component. Nine separate ones would have been
   * the same work spread across nine hooks nobody can find later.
   */
  /**
   * An- und Abmelden eines Tores, plus die Werte, die die Schleife braucht.
   *
   * Farben und Nähe stehen hier und nicht im Tor: die Silhouette weiß beides
   * ohnehin, und ein Tor, das seine eigene Farbe pro Bild neu aus einer
   * Zeichenkette baut, tut Arbeit, die niemand sehen kann.
   */
  const registerPortal = useCallback(
    (id: string, handle: PortalHandle | null) => {
      if (!handle) portals.current.delete(id);
      else
        portals.current.set(id, {
          handle,
          rim: new THREE.Color(),
          core: new THREE.Color(),
          open: false,
          still: false,
        });
    },
    [],
  );

  /**
   * Was die Schleife wissen muss, in einem Ref statt im Rendern geschrieben.
   *
   * Der erste Versuch hat die Einträge direkt beim Rendern verändert. Das ist
   * ein Schreiben in ein Ref während des Renderns — die Lint-Regel dagegen ist
   * berechtigt: React darf rendern, ohne zu committen, und dann stünden Werte
   * in der Schleife, die nie auf dem Bildschirm waren.
   */
  const current = useRef({ places, reachableId, reducedMotion });
  useEffect(() => {
    current.current = { places, reachableId, reducedMotion };
  }, [places, reachableId, reducedMotion]);

  useFrame((state, delta) => {
    const camera = state.camera;

    const { places: livePlaces, reachableId: liveReachable, reducedMotion: still } = current.current;

    for (const place of livePlaces) {
      const entry = portals.current.get(place.id);
      if (!entry) continue;
      const highlighted = place.id === liveReachable;
      entry.rim.set(highlighted ? SELECTION_COLOR : (PORTAL_RIM[place.kind] ?? DISTANT_TINT));
      entry.core.set(PORTAL_CORE[place.kind] ?? "#101010");
      entry.open = highlighted;
      entry.still = still;
    }

    for (const entry of portals.current.values()) {
      const { handle } = entry;
      // Stable entrance orientation: the curved throat can be seen obliquely.
      if (handle.group) handle.group.lookAt(0, 4, 0);
      const material = handle.material;
      if (!material) continue;
      // Reduzierte Bewegung behaelt die Form und laesst die Bewegung weg.
      if (!entry.still) material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uRim.value.copy(entry.rim);
      material.uniforms.uCore.value.copy(entry.core);
      // Eingeschwungen statt geschaltet: ein Rand, der bei Annaeherung
      // springt, sieht aus wie ein Darstellungsfehler; einer, der aufblendet,
      // sieht aus, als haette das Tor einen bemerkt.
      const target = entry.open ? 1 : 0;
      handle.open += (target - handle.open) * Math.min(1, delta * 4);
      material.uniforms.uOpen.value = handle.open;

      // Detailstufe nach Entfernung. Die Grenze ist grosszuegig: naeher als
      // vierzig Einheiten ist ein Tor gross genug, dass man den Wirbel sieht;
      // weiter weg ist es ein Ring, und der volle Shader waere Rechenzeit fuer
      // etwas, das niemand aufloesen kann.
      if (handle.group) {
        handle.group.getWorldPosition(SCRATCH);
        material.uniforms.uDetail.value = camera.position.distanceTo(SCRATCH) < 40 ? 1 : 0;
      }
    }

    for (const object of labels.current.values()) {
      // One scratch vector, reused. Allocating nine per frame would be nine
      // times sixty allocations a second for a number we throw away.
      object.getWorldPosition(SCRATCH);
      const distance = camera.position.distanceTo(SCRATCH);
      object.scale.setScalar(THREE.MathUtils.clamp(distance / LABEL_REFERENCE, 0.22, 2));
    }
  });

  return (
    <group>
      {places.map((place) =>
        place.id === activeId ? null : (
          <Silhouette
            key={place.id}
            place={place}
            highlighted={place.id === reachableId}
            onFocus={onFocus}
            showLabel={showLabels}
            registerPortal={registerPortal}
            labelRef={(object) => {
              if (object) labels.current.set(place.id, object);
              else labels.current.delete(place.id);
            }}
          />
        ),
      )}
    </group>
  );
}

function Silhouette({
  place,
  highlighted,
  onFocus,
  labelRef,
  showLabel,
  registerPortal,
}: {
  place: Place;
  highlighted: boolean;
  onFocus?: (place: Place) => void;
  /** Hands the label group to the one loop that scales them all. */
  labelRef: (object: THREE.Object3D | null) => void;
  showLabel: boolean;
  /** Meldet das Tor bei derselben Schleife an. */
  registerPortal: (id: string, handle: PortalHandle | null) => void;
}) {
  // Warmgrau, nicht blau: so ist Cyan hier ein Zustand und keine Grundfarbe.
  const tint = highlighted ? SELECTION_COLOR : DISTANT_TINT;
  const peek = highlighted ? SELECTION_COLOR : "#6f6a63";

  return (
    <group
      position={place.position}
      onClick={
        onFocus
          ? (event) => {
              event.stopPropagation();
              onFocus(place);
            }
          : undefined
      }
    >
      {/* Home is not a door. It is the place he stands, seen from outside —
          and the one thing out here that should look like itself rather than
          like a way in. */}
      {place.kind === "home" ? <Deck radius={place.radius} tint={tint} /> : null}

      {place.kind !== "home" ? (
        <Portal
          radius={place.radius}
          seed={place.id.length * 7.3}
          onHandle={(handle) => registerPortal(place.id, handle)}
        >
          {/* What shows through. Same shapes as before, at a fraction of the
              size — the door tells you which room is behind it, which is the
              one thing a row of identical rings could never do. */}
          {/* Gedämpft, nicht in der Randfarbe: der Durchblick soll im Schatten
              des Tores liegen. Hell gezeichnet füllt er die Mitte und macht aus
              dem Tor wieder eine Kugel. */}
          <group position={[0, 0, -place.radius * 0.35]}>
            {place.kind === "cosmos" ? (
              <KnowledgeBody radius={place.radius * 0.62} tint={peek} />
            ) : null}
            {place.kind === "library" ? (
              <ShelfRoom radius={place.radius * 0.58} tint={peek} />
            ) : null}
            {place.kind === "project" ? (
              <Station radius={place.radius * 0.85} tint={peek} />
            ) : null}
          </group>
        </Portal>
      ) : null}

      {/* The names get their own suspense boundary, and this is not a detail.
          drei's Text suspends until its font is parsed, and a suspended child
          blanks its whole boundary — so nine labels sharing the scene's one
          boundary held the entire stage black for thirteen seconds on a cold
          load. A place is worth looking at before it is worth reading. */}
      {showLabel ? (
      <Suspense fallback={null}>
      <Billboard ref={labelRef} position={[0, place.radius * 1.5 + 1.2, 0]}>
        <Text
          fontSize={Math.max(0.9, place.radius * 0.18)}
          color={highlighted ? SELECTION_COLOR : "#cfc9be"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.035}
          outlineColor="#04070c"
          // Always on, and that is defensible here: there are three places
          // plus one per project, not 277 notes. The rule the plan sets is
          // against a wall of names, not against naming anything.
          maxWidth={26}
        >
          {place.name}
        </Text>
      </Billboard>
      </Suspense>
      ) : null}
    </group>
  );
}

/**
 * The knowledge body: a cloud with lobes, not a ball.
 *
 * One draw call for the whole thing. The lobes come from displacing a
 * deterministic sphere distribution along three fixed axes — deterministic
 * because a body that reshuffles itself on every mount is a different body,
 * and Onur is supposed to learn what his own universe looks like.
 */
/**
 * Achtung, teuer gewesen: diese Wolke hat die Bildrate von 60 auf 37 gedrueckt.
 *
 * Nicht wegen der Rechenzeit — 900 Punkte sind nichts — sondern wegen der
 * Fuellrate. Additive Punkte mit sizeAttenuation werden gross, wenn man ihnen
 * nahe kommt, und seit die Orte naeher stehen, deckte diese eine Wolke halbe
 * Bildschirmbereiche mehrfach ab. Gemessen, nicht vermutet: dieselbe Szene
 * ohne sie lag wieder bei 56 fps.
 *
 * Deshalb 260 statt 900 Punkte und ein Drittel der Punktgroesse. Es ist ein
 * Durchblick durch ein Tor, kein Modell — mehr Punkte haette hier niemand
 * gezaehlt, die Bildrate aber jeder gespuert.
 */
function KnowledgeBody({ radius, tint }: { radius: number; tint: string }) {
  const geometry = useMemo(() => {
    const count = 260;
    const positions = new Float32Array(count * 3);
    // A fixed lattice angle rather than Math.random: same shape every time,
    // and no seeded-RNG dependency for something this small.
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const x = Math.cos(theta) * ring;
      const z = Math.sin(theta) * ring;
      // Three lobes, so the outline has a shape you can remember.
      const lobe = 0.72 + 0.28 * Math.abs(Math.sin(theta * 1.5)) + 0.18 * Math.abs(y);
      const shell = radius * lobe * (0.55 + 0.45 * ((i * 37) % 100) / 100);
      positions[i * 3] = x * shell;
      positions[i * 3 + 1] = y * shell;
      positions[i * 3 + 2] = z * shell;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [radius]);

  // Freigeben, wenn die Silhouette verschwindet. Ohne das bleibt bei jedem
  // Weltwechsel eine Punktwolke im Grafikspeicher liegen — gemessen: 54 auf
  // 73 Geometrien nach vier Wechseln, und die Bildrate halbiert sich, weil
  // eine Vega 11 sich den Speicher mit dem System teilt. Horizon und
  // WarpStreaks machen das seit dem ersten Tag; hier hatte ich es vergessen.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <points geometry={geometry}>
        <pointsMaterial
          color={tint}
          // Feste Pixelgroesse statt Groesse nach Entfernung. Genau die
          // Entfernungsskalierung war das Problem: naeher = groesser = mehr
          // Fuellrate, und die Orte sind seit dem Portal naeher. Zwei Pixel
          // bleiben zwei Pixel, egal wie dicht er herangeht.
          size={2}
          sizeAttenuation={false}
          transparent
          opacity={0.72}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* A faint hull, so the body reads as one object rather than a haze. */}
      <mesh>
        <icosahedronGeometry args={[radius * 0.98, 1]} />
        <meshBasicMaterial color={tint} wireframe transparent opacity={0.09} />
      </mesh>
    </group>
  );
}

/**
 * The shelf room: a block with shelves in it.
 *
 * Read from outside it is a lit rectangle with horizontal bands — which is
 * what a library looks like from across a street at night, and the reason the
 * shape works at all.
 */
function ShelfRoom({ radius, tint }: { radius: number; tint: string }) {
  const width = radius * 1.6;
  const height = radius * 1.1;
  const depth = radius * 1.15;

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color="#141c26"
          roughness={0.85}
          metalness={0.1}
          emissive={tint}
          emissiveIntensity={0.06}
        />
      </mesh>
      {/* Three shelf bands on each long side. Thin boxes, cheap, and the one
          detail that makes the block unmistakable. */}
      {[-0.28, 0, 0.28].map((offset) => (
        <mesh key={offset} position={[0, height * offset, depth / 2 + 0.02]}>
          <boxGeometry args={[width * 0.86, height * 0.07, 0.05]} />
          <meshBasicMaterial color={tint} transparent opacity={0.75} />
        </mesh>
      ))}
      {/* The lit doorway. Gives the block a front, so approaching it has a
          right way round. */}
      <mesh position={[0, -height * 0.22, depth / 2 + 0.03]}>
        <planeGeometry args={[width * 0.16, height * 0.5]} />
        <meshBasicMaterial color={tint} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/** A project station: a platform, a mast, a light. */
function Station({ radius, tint }: { radius: number; tint: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.55, radius, 28]} />
        <meshBasicMaterial color={tint} transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, radius * 0.02, 0]}>
        <cylinderGeometry args={[radius * 0.42, radius * 0.5, radius * 0.16, 6]} />
        <meshStandardMaterial color="#1a2430" roughness={0.8} metalness={0.15} />
      </mesh>
      <mesh position={[0, radius * 0.6, 0]}>
        <cylinderGeometry args={[radius * 0.05, radius * 0.07, radius * 1.1, 6]} />
        <meshStandardMaterial color="#2a3644" roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0, radius * 1.2, 0]}>
        <sphereGeometry args={[radius * 0.13, 10, 8]} />
        <meshBasicMaterial color={tint} />
      </mesh>
    </group>
  );
}

/** Home, seen from away: the platform's disc and its ring of light. */
function Deck({ radius, tint }: { radius: number; tint: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 40]} />
        <meshStandardMaterial color="#161d27" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[radius * 0.92, radius, 48]} />
        <meshBasicMaterial color={tint} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, radius * 0.28, 0]}>
        <icosahedronGeometry args={[radius * 0.12, 1]} />
        <meshBasicMaterial color={tint} />
      </mesh>
    </group>
  );
}

