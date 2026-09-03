import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import type { OfficeInteractionTargetId } from "@/lib/office/places";

export type OfficeAgent = {
  id: string;
  name: string;
  subtitle?: string | null;
  status: "working" | "idle" | "error";
  color: string;
  item: string;
  avatarProfile?: AgentAvatarProfile | null;
};

export type JanitorTool = "broom" | "vacuum" | "floor_scrubber";

export type JanitorActor = {
  id: string;
  name: string;
  role: "janitor";
  status: "working";
  color: string;
  item: "cleaning";
  janitorTool: JanitorTool;
  janitorRoute: FacingPoint[];
  janitorPauseMs: number;
  janitorDespawnAt: number;
};

export type SceneActor = OfficeAgent | JanitorActor;

export type RenderAgent = SceneActor & {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  path: { x: number; y: number }[];
  facing: number;
  frame: number;
  walkSpeed: number;
  phaseOffset: number;
  state: "walking" | "sitting" | "standing" | "away" | "working_out" | "dancing";
  awayUntil?: number;
  separationReplanAt?: number;
  bumpedUntil?: number;
  bumpTalkUntil?: number;
  collisionCooldownUntil?: number;
  pingPongUntil?: number;
  pingPongTargetX?: number;
  pingPongTargetY?: number;
  pingPongFacing?: number;
  pingPongPartnerId?: string;
  pingPongTableUid?: string;
  pingPongSide?: 0 | 1;
  pingPongPreviousWalkSpeed?: number;
  conversationGroupId?: string;
  conversationTargetX?: number;
  conversationTargetY?: number;
  conversationFacing?: number;
  conversationSeatIndex?: number;
  conversationSize?: number;
  gestureClip?: "wave" | "thumbsUp" | "dance" | "jump" | null;
  gestureUntil?: number;
  conversationPreviousWalkSpeed?: number;
  conversationReplanAtMs?: number;
  interactionTarget?: OfficeInteractionTargetId;
  smsBoothStage?: "door_outer" | "door_inner" | "typing";
  phoneBoothStage?: "door_outer" | "door_inner" | "receiver";
  serverRoomStage?: "door_outer" | "door_inner" | "terminal";
  gymStage?: "door_outer" | "door_inner" | "workout";
  qaLabStage?: "door_outer" | "door_inner" | "station";
  qaLabStationType?: QaLabStationType;
  workoutStyle?: "run" | "lift" | "bike" | "box" | "row" | "stretch";
  janitorRouteIndex?: number;
  janitorPauseUntil?: number;
  workstationId?: string;
  workstationUntil?: number;
  workstationActivity?: string;
  verticalSuctionY?: number;
};

export type FurnitureItem = {
  _uid: string;
  type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  color?: string;
  id?: string;
  facing?: number;
  vertical?: boolean;
  elevation?: number;
  /**
   * Per-item override for buildNavGrid's obstacle padding (core/navigation.ts).
   * Most furniture should rely on the per-type default in ITEM_METADATA —
   * this exists for the rare wall segment that flanks a passage narrow
   * enough that the shared 15-unit default would seal it shut (see the
   * East Wing hall walls in furnitureDefaults.ts for the motivating case).
   */
  navPadding?: number;
};

export type FurnitureSeed = Omit<FurnitureItem, "_uid">;

export type CanvasPoint = {
  x: number;
  y: number;
};

export type FacingPoint = CanvasPoint & {
  facing: number;
};

export type QaLabStationType = "console" | "device_rack" | "bench";

export type GymWorkoutLocation = FacingPoint & {
  workoutStyle: "run" | "lift" | "bike" | "box" | "row" | "stretch";
};

export type QaLabStationLocation = FacingPoint & {
  stationType: QaLabStationType;
};

export type ServerRoomRoute = {
  stage: "door_outer" | "door_inner" | "terminal";
  targetX: number;
  targetY: number;
  facing: number;
};

export type QaLabRoute = {
  stage: "door_outer" | "door_inner" | "station";
  targetX: number;
  targetY: number;
  facing: number;
};

export type GymRoute = {
  stage: "door_outer" | "door_inner" | "workout";
  targetX: number;
  targetY: number;
  facing: number;
};

export type PhoneBoothRoute = {
  stage: "door_outer" | "door_inner" | "receiver";
  targetX: number;
  targetY: number;
  facing: number;
};

export type SmsBoothRoute = {
  stage: "door_outer" | "door_inner" | "typing";
  targetX: number;
  targetY: number;
  facing: number;
};
