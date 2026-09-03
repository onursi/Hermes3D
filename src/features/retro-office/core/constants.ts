export const DESK_STICKY_MS = 10_000;
export const SNAP_GRID = 10;
// v13: same reason as the v12 bump right below this comment — the table
// grew back from radius 40 to 65 right after v12 shipped, and a layout
// already saved under v12 would otherwise keep the too-small table forever
// (ensureOfficeMeetingRoom never repositions/resizes an existing table, only
// adds one when none exists). Any time TABLE_RADIUS/SEAT_DISTANCE/
// MEETING_ROOM_CENTER in core/meetingRoom.ts changes, this key needs a
// fresh bump — there is no other mechanism that pushes updated council-table
// geometry to a browser with an existing saved layout.
// (A v14 bump was made and reverted here: the Kanban Board was briefly
// added as a DEFAULT_FURNITURE catalog item, then pulled back out in favor
// of a custom wall-recessed fixture — see WallKanbanBoard in
// scene/environment.tsx — which isn't a furniture item at all, so it needs
// no STORAGE_KEY bump.)
export const STORAGE_KEY = "hermes-office-furniture-v17";
export const ATM_MIGRATION_KEY = "hermes-office-atm-migration-v1";
export const SERVER_ROOM_MIGRATION_KEY =
  "hermes-office-server-room-migration-v3";
export const GYM_ROOM_MIGRATION_KEY = "hermes-office-gym-room-migration-v3";
export const QA_LAB_MIGRATION_KEY = "hermes-office-qa-lab-migration-v3";
export const PHONE_BOOTH_MIGRATION_KEY = "hermes-office-phone-booth-migration-v1";
export const SMS_BOOTH_MIGRATION_KEY = "hermes-office-sms-booth-migration-v1";
export const ROTATION_STEP_DEG = 15;
export const WALL_THICKNESS = 8;
export const DOOR_THICKNESS = 8;
export const DOOR_LENGTH = 40;
export const MIN_WALL_LENGTH = SNAP_GRID * 2;
export const ELEVATION_STEP = 0.08;
export const WALK_SPEED = 2.5;
export const WORKING_WALK_SPEED_MULTIPLIER = 1.4;
export const WALK_ANIM_SPEED = 0.45;
export const AGENT_SCALE = 1.75;
export const BUMP_FREEZE_MS = 1500;
export const BUMP_RECOVERY_MS = 1200;
export const AGENT_RADIUS = 20;
export const SEPARATION_STRENGTH = 3;
export const CANVAS_W = 1800;
// Tall enough to contain the district's full vertical stack: local office
// (0-900) + city path (940-1160) + remote office (1200-2100), see
// district.ts — grown from 1800 when the local office footprint's room-shape
// pass made it taller (720->900), which pushed the remote-office band's
// bottom edge from 1740 to 2100.
export const CANVAS_H = 2200;
export const EAST_WING_START_X = 1092;
export const EAST_WING_SIDE_MARGIN = 34;
export const EAST_WING_ROOM_TOP_Y = 40;
export const EAST_WING_ROOM_HEIGHT = 640;
export const EAST_HALL_WIDTH = 56;
export const EAST_WING_SPECIALTY_ROOM_WIDTH = 176;
export const GYM_ROOM_X = EAST_WING_START_X + EAST_WING_SIDE_MARGIN;
export const GYM_ROOM_WIDTH = EAST_WING_SPECIALTY_ROOM_WIDTH;
export const GYM_ROOM_END_X = GYM_ROOM_X + GYM_ROOM_WIDTH;
export const QA_LAB_X = GYM_ROOM_END_X + EAST_HALL_WIDTH;
export const QA_LAB_WIDTH = EAST_WING_SPECIALTY_ROOM_WIDTH;
export const QA_LAB_END_X = QA_LAB_X + QA_LAB_WIDTH;
export const MEETING_ROOM_X = QA_LAB_END_X + EAST_HALL_WIDTH;
// Wider than the other specialty rooms (Gym, QA Lab): a boardroom reads as
// a tube at the shared 176-unit width, so the Meeting Room borrows most of
// the remaining slack to the east exterior wall (canvas edge at 1800) to
// give the conference table real breathing room on both sides.
export const MEETING_ROOM_WIDTH = EAST_WING_SPECIALTY_ROOM_WIDTH + 32;
export const MEETING_ROOM_END_X = MEETING_ROOM_X + MEETING_ROOM_WIDTH;
export const MEETING_ROOM_MIGRATION_KEY = "hermes-office-meeting-room-migration-v1";
export const EAST_WING_DOOR_Y = 260;
export const SCALE = 0.018;
export const WORLD_W = CANVAS_W * SCALE;
export const WORLD_H = CANVAS_H * SCALE;
export const PING_PONG_SESSION_MS = 60_000;
export const PING_PONG_APPROACH_SPEED = WALK_SPEED * 1.8;
// Conversations are timeboxed by the speech window, so distant participants
// hurry over. The floor is 1800 units across: at 2.2x an agent on the far side
// was still walking a minute after the group chat it was answering.
export const CONVERSATION_APPROACH_SPEED = WALK_SPEED * 4.5;
export const PING_PONG_BALL_RADIUS = 0.055;
export const PING_PONG_TABLE_SURFACE_Y = 0.465;
