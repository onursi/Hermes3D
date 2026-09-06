"use client";

/**
 * Wo Jarvis' Kopf gerade wirklich ist.
 *
 * Onur hat es im Vorbeigehen gesehen und sofort benannt: "Der Blitz muss von
 * Jarvis' Kopf herkommen — eben kam das einfach von rechts."
 *
 * Er hatte recht, und der Fehler war meiner. Ich hatte den Ansatzpunkt aus
 * **festen Zahlen** gerechnet: 52 Bildpunkte von rechts, 124 von unten, weil
 * die Kugel dort steht. Das stimmt genau so lange, wie die Kugel dort steht.
 * Sobald das Fenster offen ist, schaut ihn ein zweiter, größerer Kopf an — und
 * der Blitz kam trotzdem aus der Ecke. Zwei Köpfe, ein Strahl, und der Strahl
 * gehörte zu keinem von beiden.
 *
 * Also wird nicht mehr gerechnet, sondern **gemessen**. Jede Darstellung von
 * Jarvis meldet hier, wo ihr Canvas auf dem Bildschirm liegt und wie groß es
 * ist. Der Blitz nimmt den größten sichtbaren — das ist der, den Onur gerade
 * ansieht: das Gesicht im Fenster, wenn es offen ist, sonst die Kugel in der
 * Ecke. Schließt er das Fenster, wandert der Ansatzpunkt mit.
 *
 * Ein Modul und kein Context, weil der Leser hier die 3D-Szene ist: die läuft
 * in ihrer eigenen Bildschleife und darf nicht bei jeder Mausbewegung des
 * Fensters neu rendern. Ein gelesener Wert je Bild kostet nichts.
 */

type Head = { x: number; y: number; size: number };

const heads = new Map<string, Head>();

/** Meldet die Lage eines Kopfes. Wird von JarvisPresence je Bild aufgerufen. */
export function reportJarvisHead(id: string, head: Head | null): void {
  if (head) heads.set(id, head);
  else heads.delete(id);
}

/**
 * Der Kopf, aus dem der Blitz kommt: der größte sichtbare.
 *
 * "Größter" statt "zuletzt gemeldet", weil das der ist, den man ansieht. Wer
 * das Fenster offen hat, schaut nicht auf das 56 Bildpunkte kleine Licht in
 * der Ecke.
 */
export function activeJarvisHead(): Head | null {
  let best: Head | null = null;
  for (const head of heads.values()) {
    if (!best || head.size > best.size) best = head;
  }
  return best;
}
