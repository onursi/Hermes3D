"use client";

/**
 * Wie stark der Hyperschall gerade zieht — ein Wert, ein Schreiber, mehrere Leser.
 *
 * Antigravitys Baustein hat Sichtfeld, Rütteln und Antriebsklang direkt in
 * `HyperRide` gesetzt. Das ist naheliegend und wäre hier trotzdem falsch
 * gewesen: **`FreeFlight` schreibt dieselben drei Dinge bereits jedes Bild.**
 * Sichtfeld (`46 + rush * 25`), Kameradrehung (aus Nick- und Gierwinkel) und
 * `flightAudio.speed` gehören ihm, weil er die Steuerung besitzt.
 *
 * Zwei Schreiber auf derselben Eigenschaft heißt: Wer zuletzt läuft, gewinnt,
 * und die Reihenfolge zweier `useFrame`-Schleifen ist nichts, worauf man bauen
 * sollte. Das Ergebnis wäre ein flackerndes Sichtfeld gewesen.
 *
 * Beim Rütteln wäre es schlimmer geworden als Flackern. Der Baustein addiert
 * es mit `rotation.x += ...` auf die Kamera. `FreeFlight` erkennt eine von
 * außen veränderte Blickrichtung und übernimmt sie in seine eigenen Winkel —
 * das Rütteln wäre also Bild für Bild in die echte Blickrichtung gewandert und
 * hätte Onur langsam weggedreht, ohne dass jemand die Ursache sähe.
 *
 * Deshalb: `HyperRide` zeichnet den Tunnel und meldet hier nur, wie stark er
 * ist. `FreeFlight` liest den Wert und rechnet ihn dort ein, wo er ohnehin
 * schon Sichtfeld, Drehung und Klang setzt. Die Wirkung ist genau die, die
 * Antigravity beschrieben hat — nur bleibt jede Eigenschaft bei einem Besitzer.
 */
export const hyperState = {
  /** 0 bis 1. Geschrieben von HyperRide, gelesen von FreeFlight. */
  warp: 0,
};

/**
 * Wie viel Grad Sichtfeld der Ritt oben drauf legt.
 *
 * Antigravitys Baustein bietet 58 Grad (bis 104°) an und nennt im Kommentar
 * selbst 39 Grad (bis 85°) als schonendere Wahl für die Vega 11. Genau die
 * steht hier: ein weiteres Sichtfeld zeigt mehr Fläche, und Fläche ist auf
 * einer integrierten Grafikeinheit die Grenze. Gemessen wird nach dem Einbau,
 * nicht vermutet — steht der Wert stabil bei 60 fps, kann er wieder hoch.
 */
export const HYPER_FOV_GAIN = 39;

/** Wie laut der Antrieb beim vollen Ritt wird, in derselben Einheit wie die Fluggeschwindigkeit. */
export const HYPER_AUDIO_SPEED = 2200;
