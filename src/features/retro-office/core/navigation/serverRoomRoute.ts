import type { ServerRoomRoute } from "@/features/retro-office/core/types";

// The Server Room (walls, racks, terminal) was removed in the HQ v2 layout —
// see furnitureDefaults.ts. This hold is purely a status animation now: the
// agent walks straight to an open-floor point and "stage" is always
// "terminal" (no door to stage through). Kept as a resolver function (not
// inlined at call sites) so RetroOffice3D.tsx's existing hold logic needs no
// changes.
export const SERVER_ROOM_TARGET = {
  x: 110,
  y: 655,
  facing: 0,
};

export const resolveServerRoomRoute = (
  _x: number,
  _y: number,
): ServerRoomRoute => ({
  stage: "terminal",
  targetX: SERVER_ROOM_TARGET.x,
  targetY: SERVER_ROOM_TARGET.y,
  facing: SERVER_ROOM_TARGET.facing,
});
