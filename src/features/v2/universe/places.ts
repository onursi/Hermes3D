import * as THREE from "three";

import type { V2World } from "@/features/v2/state";
import type { Project } from "@/features/v2/useProjects";

/**
 * The map of the universe. One coordinate system, and this file owns it.
 *
 * The build plan asks for something the four worlds could not give: places
 * that are *somewhere* rather than behind a tab. A tab has no distance, so
 * flying between tabs is theatre. Real coordinates make the flight mean
 * something — the library is over there, and it is over there whether you are
 * standing at home, halfway across, or inside it.
 *
 * That is why the numbers live here and not in the components. A silhouette
 * seen from home and the place entered from the dock have to be the same
 * place; two copies of a position are two places that drift apart on the first
 * edit. Everything that needs to know where something is reads it from here.
 *
 * The bearings are chosen, not random: all three lie ahead of the composed
 * home view, at different headings and different heights, so the first look
 * out from the platform shows three distinct things rather than one cluster.
 */

export type PlaceKind = "home" | "cosmos" | "library" | "project";

export type Place = {
  /** Stable and unique. Project places carry the folder, so they survive a reload. */
  id: string;
  kind: PlaceKind;
  /** What the HUD calls it. */
  name: string;
  /** One line, shown when Onur is close enough to enter. */
  hint: string;
  position: THREE.Vector3;
  /**
   * How big the thing is, for the proxy and for the framing on approach.
   * Not a hitbox — see `entryRadius`.
   */
  radius: number;
  /**
   * Inside this distance, entering is offered. Explicitly *offered*: the plan
   * forbids arriving somewhere you did not choose to go, so proximity opens a
   * door and never walks through it.
   */
  entryRadius: number;
  /** Which world entering it mounts. */
  world: V2World;
  /** For a project station: which project to select on entry. */
  projectFolder?: string;
};

/** The stage. The origin of everything, because that is where he starts. */
export const HOME_POSITION = new THREE.Vector3(0, 0, 0);

/** Where the project stations cluster. The yard, seen from very far away. */
const PROJECT_FIELD = new THREE.Vector3(2, -10, -74);
const PROJECT_RING = 23;

const HOME_PLACE: Place = {
  id: "home",
  kind: "home",
  name: "Zuhause",
  hint: "Das Kommandodeck.",
  position: HOME_POSITION.clone(),
  radius: 6,
  entryRadius: 16,
  world: "home",
};

const COSMOS_PLACE: Place = {
  id: "cosmos",
  kind: "cosmos",
  name: "Das Synapsentor",
  hint: "Alle Notizen, räumlich gegliedert.",
  position: new THREE.Vector3(-24, -8, -54),
  // Ein Portal, kein Körper. Onurs Einwand war richtig: der Wissenskörper
  // nahm zwanzig Einheiten Platz ein, um zu sagen "hier geht es hinein".
  // Ein Tor von sieben tut dasselbe und lässt den Raum, den ein Raum braucht.
  radius: 9,
  entryRadius: 20,
  world: "cosmos",
};

const LIBRARY_PLACE: Place = {
  id: "library",
  kind: "library",
  name: "Bibliothek",
  hint: "Der Regalraum.",
  position: new THREE.Vector3(26, -4, -47),
  radius: 7,
  entryRadius: 18,
  world: "library",
};

/**
 * The places, given the projects that actually exist.
 *
 * Stations are derived rather than listed: six projects make six stations, and
 * a seventh project makes a seventh. Sorted by folder, so a station keeps its
 * position between sessions — a place that moves when the data reloads is not
 * a place, and the whole point of coordinates is that they hold still.
 */
export function placesFor(projects: Project[], includeLibrary: boolean): Place[] {
  const stations = [...projects]
    .sort((a, b) => a.folder.localeCompare(b.folder, "de"))
    .map((project, index, all) => {
      const angle = (index / Math.max(1, all.length)) * Math.PI * 2;
      return {
        id: `project:${project.folder}`,
        kind: "project" as const,
        name: project.name,
        hint: `${project.noteCount} Notizen. Führt zur Ergebniswerft.`,
        position: PROJECT_FIELD.clone().add(
          new THREE.Vector3(
            Math.cos(angle) * PROJECT_RING,
            // A gentle tilt across the ring, so the stations do not read as a
            // flat dial seen edge-on from the platform.
            Math.sin(angle * 2) * 5,
            Math.sin(angle) * PROJECT_RING,
          ),
        ),
        radius: 4.2,
        entryRadius: 12,
        world: "projects" as const,
        projectFolder: project.folder,
      };
    });

  return [
    HOME_PLACE,
    COSMOS_PLACE,
    ...(includeLibrary ? [LIBRARY_PLACE] : []),
    ...stations,
  ];
}

/**
 * The nearest place worth offering, or null.
 *
 * Nearest rather than first: two stations can overlap their entry radii, and
 * offering whichever happened to be earlier in the array would make the prompt
 * flicker between them as he drifts.
 */
export function placeInReach(places: Place[], position: THREE.Vector3): Place | null {
  let best: Place | null = null;
  let bestDistance = Infinity;
  for (const place of places) {
    const distance = position.distanceTo(place.position);
    if (distance > place.entryRadius) continue;
    if (distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Where to stand to look at a place from outside, on the way in from home.
 *
 * Used by the "hinfliegen" action in the HUD: it puts the camera in front of
 * the place rather than inside it, which is the difference between arriving
 * and being swallowed.
 */
export function approachFor(place: Place): { position: THREE.Vector3; target: THREE.Vector3 } {
  const away = place.position.clone().sub(HOME_POSITION);
  if (away.lengthSq() < 1) away.set(0, 0, 1);
  away.normalize();

  // Inside the entry radius, outside the thing itself — and both halves are
  // load-bearing. The first version stood off at 2.1 radii, which for the
  // knowledge body was 42 units against an entry radius of 38: he would fly
  // all the way there, watch it fill the screen, and be told nothing was in
  // reach. Deriving the distance from the radius that actually governs the
  // offer keeps the two from drifting apart again.
  const distance = Math.min(
    place.entryRadius * 0.9,
    Math.max(place.entryRadius * 0.8, place.radius * 1.6),
  );

  return {
    position: place.position
      .clone()
      .sub(away.multiplyScalar(distance))
      .add(new THREE.Vector3(0, place.radius * 0.35, 0)),
    target: place.position.clone(),
  };
}
