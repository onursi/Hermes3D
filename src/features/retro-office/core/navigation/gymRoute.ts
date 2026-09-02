import type { FacingPoint, GymRoute } from "@/features/retro-office/core/types";

// The Gym room (walls, equipment) was removed in the HQ v2 layout — see
// furnitureDefaults.ts. This hold is purely a status animation now: the
// agent walks straight to an open-floor point and "stage" is always
// "workout" (no door to stage through). Kept as a resolver function (not
// inlined at call sites) so RetroOffice3D.tsx's existing hold logic needs no
// changes.
export const GYM_DEFAULT_TARGET = {
  x: 950,
  y: 720,
  facing: -Math.PI / 2,
};

export const resolveGymRoute = (
  _x: number,
  _y: number,
  workoutTarget: FacingPoint = GYM_DEFAULT_TARGET,
): GymRoute => ({
  stage: "workout",
  targetX: workoutTarget.x,
  targetY: workoutTarget.y,
  facing: workoutTarget.facing,
});
