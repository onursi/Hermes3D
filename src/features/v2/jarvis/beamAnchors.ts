/**
 * beamAnchors.ts
 *
 * Exakte Messung der Bildschirmkoordinaten für den Jarvis-Laserstrahl und Gehirn-Scan:
 * 1. Jarvis-Kopf (aktiver sichtbarer Avatar im DOM)
 * 2. Real zitierte Notizen (projizierte 3D-Knotenpositionen)
 * 3. Gehirn-Zentrum [0, 0, 0] als Fallback-Ziel während der Suchphase
 * 4. Sweep-Tastpunkte (reale Notizpunkte im Sichtfeld für den dynamischen Scan-Durchlauf)
 */

export type BeamPoint = {
  x: number;
  y: number;
};

export type BeamTarget = BeamPoint & {
  id: string;
  label: string;
  onScreen: boolean;
};

type AnchorState = {
  head: BeamPoint | null;
  headAt: number;
  brainCenter: BeamPoint | null;
  brainCenterAt: number;
  targets: BeamTarget[];
  targetsAt: number;
  sweep: BeamPoint[];
  sweepAt: number;
};

// 1200ms Toleranz gegen Renderpausen / Frame-Drops
const GILT_MS = 1200;

const state: AnchorState = {
  head: null,
  headAt: 0,
  brainCenter: null,
  brainCenterAt: 0,
  targets: [],
  targetsAt: 0,
  sweep: [],
  sweepAt: 0,
};

export function reportJarvisHead(point: BeamPoint | null): void {
  state.head = point;
  state.headAt = point ? Date.now() : 0;
}

export function reportBrainCenter(point: BeamPoint | null): void {
  state.brainCenter = point;
  state.brainCenterAt = point ? Date.now() : 0;
}

export function reportSweepPoints(points: BeamPoint[]): void {
  state.sweep = points;
  state.sweepAt = points.length > 0 ? Date.now() : 0;
}

export function reportBeamTargets(targets: BeamTarget[]): void {
  state.targets = targets;
  state.targetsAt = targets.length > 0 ? Date.now() : 0;
}

export function readBeamAnchors(): {
  head: BeamPoint | null;
  brainCenter: BeamPoint | null;
  targets: BeamTarget[];
  sweep: BeamPoint[];
} {
  const now = Date.now();
  return {
    head: state.head && now - state.headAt < GILT_MS ? state.head : null,
    brainCenter: state.brainCenter && now - state.brainCenterAt < GILT_MS ? state.brainCenter : null,
    targets: now - state.targetsAt < GILT_MS ? state.targets.filter((t) => t.onScreen) : [],
    sweep: now - state.sweepAt < GILT_MS ? state.sweep : [],
  };
}
