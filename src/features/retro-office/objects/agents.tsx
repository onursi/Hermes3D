import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useRef, useState } from "react";
import * as THREE from "three";
import {
  AGENT_SCALE,
  WALK_ANIM_SPEED,
} from "@/features/retro-office/core/constants";
import { toWorld } from "@/features/retro-office/core/geometry";
import { AgentModelProps } from "@/features/retro-office/objects/types";
import {
  RobotAgentModel,
  type RobotClipKey,
} from "@/features/retro-office/objects/RobotAgentModel";

const MAX_NAMEPLATE_TEXT_LENGTH = 10;
const MAX_SUBTITLE_TEXT_LENGTH = 20;
const MAX_SPEECH_BUBBLE_TEXT_LENGTH = 180;
const MAX_SPEECH_BUBBLE_LINES = 4;

const formatAgentNameplateText = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= MAX_NAMEPLATE_TEXT_LENGTH) return normalized;
  const [firstName] = normalized.split(" ");
  return firstName || normalized;
};

/**
 * Compress a role description to one short nameplate line.
 *
 * Agent roles arrive as full sentences ("technical planner and business
 * systems analyst for Smartways. Converts Jira tickets into…"); rendered raw
 * they wrap into a wall of text above every agent. Keep the first clause,
 * clamped at a word boundary, so the plate stays a single line.
 */
export const formatAgentSubtitleText = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const clause =
    normalized.split(/(?:\.\s+|\s+[—–]\s+)/)[0]?.replace(/[.;\s]+$/, "") ||
    normalized;
  if (clause.length <= MAX_SUBTITLE_TEXT_LENGTH) return clause;
  const cut = clause.slice(0, MAX_SUBTITLE_TEXT_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  const head = (lastSpace > 8 ? cut.slice(0, lastSpace) : cut).replace(
    /[\s,;:]+$/,
    "",
  );
  return `${head}…`;
};

const flattenSpeechBubbleMarkdown = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, " [code] ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clampSpeechBubbleText = (value: string) => {
  if (value.length <= MAX_SPEECH_BUBBLE_TEXT_LENGTH) {
    return { text: value, truncated: false };
  }
  const slice = value.slice(0, MAX_SPEECH_BUBBLE_TEXT_LENGTH - 1).trimEnd();
  return { text: `${slice}…`, truncated: true };
};

export const AgentModel = memo(function AgentModel({
  agentId,
  name,
  subtitle,
  status,
  color,
  agentsRef,
  agentLookupRef,
  onHover,
  onUnhover,
  onClick,
  onContextMenu,
  showSpeech = false,
  speechText = null,
  suppressSpeechBubble = false,
  huddleSeatIndex = null,
  isHovered = false,
}: AgentModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const statusDotMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);
  const pulseRingMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const speechBubbleRef = useRef<THREE.Group>(null);
  const speechBubbleMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const awayBubbleRef = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const [robotClip, setRobotClip] = useState<RobotClipKey>("idle");
  const robotClipRef = useRef<RobotClipKey>("idle");
  const [isAway, setIsAway] = useState(false);

  useFrame(() => {
    const agent =
      agentLookupRef?.current?.get(agentId) ??
      agentsRef.current?.find((candidate) => candidate.id === agentId);
    if (!agent || !groupRef.current) return;

    const [wx, , wz] = toWorld(agent.x, agent.y);
    pos.current.set(wx, 0, wz);
    groupRef.current.position.lerp(pos.current, 0.15);

    const targetY = agent.facing;
    let rotDelta = targetY - groupRef.current.rotation.y;
    while (rotDelta > Math.PI) rotDelta -= Math.PI * 2;
    while (rotDelta < -Math.PI) rotDelta += Math.PI * 2;
    groupRef.current.rotation.y += rotDelta * 0.12;
    const isWorkout = agent.state === "working_out";
    const isDancing = agent.state === "dancing";
    const isJanitor = "role" in agent && agent.role === "janitor";
    const workoutStyle = agent.workoutStyle ?? "lift";
    const frameValue = agent.frame + (agent.phaseOffset ?? 0) / WALK_ANIM_SPEED;
    const workoutPhase = Math.sin(
      agent.frame * 0.18 + (agent.phaseOffset ?? 0),
    );
    groupRef.current.rotation.z = 0;
    groupRef.current.rotation.x =
      agent.state === "sitting"
        ? 0
        : isDancing
          ? Math.sin(agent.frame * 0.18 + (agent.phaseOffset ?? 0)) * 0.06
          : isWorkout
            ? workoutStyle === "bike"
              ? 0.18
              : workoutStyle === "row"
                ? -0.12 + Math.max(0, workoutPhase) * 0.08
                : workoutStyle === "stretch"
                  ? -0.08
                  : workoutStyle === "run"
                    ? 0.08
                    : workoutStyle === "box"
                      ? 0.04
                      : 0.02
            : agent.pingPongUntil
              ? 0.08
              : 0;
    const bounce =
      agent.state === "walking"
        ? Math.sin(frameValue * WALK_ANIM_SPEED) * 0.04
        : isDancing
          ? 0.03 +
            Math.abs(Math.sin(agent.frame * 0.22 + (agent.phaseOffset ?? 0))) *
              0.05
          : isWorkout
            ? workoutStyle === "stretch"
              ? 0.012 + Math.abs(workoutPhase) * 0.018
              : workoutStyle === "row"
                ? 0.015 + Math.abs(workoutPhase) * 0.028
                : 0.02 + Math.abs(workoutPhase) * 0.04
            : 0;
    const breathe =
      agent.state === "standing" || isWorkout || agent.pingPongUntil
        ? Math.sin(frameValue * 0.03) * 0.01
        : 0;
    groupRef.current.position.y = bounce + breathe;

    // Drive the robot's real skeletal animation clips off the same state
    // machine that used to swing the procedural limb refs above — one clip
    // per agent.state/behavior flag, closest visual match from the pack's
    // built-in set (see RobotAgentModel.tsx).
    const nextClip: RobotClipKey =
      agent.state === "walking"
        ? "walking"
        : agent.state === "sitting"
          ? "sitting"
          : isDancing
            ? "dance"
            : isWorkout || agent.pingPongUntil || isJanitor
              ? "running"
              : agent.state === "standing"
                ? "standing"
                : "idle";
    if (robotClipRef.current !== nextClip) {
      robotClipRef.current = nextClip;
      setRobotClip(nextClip);
    }

    const working =
      agent.state === "sitting" ||
      isWorkout ||
      isDancing ||
      agent.status === "working";
    const isError = agent.status === "error";
    const isAway = agent.state === "away";

    if (statusDotMatRef.current) {
      statusDotMatRef.current.color.set(
        isError ? "#ef4444" : working ? "#22c55e" : "#f59e0b",
      );
    }

    if (pulseRingRef.current && pulseRingMatRef.current) {
      if (working || isError) {
        const pulse = (Math.sin(agent.frame * 0.05) + 1) / 2;
        const scale = isError ? 1.25 + pulse * 0.55 : 1.2 + pulse * 0.8;
        pulseRingRef.current.scale.setScalar(scale);
        pulseRingMatRef.current.color.set(isError ? "#ef4444" : "#22c55e");
        pulseRingMatRef.current.opacity = isError
          ? 0.7 - pulse * 0.3
          : 0.55 - pulse * 0.45;
        pulseRingRef.current.visible = true;
      } else {
        pulseRingRef.current.visible = false;
      }
    }

    if (awayBubbleRef.current) awayBubbleRef.current.visible = isAway;
    setIsAway((prev) => (prev === isAway ? prev : isAway));

    const blinkSeed = agentId
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);

    const ambientBubbleVisible =
      (!suppressSpeechBubble && isError) ||
      (!isAway &&
        !suppressSpeechBubble &&
        !working &&
        !isError &&
        agent.state === "standing" &&
        (agent.frame + blinkSeed * 11) % 320 < 42);
    const bumpTalking = (agent.bumpTalkUntil ?? 0) > Date.now();
    // In a huddle the bubbles are close enough to overlap into an unreadable
    // stack, so the rotating talk pulse owns the ambient "..." bubble. The
    // scene grants one real speaking turn at a time, and that speaker is never
    // competing with another bubble — it always shows.
    const waitingForTurnInHuddle =
      agent.conversationGroupId !== undefined &&
      agent.state === "standing" &&
      !bumpTalking &&
      !showSpeech;

    if (speechBubbleRef.current) {
      const bubbleVisible =
        !suppressSpeechBubble &&
        !waitingForTurnInHuddle &&
        (showSpeech || bumpTalking || ambientBubbleVisible);
      speechBubbleRef.current.visible = bubbleVisible;
      if (bubbleVisible) {
        if (showSpeech && speechText?.trim()) {
          speechBubbleRef.current.scale.setScalar(1);
        } else {
          const pulseBase = isError
            ? 1.06
            : showSpeech || bumpTalking
              ? 1.03
              : 0.98;
          const pulse =
            pulseBase + Math.sin(agent.frame * (isError ? 0.18 : 0.12)) * 0.06;
          speechBubbleRef.current.scale.setScalar(pulse);
        }
      }
    }

    if (speechBubbleMatRef.current) {
      speechBubbleMatRef.current.color.set(
        isError ? "#3a1016" : working ? "#1d2a17" : "#1a2030",
      );
      speechBubbleMatRef.current.opacity = isError ? 0.97 : 0.92;
    }

  });

  const resolvedSpeechText =
    showSpeech && speechText?.trim()
      ? speechText.trim()
      : status === "error"
        ? "error"
        : "...";
  const activeSpeechBubble = showSpeech && Boolean(speechText?.trim());
  const normalizedSpeechBubbleText = activeSpeechBubble
    ? flattenSpeechBubbleMarkdown(resolvedSpeechText)
    : resolvedSpeechText;
  const speechBubblePreview = activeSpeechBubble
    ? clampSpeechBubbleText(normalizedSpeechBubbleText)
    : { text: normalizedSpeechBubbleText, truncated: false };
  const speechBubbleDisplayText = speechBubblePreview.text;
  const speechBubbleWasTruncated = speechBubblePreview.truncated;
  const speechBubbleTextLength = speechBubbleDisplayText.length;
  const speechBubbleWidth = activeSpeechBubble
    ? Math.min(4.6, Math.max(1.8, 1.55 + speechBubbleTextLength * 0.018))
    : 0.36;
  const speechBubblePaddingX = activeSpeechBubble ? 0.34 : 0.06;
  const speechBubblePaddingY = activeSpeechBubble ? 0.3 : 0.06;
  const speechBubbleMaxWidth = Math.max(
    0.24,
    speechBubbleWidth - speechBubblePaddingX,
  );
  const estimatedSpeechCharsPerLine = activeSpeechBubble
    ? Math.max(10, Math.floor(speechBubbleMaxWidth * 7))
    : 8;
  const estimatedSpeechLines = activeSpeechBubble
    ? Math.max(
        1,
        Math.min(
          MAX_SPEECH_BUBBLE_LINES,
          Math.ceil(speechBubbleTextLength / estimatedSpeechCharsPerLine),
        ),
      )
    : 1;
  const speechBubbleHeight = activeSpeechBubble
    ? Math.max(0.72, estimatedSpeechLines * 0.26 + speechBubblePaddingY)
    : 0.2;
  const speechBubbleFontSize = activeSpeechBubble
    ? speechBubbleTextLength > 110
      ? 0.188
      : speechBubbleTextLength > 70
        ? 0.2
        : 0.216
    : 0.13;
  const speechBubbleTextColor = activeSpeechBubble
    ? "#f8fafc"
    : status === "error"
      ? "#ff9aa5"
      : status === "working"
        ? "#b9f99d"
        : "#a0c8ff";
  const speechBubbleBorderColor = activeSpeechBubble
    ? status === "error"
      ? "#ff7f93"
      : status === "working"
        ? "#93f57d"
        : "#8dc4ff"
    : "transparent";
  const speechBubbleBorderInset = activeSpeechBubble ? 0.03 : 0;
  const nameplateText = name ? formatAgentNameplateText(name) : "";
  // A huddle packs four plates into roughly one plate's worth of screen space.
  // Drop the role line there and step each seat's plate to its own height so
  // the names read as a list instead of a pile.
  const inHuddle = huddleSeatIndex !== null;
  const subtitleText =
    !inHuddle && typeof subtitle === "string"
      ? formatAgentSubtitleText(subtitle)
      : "";
  // Both the height and the Billboard's own scale (below) were tuned for
  // the old ~0.6-unit-tall procedural body. The robot model is much
  // smaller (see RobotAgentModel's ROBOT_BASE_SCALE), so the nameplate now
  // sits much closer to the head and renders at roughly half its old size
  // — otherwise it reads as a giant sign floating over a tiny character.
  const nameplateHeight =
    0.5 + (inHuddle ? ((huddleSeatIndex ?? 0) % 4) * 0.08 : 0);
  const nameplateFontSize =
    nameplateText.length > 9 ? 0.118 : nameplateText.length > 7 ? 0.13 : 0.144;

  return (
    <group
      ref={groupRef}
      scale={[AGENT_SCALE, AGENT_SCALE, AGENT_SCALE]}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover?.(agentId);
      }}
      onPointerOut={() => onUnhover?.()}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(agentId);
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        const nativeEvent = event.nativeEvent as MouseEvent;
        onContextMenu?.(agentId, nativeEvent.clientX, nativeEvent.clientY);
      }}
    >
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.12, 12]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} />
      </mesh>
      <group position={[0, robotClip === "sitting" ? 0.22 : 0, 0]}>
        <RobotAgentModel clip={robotClip} color={color} isAway={isAway} />
      </group>
      <mesh
        ref={pulseRingRef}
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.13, 0.19, 24]} />
        <meshBasicMaterial
          ref={pulseRingMatRef}
          color="#22c55e"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
      {!activeSpeechBubble && nameplateText && !isHovered ? (
        // Default, non-hovered state: a single small colored dot — no text,
        // so a room full of agents never turns into a wall of overlapping
        // nameplates. Full details appear on hover (see below).
        <Billboard position={[0, nameplateHeight, 0]}>
          <mesh>
            <circleGeometry args={[0.045, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={[0, 0, -0.001]}>
            <circleGeometry args={[0.06, 16]} />
            <meshBasicMaterial color="#080c14" transparent opacity={0.55} />
          </mesh>
        </Billboard>
      ) : null}
      {!activeSpeechBubble && nameplateText && isHovered ? (
        <Billboard position={[0, nameplateHeight, 0]} scale={0.45}>
          <mesh position={[0, 0, -0.001]}>
            <planeGeometry args={[0.82, subtitleText ? 0.34 : 0.24]} />
            <meshBasicMaterial color="#080c14" transparent opacity={0.9} />
          </mesh>
          <mesh position={[-0.392, 0, 0]}>
            <planeGeometry args={[0.028, subtitleText ? 0.34 : 0.24]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={[0.355, subtitleText ? 0.05 : 0, 0]}>
            <circleGeometry args={[0.052, 14]} />
            <meshBasicMaterial ref={statusDotMatRef} color="#ef4444" />
          </mesh>
          <Text
            position={[-0.02, subtitleText ? 0.05 : 0, 0.001]}
            fontSize={nameplateFontSize}
            color="#e8dfc0"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.68}
            font={undefined}
          >
            {nameplateText}
          </Text>
          {subtitleText ? (
            <Text
              position={[-0.02, -0.085, 0.001]}
              fontSize={0.062}
              color="#8ab4ff"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.68}
              font={undefined}
            >
              {subtitleText}
            </Text>
          ) : null}
        </Billboard>
      ) : null}
      <group ref={awayBubbleRef} visible={false}>
        <Billboard position={[0, 1.3, 0]}>
          <mesh position={[0, 0, -0.001]}>
            <planeGeometry args={[0.32, 0.18]} />
            <meshBasicMaterial color="#0d1015" transparent opacity={0.85} />
          </mesh>
          <Text
            position={[0, 0, 0.001]}
            fontSize={0.11}
            color="#6080b0"
            anchorX="center"
            anchorY="middle"
          >
            z z z
          </Text>
        </Billboard>
      </group>
      <group ref={speechBubbleRef} visible={false}>
        <Billboard position={[0, 1.45, 0]}>
          {activeSpeechBubble ? (
            <mesh
              position={[-speechBubbleWidth * 0.18, -speechBubbleHeight * 0.53, -0.0005]}
              rotation={[0, 0, Math.PI / 4]}
              renderOrder={99997}
            >
              <planeGeometry args={[0.22, 0.22]} />
              <meshBasicMaterial
                color="#1a2030"
                transparent
                opacity={0.82}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          ) : null}
          {activeSpeechBubble ? (
            <mesh position={[0, 0, -0.0015]} renderOrder={99998}>
              <planeGeometry
                args={[
                  speechBubbleWidth + speechBubbleBorderInset,
                  speechBubbleHeight + speechBubbleBorderInset,
                ]}
              />
              <meshBasicMaterial
                color={speechBubbleBorderColor}
                transparent
                opacity={0.88}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          ) : null}
          <mesh position={[0, 0, -0.001]} renderOrder={99999}>
            <planeGeometry args={[speechBubbleWidth, speechBubbleHeight]} />
            <meshBasicMaterial
              ref={speechBubbleMatRef}
              color="#1a2030"
              transparent
              opacity={activeSpeechBubble ? 0.76 : 0.92}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
          <Text
            position={
              activeSpeechBubble
                ? [-speechBubbleWidth / 2 + speechBubblePaddingX / 2, 0, 0.001]
                : [0, 0, 0.001]
            }
            fontSize={speechBubbleFontSize}
            color={speechBubbleTextColor}
            anchorX={activeSpeechBubble ? "left" : "center"}
            anchorY="middle"
            maxWidth={speechBubbleMaxWidth}
            textAlign={activeSpeechBubble ? "left" : "center"}
            lineHeight={1.1}
            renderOrder={100000}
            depthOffset={-10}
            material-depthTest={false}
            material-depthWrite={false}
          >
            {speechBubbleDisplayText}
          </Text>
          {activeSpeechBubble && speechBubbleWasTruncated ? (
            <Text
              position={[0, -speechBubbleHeight * 0.34, 0.001]}
              fontSize={0.09}
              color="#8ab4ff"
              anchorX="center"
              anchorY="middle"
              maxWidth={speechBubbleMaxWidth}
              textAlign="center"
              renderOrder={100001}
              depthOffset={-10}
              material-depthTest={false}
              material-depthWrite={false}
            >
              click for full chat
            </Text>
          ) : null}
        </Billboard>
      </group>
    </group>
  );
});

AgentModel.displayName = "AgentModel";
