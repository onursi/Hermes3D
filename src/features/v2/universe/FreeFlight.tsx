"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
import { placeInReach, type Place } from "@/features/v2/universe/places";

/**
 * Flying, by hand.
 *
 * OrbitControls is the wrong tool out here and it is worth saying why: it
 * orbits a *point*. That is exactly right for looking at a stage and exactly
 * wrong for going somewhere, because the thing you are looking at is always in
 * the middle and you can never leave it behind. Free flight needs a position
 * and a heading, so this owns both.
 *
 * Not a physics model. The plan says "kein Physikspiel" and means it: no
 * inertia to fight, no drift, no overshoot. Let go and you stop. The only
 * smoothing is on the velocity ramp, so a keypress is not a jolt.
 *
 * One `useFrame` and one set of window listeners for the whole thing. No
 * hidden second loop — the rule that cost V1 its frame rate applies here more
 * than anywhere, because this component is alive while nothing else is.
 */

/** Units per second at flight speed 1. Chosen against the map in places.ts. */
const BASE_SPEED = 26;
/** Shift. Onur's "Lichtgeschwindigkeit", bounded. */
const BOOST = 3.2;
/** How far out he can get. Past this there is nothing to see and no way to aim. */
const BOUNDARY = 2400;
/** Radians per pixel of drag. */
const LOOK_RATE = 0.0032;

export function FreeFlight({
  places,
  speed,
  boundary = BOUNDARY,
  baseSpeed = BASE_SPEED,
  onReachChange,
  onSample,
}: {
  places: Place[];
  /** The flight-speed preference. Scales the whole thing, boost included. */
  speed: number;
  /**
   * Wie weit er kommt. Im All 2400 Einheiten, im Wissenskoerper viel weniger:
   * dort ist alles innerhalb von zwanzig, und wer hundert Einheiten weit
   * hinausfliegt, sieht einen Punkt und findet nicht zurueck.
   */
  boundary?: number;
  /** Grundtempo. Im Koerper langsamer, weil alles naeher steht. */
  baseSpeed?: number;
  /** Fires only when the offer changes, never per frame. */
  onReachChange: (place: Place | null) => void;
  /** Reports position and heading, so entering a place can come back to it. */
  onSample: (position: THREE.Vector3, target: THREE.Vector3) => void;
}) {
  const { prefs } = useV2();
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef(new THREE.Vector3());
  /**
   * `undefined` means "nothing reported yet", and that is not pedantry.
   *
   * This component is remounted every time a directed flight ends, and a fresh
   * `null` would compare equal to "nothing in reach" — so the first frame after
   * a remount would stay silent and leave the previous offer standing. That is
   * exactly what happened: fly out to the universe from the deck, and the HUD
   * kept offering "Zuhause betreten" from thirty-five units away.
   */
  const reachedId = useRef<string | null | undefined>(undefined);
  const streaks = useRef<THREE.Group>(null);
  const streakMaterial = useRef<THREE.LineBasicMaterial>(null);
  /** Zuletzt gesetzter Blickwinkel. Nur bei Aenderung neu rechnen. */
  const lastFov = useRef(0);
  const lastOrientation = useRef<THREE.Quaternion | null>(null);

  /**
   * Die Streifen: kurze Striche in einer Roehre um den Betrachter.
   *
   * Deterministisch angelegt und danach nie wieder angefasst — gestreckt wird
   * ueber die Skalierung der Gruppe, aufgehellt ueber die Deckkraft. Das ist
   * der ganze Geistmodus: kein Partikelsystem, kein zweiter Renderdurchgang,
   * ein einziger Zeichenaufruf, der bei Stillstand unsichtbar ist.
   */
  const streakGeometry = useMemo(() => {
    const count = 220;
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i += 1) {
      const angle = (i * 2.399963) % (Math.PI * 2);
      // Ein Loch in der Mitte: Striche direkt vor der Nase lesen sich als
      // Dreck auf der Scheibe, nicht als Fahrt.
      const radius = 2.6 + ((i * 37) % 100) / 100 * 11;
      const z = -34 + ((i * 53) % 100) / 100 * 44;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z - 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => () => streakGeometry.dispose(), [streakGeometry]);

  /**
   * Take the camera's current orientation as the starting heading.
   *
   * Without this, entering free flight snaps the view to whatever yaw and
   * pitch happened to be zero — which is the "Kamerazwang" the plan removes
   * from the dock, reintroduced one component later.
   */
  useEffect(() => {
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = euler.y;
    pitch.current = euler.x;
  }, [camera]);

  useEffect(() => {
    // Captured once, so the cleanup clears the same Set the listeners filled.
    // The lint rule is right in general — a ref can point at a different node
    // by cleanup time — and following it costs one line here.
    const held = keys.current;
    const down = (event: KeyboardEvent) => {
      // Typing in the search field must not fly the ship.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      held.add(event.key.toLowerCase());
    };
    const up = (event: KeyboardEvent) => held.delete(event.key.toLowerCase());
    // A window that loses focus mid-press would otherwise keep the key held
    // down forever, and the ship flies away while he reads his mail.
    const clear = () => held.clear();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      held.clear();
    };
  }, []);

  useEffect(() => {
    const element = gl.domElement;

    const onPointerDown = (event: PointerEvent) => {
      // Left button only. Right-drag is the browser's, and a middle-drag is a
      // scroll on most mice.
      if (event.button !== 0) return;
      dragging.current = true;
      lastPointer.current = { x: event.clientX, y: event.clientY };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      const dx = event.clientX - lastPointer.current.x;
      const dy = event.clientY - lastPointer.current.y;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      yaw.current -= dx * LOOK_RATE;
      // Stop just short of straight up and straight down: at the poles the
      // yaw axis and the view axis line up and the horizon spins.
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - dy * LOOK_RATE,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05,
      );
    };
    const onPointerUp = () => {
      dragging.current = false;
    };

    element.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("blur", onPointerUp);
    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
    };
  }, [gl]);

  useFrame((state, rawDelta) => {
    // A tab that was in the background hands back a delta of several seconds.
    // Unclamped, that is a single frame that teleports him across the map.
    const delta = Math.min(rawDelta, 0.1);

    // Adopt a director preset even when React batches the instant journey.
    if (!lastOrientation.current || camera.quaternion.angleTo(lastOrientation.current) > 0.0001) {
      const heading = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
      pitch.current = heading.x;
      yaw.current = heading.y;
      velocity.current.set(0, 0, 0);
    }
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, "YXZ"));
    if (!lastOrientation.current) lastOrientation.current = camera.quaternion.clone();
    else lastOrientation.current.copy(camera.quaternion);

    const held = keys.current;
    const forward = (held.has("w") || held.has("arrowup") ? 1 : 0) - (held.has("s") || held.has("arrowdown") ? 1 : 0);
    const strafe = (held.has("d") || held.has("arrowright") ? 1 : 0) - (held.has("a") || held.has("arrowleft") ? 1 : 0);
    const lift = (held.has("e") || held.has(" ") ? 1 : 0) - (held.has("q") ? 1 : 0);

    const wanted = new THREE.Vector3();
    if (forward || strafe || lift) {
      const heading = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      wanted
        .addScaledVector(heading, forward)
        .addScaledVector(right, strafe)
        // Up is world-up, not camera-up: pressing "up" while pitched down
        // should still go up, or the controls argue with the horizon.
        .addScaledVector(new THREE.Vector3(0, 1, 0), lift)
        .normalize()
        .multiplyScalar(
          baseSpeed * THREE.MathUtils.clamp(speed, 0.5, 20) * (held.has("shift") ? BOOST : 1),
        );
    }

    // Ramp toward the wanted velocity rather than assigning it. Short enough
    // to feel immediate, long enough that starting and stopping is not a jerk.
    velocity.current.lerp(wanted, Math.min(1, delta * 9));
    camera.position.addScaledVector(velocity.current, delta);

    if (camera.position.length() > boundary) {
      camera.position.setLength(boundary);
      velocity.current.multiplyScalar(0.2);
    }

    // Where he is and where he is looking, for the return trip.
    const lookAt = camera.position
      .clone()
      .addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), 10);
    onSample(camera.position, lookAt);

    // The entry offer. Compared by id and reported only on change: this runs
    // sixty times a second, and a setState per frame would be a render loop
    // wearing a hat.
    /**
     * Der Geistmodus: schneller werden muss sich anfuehlen wie schneller werden.
     *
     * Alles haengt an der *tatsaechlichen* Geschwindigkeit, nicht am
     * Tastendruck. Deshalb baut es sich mit der Beschleunigung auf und faellt
     * beim Loslassen von selbst wieder ab — Anfahren und Abbremsen sind
     * derselbe Regler, rueckwaerts gelesen.
     */
    const rush = prefs.reducedMotion ? 0 : Math.min(1, velocity.current.length() / (baseSpeed * 2.6));

    if (streaks.current) {
      // Die Roehre sitzt am Betrachter und schaut, wohin er schaut.
      streaks.current.position.copy(camera.position);
      streaks.current.quaternion.copy(camera.quaternion);
      // Gestreckt statt neu gebaut: dieselbe Geometrie, laenger gezogen.
      streaks.current.scale.set(1, 1, 1 + rush * 5.5);
      streaks.current.visible = rush > 0.02;
    }
    if (streakMaterial.current) {
      streakMaterial.current.opacity = rush * rush * 0.55;
    }

    /**
     * Ein Hauch mehr Blickwinkel bei Tempo.
     *
     * Der aelteste Trick fuer Geschwindigkeit und immer noch der beste: das
     * Bild wird an den Raendern weiter, alles rueckt schneller vorbei. Nur bei
     * echter Aenderung neu gerechnet: updateProjectionMatrix pro Bild waere
     * Arbeit fuer eine Zahl, die meistens gleich bleibt.
     *
     * Die Kamera kommt hier aus dem Bildzustand und nicht aus dem Hook. Das
     * ist kein Umweg: die Lint-Regel verbietet, einen Hook-Rueckgabewert zu
     * veraendern, und sie hat recht — wer eine Kamera aus einem Hook heraus
     * umbaut, aendert etwas, das React fuer unveraenderlich haelt.
     */
    const wantedFov = 46 + rush * 9;
    if (Math.abs(wantedFov - lastFov.current) > 0.15) {
      lastFov.current = wantedFov;
      const perspective = state.camera as THREE.PerspectiveCamera;
      if (perspective.isPerspectiveCamera) {
        perspective.fov = wantedFov;
        perspective.updateProjectionMatrix();
      }
    }

    const reachable = placeInReach(places, camera.position);
    const id = reachable?.id ?? null;
    if (id !== reachedId.current) {
      reachedId.current = id;
      onReachChange(reachable);
    }
  });

  /**
   * Beim Verlassen den Blickwinkel zuruecksetzen.
   *
   * Sonst behaelt die Welt, in die er wechselt, die aufgerissene Perspektive
   * des letzten Sprints — und niemand kaeme darauf, dass das vom Fliegen kommt.
   */
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    return () => {
      if (perspective.isPerspectiveCamera && perspective.fov !== 46) {
        perspective.fov = 46;
        perspective.updateProjectionMatrix();
      }
    };
  }, [camera]);

  return (
    <group ref={streaks} visible={false}>
      <lineSegments geometry={streakGeometry}>
        <lineBasicMaterial
          ref={streakMaterial}
          color="#dfe6f2"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}
