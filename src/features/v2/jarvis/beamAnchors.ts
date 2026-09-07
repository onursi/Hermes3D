/**
 * Wo der Strahl anfängt und wo er ankommt — gemessen, nicht angenommen.
 *
 * Der Strahl war vorher an feste Bildschirmanteile geschrieben: Start bei
 * `calc(100vw - 44px)`, Ziel bei `50% / 46%`, die Synapsenäste bei 35 %/36 %
 * und 68 %/37 %. Das sieht richtig aus, solange das Gehirn zufällig in der
 * Bildmitte liegt. Dreht man die Kamera, fliegt woanders hin oder klappt den
 * Companion ein, zeigt derselbe Strahl weiter genau dorthin — nur liegt da
 * nichts mehr. Er behauptet dann einen Zugriff, den es nicht gibt.
 *
 * Hier melden beide Seiten ihre **tatsächliche** Lage:
 *
 * - Der Companion meldet, wo sein Kopf gerade wirklich steht (gemessen am
 *   DOM-Element, nicht an der Fensterecke).
 * - Die 3D-Szene projiziert die Notizen, die Jarvis gerade zitiert, auf den
 *   Bildschirm und meldet die Punkte.
 *
 * Bewusst kein React-State: Beides wird pro Bild geschrieben, und ein
 * `setState` pro Bild rendert den halben Baum neu, während die Szene läuft.
 * Ein Modulwert, den der Zeichner liest, kostet nichts.
 *
 * Und die Regel, die das Ganze überhaupt erst ehrlich macht: **Gibt es keine
 * Messung, wird nichts gezeichnet.** Ein fehlender Strahl ist ehrlich, ein
 * Strahl ins Leere ist eine Behauptung.
 */

export type BeamPoint = {
  /** Bildschirmkoordinaten in CSS-Pixeln, Ursprung links oben. */
  x: number;
  y: number;
};

export type BeamTarget = BeamPoint & {
  /** Kennung der Notiz, damit man nachvollziehen kann, worauf gezielt wird. */
  id: string;
  /** Wie die Notiz heißt — das HUD schreibt keinen erfundenen Namen mehr hin. */
  label: string;
  /** Liegt der Punkt vor der Kamera und im Bild? Sonst wird er nicht gezeichnet. */
  onScreen: boolean;
};

type AnchorState = {
  head: BeamPoint | null;
  /** Wann der Kopf zuletzt gemeldet hat — ein alter Wert ist kein Wert. */
  headAt: number;
  targets: BeamTarget[];
  targetsAt: number;
};

/**
 * Wie lange eine Meldung gilt.
 *
 * Meldet eine Seite nicht mehr — der Companion wurde ausgehängt, die Szene
 * gewechselt —, dann verfällt ihr Wert, statt als letzter bekannter Stand
 * weiterzuleben. Zwei Bilder Toleranz bei 60 fps sind rund 33 ms; 400 ms
 * überstehen auch einen Ruckler, ohne eine tote Position zu konservieren.
 */
const GILT_MS = 400;

const state: AnchorState = { head: null, headAt: 0, targets: [], targetsAt: 0 };

/** Der Companion meldet, wo sein Kopf steht. */
export function reportJarvisHead(point: BeamPoint | null): void {
  state.head = point;
  state.headAt = point ? Date.now() : 0;
}

/** Die Szene meldet, wo die zitierten Notizen auf dem Bildschirm liegen. */
export function reportBeamTargets(targets: BeamTarget[]): void {
  state.targets = targets;
  state.targetsAt = targets.length > 0 ? Date.now() : 0;
}

/**
 * Was der Zeichner benutzen darf.
 *
 * Gibt nur zurück, was frisch gemeldet wurde. `head === null` oder eine leere
 * Zielliste heißt: nicht zeichnen.
 */
export function readBeamAnchors(): { head: BeamPoint | null; targets: BeamTarget[] } {
  const now = Date.now();
  return {
    head: state.head && now - state.headAt < GILT_MS ? state.head : null,
    targets: now - state.targetsAt < GILT_MS ? state.targets.filter((t) => t.onScreen) : [],
  };
}
