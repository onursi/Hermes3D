import type { FacingPoint, QaLabRoute } from "@/features/retro-office/core/types";

// The QA Lab room (walls, terminals) was removed in the HQ v2 layout — see
// furnitureDefaults.ts. This hold is purely a status animation now: the
// agent walks straight to an open-floor point and "stage" is always
// "station" (no door to stage through). Kept as a resolver function (not
// inlined at call sites) so RetroOffice3D.tsx's existing hold logic needs no
// changes.
export const QA_LAB_DEFAULT_TARGET = {
  x: 1050,
  y: 720,
  facing: -Math.PI / 2,
};

export const resolveQaLabRoute = (
  _x: number,
  _y: number,
  stationTarget: FacingPoint = QA_LAB_DEFAULT_TARGET,
): QaLabRoute => ({
  stage: "station",
  targetX: stationTarget.x,
  targetY: stationTarget.y,
  facing: stationTarget.facing,
});
