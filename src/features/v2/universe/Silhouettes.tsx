"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

import { SELECTION_COLOR } from "@/features/v2/palette";
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

/** Reused every frame by the label loop. Never read outside it. */
const SCRATCH = new THREE.Vector3();

export function Silhouettes({
  places,
  /** The place currently entered, if any. It is drawn for real, not here. */
  activeId,
  /** What the flight is currently offering to enter. */
  reachableId,
  onFocus,
}: {
  places: Place[];
  activeId: string | null;
  reachableId: string | null;
  onFocus?: (place: Place) => void;
}) {
  const labels = useRef(new Map<string, THREE.Object3D>());

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
  useFrame(({ camera }) => {
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
}: {
  place: Place;
  highlighted: boolean;
  onFocus?: (place: Place) => void;
  /** Hands the label group to the one loop that scales them all. */
  labelRef: (object: THREE.Object3D | null) => void;
}) {
  const tint = highlighted ? SELECTION_COLOR : "#7fb2d8";

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
      {place.kind === "cosmos" ? <KnowledgeBody radius={place.radius} tint={tint} /> : null}
      {place.kind === "library" ? <ShelfRoom radius={place.radius} tint={tint} /> : null}
      {place.kind === "project" ? <Station radius={place.radius} tint={tint} /> : null}
      {place.kind === "home" ? <Deck radius={place.radius} tint={tint} /> : null}

      {/* The names get their own suspense boundary, and this is not a detail.
          drei's Text suspends until its font is parsed, and a suspended child
          blanks its whole boundary — so nine labels sharing the scene's one
          boundary held the entire stage black for thirteen seconds on a cold
          load. A place is worth looking at before it is worth reading. */}
      <Suspense fallback={null}>
      <Billboard ref={labelRef} position={[0, place.radius * 1.5 + 1.2, 0]}>
        <Text
          fontSize={Math.max(0.9, place.radius * 0.18)}
          color={highlighted ? SELECTION_COLOR : "#a8c4dc"}
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
function KnowledgeBody({ radius, tint }: { radius: number; tint: string }) {
  const geometry = useMemo(() => {
    const count = 900;
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

  return (
    <group>
      <points geometry={geometry}>
        <pointsMaterial
          color={tint}
          size={0.9}
          sizeAttenuation
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

