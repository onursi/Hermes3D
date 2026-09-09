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

export type PlaceKind = "home" | "cosmos" | "library" | "project" | "room";

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
  color?:string;
  /** For a project station: which project to select on entry. */
  projectFolder?: string;
};

/** The stage. The origin of everything, because that is where he starts. */
export const HOME_POSITION = new THREE.Vector3(0, 0, 0);

/** Where the project stations cluster. The yard, seen from very far away. */



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


export function placesFor(projects: Project[], includeLibrary: boolean): Place[] {
  // Exactly one project entrance, independent of the project count.
  void includeLibrary;void projects;
  const destinations:{id:V2World;name:string;color:string;hint:string}[]=[
    {id:'cosmos',name:'Das Synapsentor',color:'#9dbdff',hint:'Notizen und echte Verbindungen.'},
    {id:'projects',name:'Project Singularity',color:'#f2bd72',hint:'Projektplaneten und nächste Schritte.'},
    {id:'horizon',name:'Goal Horizon',color:'#f8e3ac',hint:'Deine Richtung und Ziele.'},
    {id:'flow',name:'Flow Orbit',color:'#8bdfca',hint:'Automationen und gemeldete Läufe.'},
    {id:'atelier',name:'Ideenatelier',color:'#d6a7f3',hint:'Aus einem Gedanken wird ein nächster Schritt.'},
    {id:'sanctuary',name:'Vision Sanctuary',color:'#bad2a3',hint:'Raum für dein Warum.'},
    {id:'memory',name:'Memory Orbit',color:'#eda8be',hint:'Deine Lebensringe und Fotoalben.'},
    {id:'success',name:'Success Singularity',color:'#e9b778',hint:'Erreichtes wiederfinden.'},
  ];
  return [HOME_PLACE,...destinations.map((d,i)=>{const angle=-Math.PI*.7+i/destinations.length*Math.PI*2;return {id:d.id,kind:d.id==='cosmos'?'cosmos':d.id==='projects'?'project':'room',name:d.name,hint:d.hint,color:d.color,position:new THREE.Vector3(Math.cos(angle)*48,1,Math.sin(angle)*48),radius:6,entryRadius:12,world:d.id} as Place;})];
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
