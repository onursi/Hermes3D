import { SNAP_GRID } from "@/features/retro-office/core/constants";
import { snap } from "@/features/retro-office/core/geometry";
import type { FurnitureItem } from "@/features/retro-office/core/types";

export type DistrictZone = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

// HQ v2 room-shape pass: the office was a 1800x720 strip (2.5:1) — very
// elongated, with a large dead gap between the desk cluster (ends ~x:1090)
// and the Council Corner (was centered at x:1500). Per the TikTok/SAMS
// reference's compact, near-square room card, the corner moved in to
// x:1180 (see meetingRoom.ts) and the footprint shrank to match — width
// down, height up, so the shape reads as a room rather than a corridor.
// CITY_PATH_ZONE/REMOTE_OFFICE_ZONE and CANVAS_H (constants.ts) are shifted
// down by the same +180 height delta below so they still stack cleanly
// after the taller local office, with no overlap.
// Drastically smaller than the 1200x750 room-shape pass — that still read
// as an empty white/black hall with furniture scattered in it. The SAMS
// reference's diorama fills most of the frame: a compact footprint where
// the table + 4 agents actually occupy the space, not float in it.
export const LOCAL_OFFICE_CANVAS_WIDTH = 500;
export const LOCAL_OFFICE_CANVAS_HEIGHT = 400;

export const LOCAL_OFFICE_ZONE: DistrictZone = {
  minX: 0,
  maxX: LOCAL_OFFICE_CANVAS_WIDTH,
  minY: 0,
  maxY: LOCAL_OFFICE_CANVAS_HEIGHT,
};

export const CITY_PATH_ZONE: DistrictZone = {
  minX: 0,
  maxX: LOCAL_OFFICE_CANVAS_WIDTH,
  minY: 940,
  maxY: 1160,
};

export const REMOTE_OFFICE_ZONE: DistrictZone = {
  minX: 0,
  maxX: LOCAL_OFFICE_CANVAS_WIDTH,
  minY: 1200,
  maxY: 1200 + LOCAL_OFFICE_CANVAS_HEIGHT,
};

export const REMOTE_ROAM_POINTS = [
  { x: 800, y: 1400 },
  { x: 850, y: 1700 },
  { x: 820, y: 1780 },
  { x: 450, y: 1620 },
  { x: 250, y: 1620 },
  { x: 650, y: 1620 },
  { x: 150, y: 1820 },
] as const;

export const DISTRICT_CAMERA_POSITION: [number, number, number] = [14, 16, 18];
export const DISTRICT_CAMERA_TARGET: [number, number, number] = [0, 0, 1];
export const DISTRICT_CAMERA_ZOOM = 34;

export const isRemoteOfficeAgentId = (agentId: string) => agentId.startsWith("remote:");

const clampZoneValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, snap(value)));

export const clampPointToZone = (
  x: number,
  y: number,
  zone: DistrictZone,
): { x: number; y: number } => ({
  x: clampZoneValue(x, zone.minX + SNAP_GRID, zone.maxX - SNAP_GRID),
  y: clampZoneValue(y, zone.minY + SNAP_GRID, zone.maxY - SNAP_GRID),
});

export const pickRandomPointInZone = (
  zone: DistrictZone,
  random = Math.random,
): { x: number; y: number } =>
  clampPointToZone(
    zone.minX + (zone.maxX - zone.minX) * random(),
    zone.minY + (zone.maxY - zone.minY) * random(),
    zone,
  );

export const projectFurnitureIntoRemoteOfficeZone = (params: {
  furniture: FurnitureItem[];
  sourceWidth: number;
  sourceHeight: number;
}): FurnitureItem[] => {
  const sourceWidth = Math.max(1, params.sourceWidth);
  const sourceHeight = Math.max(1, params.sourceHeight);
  const targetWidth = REMOTE_OFFICE_ZONE.maxX - REMOTE_OFFICE_ZONE.minX;
  const targetHeight = REMOTE_OFFICE_ZONE.maxY - REMOTE_OFFICE_ZONE.minY;
  const canCloneExactly =
    sourceWidth === LOCAL_OFFICE_CANVAS_WIDTH && sourceHeight === LOCAL_OFFICE_CANVAS_HEIGHT;

  if (canCloneExactly) {
    const offsetX = REMOTE_OFFICE_ZONE.minX - LOCAL_OFFICE_ZONE.minX;
    const offsetY = REMOTE_OFFICE_ZONE.minY - LOCAL_OFFICE_ZONE.minY;
    return params.furniture.map((item) => ({
      ...item,
      _uid: `remote-layout:${item._uid}`,
      x: offsetX + item.x,
      y: offsetY + item.y,
    }));
  }

  const padding = 30;
  const usableTargetWidth = Math.max(1, targetWidth - padding * 2);
  const usableTargetHeight = Math.max(1, targetHeight - padding * 2);
  const scale = Math.min(usableTargetWidth / sourceWidth, usableTargetHeight / sourceHeight);
  const contentWidth = sourceWidth * scale;
  const contentHeight = sourceHeight * scale;
  const offsetX = REMOTE_OFFICE_ZONE.minX + (targetWidth - contentWidth) / 2;
  const offsetY = REMOTE_OFFICE_ZONE.minY + (targetHeight - contentHeight) / 2;
  return params.furniture.map((item) => {
    const scaledWidth = typeof item.w === "number" ? item.w * scale : undefined;
    const scaledHeight = typeof item.h === "number" ? item.h * scale : undefined;
    return {
      ...item,
      _uid: `remote-layout:${item._uid}`,
      x: offsetX + item.x * scale,
      y: offsetY + item.y * scale,
      ...(typeof scaledWidth === "number" ? { w: scaledWidth } : {}),
      ...(typeof scaledHeight === "number" ? { h: scaledHeight } : {}),
      ...(typeof item.r === "number" ? { r: item.r * scale } : {}),
    };
  });
};
