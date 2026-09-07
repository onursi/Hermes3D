"use client";

/**
 * Wo im Bild das Gehirn gerade angezapft wird.
 *
 * Die 3D-Szene rechnet jedes Bild aus, worauf Jarvis zugreift — beim Suchen
 * die Mitte der Wissenswolke, beim Lesen der Schwerpunkt der gelesenen
 * Notizen — und legt die **Bildschirmkoordinate** hier ab. Der Strahl selbst
 * wird darüber im DOM gezeichnet.
 *
 * Warum nicht in 3D, wo die Daten herkommen: ich habe es dort gebaut, und es
 * hat die ganze Szene schwarz gemacht. Ein Band, das von einem Punkt vier
 * Einheiten vor der Kamera bis in die Tiefe der Wolke reicht, spannt einen so
 * großen Tiefenbereich auf, dass der Nachbearbeitungspass daran zerbrach —
 * sichtbar war danach nichts mehr, und in der Konsole stand kein Wort.
 *
 * Onurs eigener Entwurf macht es als CSS-Element über der Szene. Das ist nicht
 * die billigere Lösung, sondern die richtige: der Strahl gehört zur Anzeige,
 * nicht zum Raum. Er verbindet zwei Dinge auf dem **Bildschirm** — den Kopf in
 * der Ecke und die Wolke in der Mitte — und was auf dem Bildschirm verbindet,
 * wird auf dem Bildschirm gezeichnet.
 */

export type BrainLink = {
  /** Bildkoordinaten des Ziels, in CSS-Pixeln. */
  x: number;
  y: number;
  /** Liegt das Ziel überhaupt im Bild? */
  onScreen: boolean;
  /** 0 = nichts, 0.5 = sucht, 1 = liest gerade. */
  strength: number;
};

const link: BrainLink = { x: 0, y: 0, onScreen: false, strength: 0 };

/** Von der Szene je Bild gesetzt. */
export function reportBrainLink(next: Partial<BrainLink>): void {
  Object.assign(link, next);
}

/** Vom Strahl im DOM gelesen. */
export function currentBrainLink(): BrainLink {
  return link;
}
