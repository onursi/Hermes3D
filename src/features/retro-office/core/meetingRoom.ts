/**
 * Single source of truth for the Council Corner's layout — the HQ v2
 * redesign's one dedicated meeting area: a round table on the open main
 * floor, no walls, no door. Shared by furnitureDefaults.ts (the table +
 * chair furniture items, so navigation/edit-mode see real objects) and
 * objects/meetingRoomFixtures.tsx (status pucks, the knowledge screen, the
 * approval marker), so the two can never drift apart.
 *
 * HQ v2 deliberately has no separate walled rooms (Gym, QA Lab, Server
 * Room, Art Room are gone) — everything lives on one continuous floor, so
 * there is no door/hall geometry to get wrong and no A* nav-grid seam to
 * maintain here at all.
 */

export type MeetingRoomSeatRole = "moderator" | "specialist";

export type MeetingRoomSeatLayout = {
  role: MeetingRoomSeatRole;
  /** Canvas-space center point of the seat (chair + status-puck anchor). */
  x: number;
  y: number;
  /** Facing, in degrees, for the chair furniture item — toward the table. */
  chairFacing: number;
};

/** Center of the round table, on the open main floor (no walls around it).
 * Centered in the much smaller room footprint (see district.ts's
 * LOCAL_OFFICE_CANVAS_WIDTH/HEIGHT = 500x400) — the table is currently the
 * only piece of furniture in the room at all. */
export const MEETING_ROOM_CENTER = {
  x: 250,
  y: 200,
};

// Table/seat/screen sizing tuned together with the room footprint (was
// TABLE_RADIUS 90 / SEAT_DISTANCE 150 when the room was 1200x750; briefly
// 40/120 while chasing a "sitting into the table" bug that actually turned
// out to be a stale-localStorage layout, see STORAGE_KEY in constants.ts —
// shrinking the table itself wasn't the right lever, it just made the
// table read as too small). Kept the wider 150 seat distance from that pass
// (it gives 85 units of real clearance even after the nav-grid's obstacle
// padding and 25-unit grid quantization eat into it) but grew the table
// back up to a normal-looking size.
const TABLE_RADIUS = 65;

// round_table furniture items are authored corner-anchored, like every
// other furniture type (RoundTableModel offsets its mesh by [r, r] to find
// the true center — see objects/primitives.tsx) — NOT center-anchored the
// way MEETING_ROOM_CENTER and everything else in this file is. Subtracting
// the radius here keeps the table itself lined up with the seats, rug,
// screen and approval marker below, which all really are center-anchored.
export const MEETING_ROOM_TABLE = {
  x: MEETING_ROOM_CENTER.x - TABLE_RADIUS,
  y: MEETING_ROOM_CENTER.y - TABLE_RADIUS,
  r: TABLE_RADIUS,
};

const SEAT_DISTANCE = 88;

/** Moderator (Hermes) at the seat facing the knowledge screen; three
 * specialists spaced evenly around the rest of the circle. */
export const MEETING_ROOM_SEATS: MeetingRoomSeatLayout[] = [
  {
    role: "moderator",
    x: MEETING_ROOM_CENTER.x,
    y: MEETING_ROOM_CENTER.y - SEAT_DISTANCE,
    chairFacing: 0, // Faces South (+z) directly toward table center
  },
  {
    role: "specialist",
    x: MEETING_ROOM_CENTER.x - SEAT_DISTANCE,
    y: MEETING_ROOM_CENTER.y,
    chairFacing: 90, // Faces East (+x) directly toward table center
  },
  {
    role: "specialist",
    x: MEETING_ROOM_CENTER.x + SEAT_DISTANCE,
    y: MEETING_ROOM_CENTER.y,
    chairFacing: 270, // Faces West (-x) directly toward table center
  },
  {
    role: "specialist",
    x: MEETING_ROOM_CENTER.x,
    y: MEETING_ROOM_CENTER.y + SEAT_DISTANCE,
    chairFacing: 180, // Faces North (-z) directly toward table center (Hermes South seat)
  },
];

/** Freestanding knowledge screen behind the moderator's seat — a floor
 * panel, not a wall-mounted one, since there is no wall here anymore. */
export const MEETING_ROOM_SCREEN_POSITION = {
  x: MEETING_ROOM_CENTER.x,
  y: MEETING_ROOM_CENTER.y - SEAT_DISTANCE - 50,
};

/** Human-approval marker, opposite the screen at the foot of the table. */
export const MEETING_ROOM_APPROVAL_POSITION = {
  x: MEETING_ROOM_CENTER.x,
  y: MEETING_ROOM_CENTER.y + SEAT_DISTANCE + 35,
};

/** Floor rug spanning the table + seating circle, for a grounded, warm center. */
export const MEETING_ROOM_RUG = {
  x: MEETING_ROOM_CENTER.x,
  y: MEETING_ROOM_CENTER.y,
  w: (SEAT_DISTANCE + 30) * 2,
  h: (SEAT_DISTANCE + 30) * 2,
};
