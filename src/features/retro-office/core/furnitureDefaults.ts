import { nextUid } from "@/features/retro-office/core/geometry";
import { MEETING_ROOM_SEATS, MEETING_ROOM_TABLE } from "@/features/retro-office/core/meetingRoom";
import { hasMeetingRoomMigrationApplied } from "@/features/retro-office/core/persistence";
import type {
  FurnitureItem,
  FurnitureSeed,
} from "@/features/retro-office/core/types";

export type OfficeLayoutPreset = "office" | "lobby";

// HQ v2: the Gym, QA Lab, Server Room, Art Room and the separate walled
// Meeting Room from the previous layout are gone entirely — no walls, no
// doors, no equipment. The office is one continuous open floor with a
// single dedicated meeting area: the Council Corner, a round table (see
// core/meetingRoom.ts) with no walls around it at all. This also means the
// A* nav-grid door/hall seams that caused real bugs in that layout (see git
// history) can't recur — there is no inter-room geometry left to get wrong.
//
// Council Corner — round table, 4 real seats (Hermes at the seat facing the
// knowledge screen, three specialists around the rest of the circle).
// Chair positions/facings come from the shared MEETING_ROOM_SEATS layout so
// the furniture, the nav grid, and the fixtures/status pucks above each
// seat can never drift apart.
const DEFAULT_MEETING_ROOM_ITEMS: FurnitureSeed[] = [
  { type: "round_table", ...MEETING_ROOM_TABLE },
  ...MEETING_ROOM_SEATS.map((seat) => ({
    type: "chair" as const,
    x: seat.x - 12,
    y: seat.y - 12,
    facing: seat.chairFacing,
  })),
];

// HQ v3 clean-slate pass: everything except the Council Corner round table
// removed on request — couches, ping-pong table, desk cubicles, kitchen
// appliances, kanban board, ATM/phone/SMS booths, decor. The user is
// rebuilding the furniture set piece by piece against the new TikTok/SAMS-
// referenced room shape (see district.ts/meetingRoom.ts), so an empty floor
// is the right starting point rather than carrying over furniture authored
// for the old 1800x720 layout. The `ensureOffice*` helpers in this file
// (ATM, jukebox, kanban, phone/SMS booth, ping-pong) will silently re-add
// their item the moment one is missing — see their `if (items.some(...))
// return items` guards — so ensure the callers of those helpers are what
// re-populate this list, not this array itself.
//
// The furniture-editor's "Kanban Board" catalog item was tried and
// explicitly rejected — a flat pinboard prop, not the recessed, real-depth
// "Kanban Wall" panel wanted. That's a custom wall fixture instead (see
// WallKanbanBoard in scene/environment.tsx, alongside WallWhiteboard),
// not a placeable furniture item.
const DEFAULT_FURNITURE: FurnitureSeed[] = [...DEFAULT_MEETING_ROOM_ITEMS];

const DEFAULT_LOBBY_FURNITURE: FurnitureSeed[] = [
  { type: "round_table", x: 120, y: 110, r: 72 },
  { type: "chair", x: 182, y: 110, facing: 0 },
  { type: "chair", x: 160, y: 168, facing: 220 },
  { type: "chair", x: 92, y: 170, facing: 140 },
  { type: "chair", x: 58, y: 112, facing: 90 },
  { type: "chair", x: 92, y: 52, facing: 40 },
  { type: "bookshelf", x: 248, y: 32, w: 78, h: 118 },
  { type: "couch", x: 332, y: 92, w: 44, h: 112, vertical: true, facing: 180 },
  { type: "couch", x: 430, y: 92, w: 44, h: 112, vertical: true, facing: 180 },
  { type: "table_rect", x: 382, y: 138, w: 72, h: 34 },
  { type: "beanbag", x: 332, y: 210, color: "#1565c0", facing: 135 },
  { type: "beanbag", x: 436, y: 216, color: "#7c3aed", facing: 225 },
  { type: "whiteboard", x: 36, y: 214, w: 10, h: 64 },
  { type: "clock", x: 566, y: 6 },
  { type: "table_rect", x: 874, y: 102, w: 124, h: 34, facing: 0 },
  { type: "chair", x: 934, y: 176, facing: 180 },
  { type: "vending", x: 788, y: 10 },
  { type: "trash", x: 826, y: 20 },
  { type: "couch", x: 982, y: 382, w: 112, h: 42, facing: 90 },
  { type: "couch", x: 392, y: 634, w: 112, h: 42 },
  { type: "table_rect", x: 980, y: 380, w: 60, h: 30, facing: 270 },
  { type: "plant", x: 40, y: 40 },
  { type: "plant", x: 662, y: 32 },
  { type: "plant", x: 340, y: 700 },
  { type: "plant", x: 1088, y: 312 },
  { type: "plant", x: 530, y: 700 },
  ...DEFAULT_MEETING_ROOM_ITEMS,
];

export const materializeDefaults = (
  preset: OfficeLayoutPreset = "office",
): FurnitureItem[] =>
  (preset === "lobby" ? DEFAULT_LOBBY_FURNITURE : DEFAULT_FURNITURE).map((item, index) => ({
    ...item,
    _uid: `${preset}_${index}`,
  }));

export const isRetiredPingPongLamp = (item: FurnitureItem) =>
  item.type === "lamp" &&
  ((item.x === 870 && item.y === 470) || (item.x === 900 && item.y === 580));

// No-op for the same HQ v3 clean-slate reason as the ensureOffice* helpers
// below — the ping-pong table was removed from DEFAULT_FURNITURE on request.
export const ensureOfficePingPongTable = (
  items: FurnitureItem[],
): FurnitureItem[] => items;

// HQ v3 clean-slate pass: ATM, jukebox, kanban board, phone/SMS booth and
// ping-pong table were all removed from DEFAULT_FURNITURE on request (see
// the comment above it) — turned into no-ops here, matching the existing
// ensureOfficeGymRoom/QaLab/ServerRoom pattern below, so they don't silently
// re-add themselves the moment the pipeline notices they're "missing".
// RetroOffice3D.tsx's materialization pipeline still calls all of these
// unconditionally, so removing the calls there would touch more surface for
// no behavioral gain over just no-opping the functions themselves.
export const ensureOfficeAtm = (items: FurnitureItem[]): FurnitureItem[] =>
  items;

export const ensureOfficeJukebox = (items: FurnitureItem[]): FurnitureItem[] =>
  items;

export const ensureOfficeKanbanBoard = (
  items: FurnitureItem[],
): FurnitureItem[] => items;

export const ensureOfficePhoneBooth = (
  items: FurnitureItem[],
): FurnitureItem[] => items;

export const ensureOfficeSmsBooth = (
  items: FurnitureItem[],
): FurnitureItem[] => items;

// The Gym, QA Lab and Server Room no longer exist in HQ v2 (see the comment
// above DEFAULT_MEETING_ROOM_ITEMS) — these are kept as harmless no-ops
// rather than removed outright, since RetroOffice3D.tsx's furniture
// materialization pipeline still calls them and a real removal would mean
// touching that pipeline for no behavioral gain.
export const ensureOfficeGymRoom = (items: FurnitureItem[]): FurnitureItem[] =>
  items;

export const ensureOfficeQaLab = (items: FurnitureItem[]): FurnitureItem[] =>
  items;

export const ensureOfficeServerRoom = (
  items: FurnitureItem[],
): FurnitureItem[] => items;

const isMeetingRoomTable = (item: FurnitureItem) =>
  item.type === "round_table" &&
  item.x === MEETING_ROOM_TABLE.x &&
  item.y === MEETING_ROOM_TABLE.y;

export const ensureOfficeMeetingRoom = (items: FurnitureItem[]): FurnitureItem[] => {
  if (items.some(isMeetingRoomTable)) return items;
  if (hasMeetingRoomMigrationApplied()) return items;
  return [
    ...items,
    ...DEFAULT_MEETING_ROOM_ITEMS.map((item) => ({ ...item, _uid: nextUid() })),
  ];
};
