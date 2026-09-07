"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import { isBeamActive, reportBeamTargets, reportSweepPoints, type BeamPoint, type BeamTarget } from "./beamAnchors";

export type BeamProbePoint = {
  id: string;
  label: string;
  position: THREE.Vector3;
};

/**
 * Die Messstelle: wo die zitierten Notizen gerade wirklich auf dem Bild liegen.
 *
 * Sie zeichnet nichts. Sie sitzt in der Szene, weil nur dort Kamera und
 * Bildgröße bekannt sind, und rechnet die Weltposition jeder Notiz, die Jarvis
 * gerade zitiert, in Bildschirmkoordinaten um. Der Strahl im DOM liest das
 * Ergebnis und weiß dadurch, wohin er zeigen muss.
 *
 * Warum diese Trennung: Ein Strahl, der Fläche hat, ist in WebGL teuer und
 * unter der Nachbearbeitung heikel — `lineWidth` wird schlicht ignoriert, und
 * ein Band über einen großen Tiefenbereich hat die Szene schon einmal komplett
 * schwarz werden lassen. Im DOM ist ein Strahl eine Linie mit Stärke, fertig.
 * Was 3D wirklich beisteuern muss, ist nur diese eine Zahl: **wo liegt das
 * Ding?**
 *
 * Nicht jedes Bild: Der Punkt wandert langsamer, als das Auge es merkt, und
 * jede Messung kostet eine Matrixmultiplikation pro Notiz.
 */
export function BeamProbe({
  points,
  sweepPoints = [],
}: {
  points: BeamProbePoint[];
  /** Weitere echte Notizen im Raum — die Tastflaeche fuer den Scandurchlauf. */
  sweepPoints?: BeamProbePoint[];
}) {
  const { camera, size } = useThree();

  /**
   * Ein Vektor für alle Umrechnungen.
   *
   * Pro Notiz und Bild einen neuen anzulegen wäre bei sechs Quellen und 60 fps
   * genau der Müll, den die Speicherbereinigung später als Ruckler zurückgibt.
   */
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, __, frame) => {
    void frame;
    /**
     * Gemessen wird, sobald der Strahl lebt — nicht erst, wenn Quellen da sind.
     *
     * Die Tastflaeche liegt sofort vor: Es sind die Notizen, die gerade im Bild
     * stehen. Der Scan kann also loslaufen, waehrend Jarvis noch sucht, und die
     * Strahlen rasten ein, sobald die Antwort ihre Quellen nennt.
     */
    if (!isBeamActive()) {
      reportBeamTargets([]);
      reportSweepPoints([]);
      return;
    }

    const out: BeamTarget[] = [];
    for (const point of points) {
      scratch.copy(point.position).project(camera);

      /**
       * Hinter der Kamera stimmt die Projektion nicht mehr — `z > 1` heißt,
       * der Punkt liegt jenseits der hinteren Ebene und das Vorzeichen kippt.
       * Solche Punkte werden gemeldet, aber als `onScreen: false`, damit der
       * Zeichner sie weglässt statt an den Bildrand zu klemmen.
       */
      const sichtbar =
        scratch.z < 1 &&
        scratch.x >= -1.05 &&
        scratch.x <= 1.05 &&
        scratch.y >= -1.05 &&
        scratch.y <= 1.05;

      out.push({
        id: point.id,
        label: point.label,
        x: (scratch.x * 0.5 + 0.5) * size.width,
        y: (-scratch.y * 0.5 + 0.5) * size.height,
        onScreen: sichtbar,
      });
    }

    reportBeamTargets(out);

    /**
     * Die Tastflaeche.
     *
     * Nur Punkte im Bild, und nur die Koordinate — Titel braucht der Scan
     * nicht, er streicht darueber, er zitiert sie nicht. Wer beschriftet wird,
     * ist eine Quelle der Antwort; alles andere bleibt namenlos, damit im Bild
     * nicht so aussieht, als haette Jarvis achtzig Notizen gelesen.
     */
    const gestreift: BeamPoint[] = [];
    for (const point of sweepPoints) {
      scratch.copy(point.position).project(camera);
      if (scratch.z >= 1) continue;
      if (scratch.x < -1 || scratch.x > 1 || scratch.y < -1 || scratch.y > 1) continue;
      gestreift.push({
        x: (scratch.x * 0.5 + 0.5) * size.width,
        y: (-scratch.y * 0.5 + 0.5) * size.height,
      });
    }
    reportSweepPoints(gestreift);
  });

  return null;
}
