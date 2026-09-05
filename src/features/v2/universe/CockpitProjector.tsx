"use client";

import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Place } from "@/features/v2/universe/places";

/**
 * Rechnet, wo die Orte auf dem Bildschirm liegen — und schreibt es direkt ins DOM.
 *
 * Das Cockpit ist eine Anzeige über der Szene, aber die Zahlen dafür kennt nur
 * die Kamera. Diese Komponente steht deshalb *in* der Canvas, projiziert jeden
 * Ort einmal pro Bild und schreibt Position und Entfernung **unmittelbar in
 * die HTML-Elemente**, die das Cockpit angelegt hat.
 *
 * Warum nicht über React-Zustand: sechzig Zustandsänderungen pro Sekunde sind
 * sechzig Renderdurchläufe pro Sekunde für eine Zahl, die sich zwar ändert,
 * aber nichts umbaut. Das war die teuerste Zeile, die ich heute Abend *nicht*
 * geschrieben habe.
 *
 * Und **genau eine** Bildschleife für das ganze Cockpit. Acht Tore mit acht
 * Schleifen haben heute die halbe Bildrate gekostet; dieselbe Lehre steht hier
 * von Anfang an im Code statt später im Bericht.
 */

const PROJECTED = new THREE.Vector3();
const TO_PLACE = new THREE.Vector3();
const FORWARD = new THREE.Vector3();

export type MarkerRegistry = Map<string, { root: HTMLElement; distance: HTMLElement }>;

export function CockpitProjector({
  places,
  markers,
}: {
  places: Place[];
  /** Vom Cockpit gefüllt: die Elemente, die hier bewegt werden. */
  markers: React.MutableRefObject<MarkerRegistry>;
}) {
  useFrame(({ camera, size }) => {
    if (markers.current.size === 0) return;

    camera.getWorldDirection(FORWARD);

    for (const place of places) {
      const marker = markers.current.get(place.id);
      if (!marker) continue;

      TO_PLACE.copy(place.position).sub(camera.position);
      const distance = TO_PLACE.length();

      PROJECTED.copy(place.position).project(camera);
      // `project` liefert hinter der Kamera gespiegelte Werte. Ohne diese
      // Prüfung zeigt der Pfeil für etwas im Rücken nach vorne — und ein
      // Kompass, der in die falsche Richtung zeigt, ist schlimmer als keiner.
      const behind = TO_PLACE.dot(FORWARD) < 0;

      let x = (PROJECTED.x * 0.5 + 0.5) * size.width;
      let y = (-PROJECTED.y * 0.5 + 0.5) * size.height;

      const margin = 46;
      const offScreen =
        behind || x < margin || x > size.width - margin || y < margin || y > size.height - margin;

      if (behind) {
        // Hinter der Kamera: an die gegenüberliegende Kante spiegeln, damit
        // die Richtung stimmt.
        x = size.width - x;
        y = size.height - y;
      }

      // Am Rand festhalten, statt aus dem Bild zu laufen. Ein Ziel, das man
      // nicht sieht, muss trotzdem sagen, wo es ist.
      x = Math.min(Math.max(x, margin), size.width - margin);
      y = Math.min(Math.max(y, margin), size.height - margin);

      marker.root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
      marker.root.dataset.off = offScreen ? "1" : "0";
      marker.distance.textContent = `${Math.round(distance)}`;
    }
  });

  return null;
}
