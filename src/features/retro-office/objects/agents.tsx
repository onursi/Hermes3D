import { Billboard, Text } from "@react-three/drei";
import { activeLiftSuction as liftState } from "@/features/retro-office/core/liftState";
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

// Lives in core/liftState so the furniture can read it without importing the
// whole cast of agents. Re-exported here because callers already import it
// from this module.
export { activeLiftSuction } from "@/features/retro-office/core/liftState";

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
  const [isSeated, setIsSeated] = useState(false);
  const isSeatedRef = useRef(false);
  const [workstationActivity, setWorkstationActivity] = useState<string | null>(null);
  const workstationActivityRef = useRef<string | null>(null);
  const [isHoveredLocal, setIsHoveredLocal] = useState(false);
  const effectiveHovered = isHovered || isHoveredLocal;
  const isSubLevel = Boolean(
    workstationActivity &&
    (workstationActivity.startsWith("war_room") || workstationActivity.includes("dev_desk"))
  );

  useFrame(() => {
    const agent =
      agentLookupRef?.current?.get(agentId) ??
      agentsRef.current?.find((candidate) => candidate.id === agentId);
    if (!agent || !groupRef.current) return;

    const [wx, , wz] = toWorld(agent.x, agent.y);
    const isMoving = agent.state === "walking";
    // Futuristic Anti-Gravity Hover: Robot glides smoothly 12cm above floor
    const hoverY = isMoving
      ? 0.12 + Math.sin(agent.frame * 0.26 + (agent.phaseOffset ?? 0)) * 0.022
      : 0;
    const isSubLevel = Boolean(
      agent.workstationActivity &&
      (agent.workstationActivity.startsWith("war_room") ||
       agent.workstationActivity.includes("dev_desk"))
    );
    const floorY = isSubLevel ? -5.2 : 0;
    const isUnderSuction = liftState.agentId === agent.id;
    if (isUnderSuction) {
      // Eased in: the tunnel takes hold rather than snatching.
      const elapsed = performance.now() - liftState.startedAt;
      const progress = Math.min(1, elapsed / liftState.durationMs);
      const eased = progress * progress;
      liftState.currentY =
        liftState.fromY + (liftState.toY - liftState.fromY) * eased;
      if (progress >= 1) {
        const arrive = liftState.onArrive;
        liftState.agentId = null;
        liftState.onArrive = null;
        arrive?.();
      }
    }
    const targetYPos = isUnderSuction
      ? liftState.currentY
      : agent.verticalSuctionY !== undefined
      ? agent.verticalSuctionY
      : agent.state === "sitting"
      ? 0.09
      : floorY + hoverY;

    if (isUnderSuction) {
      pos.current.set(-11.7, targetYPos, -16.2);
      groupRef.current.position.lerp(pos.current, 0.85);
      groupRef.current.rotation.y += 0.25;
    } else {
      pos.current.set(wx, targetYPos, wz);
      const lerpRate = agent.verticalSuctionY !== undefined ? 0.9 : isMoving ? 0.35 : 0.24;
      groupRef.current.position.lerp(pos.current, lerpRate);
    }

    const targetY = agent.facing;
    let rotDelta = targetY - groupRef.current.rotation.y;
    while (rotDelta > Math.PI) rotDelta -= Math.PI * 2;
    while (rotDelta < -Math.PI) rotDelta += Math.PI * 2;
    groupRef.current.rotation.y += rotDelta * 0.28;
    const isWorkout = agent.state === "working_out";
    const isDancing = agent.state === "dancing";
    const isJanitor = "role" in agent && agent.role === "janitor";
    const workoutStyle = agent.workoutStyle ?? "lift";
    const frameValue = agent.frame + (agent.phaseOffset ?? 0) / WALK_ANIM_SPEED;
    const workoutPhase = Math.sin(
      agent.frame * 0.18 + (agent.phaseOffset ?? 0),
    );
    // Smooth aerodynamic banking into curves when hovering
    groupRef.current.rotation.z = isMoving
      ? THREE.MathUtils.clamp(-rotDelta * 0.25, -0.15, 0.15)
      : 0;
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
      agent.state === "sitting"
        ? 0.09
        : isMoving
          ? 0.12 + Math.sin(agent.frame * 0.26 + (agent.phaseOffset ?? 0)) * 0.022
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

    // Glowing anti-gravity thruster pulse ring on the floor beneath hovering bot
    if (pulseRingRef.current) {
      pulseRingRef.current.visible = isMoving;
      if (isMoving) {
        pulseRingRef.current.position.y = -(bounce + breathe) + 0.005;
        const ringScale = 1.05 + Math.sin(agent.frame * 0.3) * 0.12;
        pulseRingRef.current.scale.set(ringScale, ringScale, ringScale);
      }
    }

    // Check for user-triggered gestures (wave, thumbsUp, dance, jump)
    const activeGesture =
      agent.gestureClip && agent.gestureUntil && performance.now() < agent.gestureUntil
        ? agent.gestureClip
        : null;

    // Drive the robot's real skeletal animation clips (standing poise for sleek hover gliding)
    const nextClip: RobotClipKey =
      activeGesture ??
      (agent.state === "walking"
        ? "standing"
        : agent.state === "sitting"
          ? "sitting"
          : isDancing
            ? "dance"
            : isWorkout || agent.pingPongUntil || isJanitor
              ? "running"
              : agent.state === "standing"
                ? "standing"
                : "idle");
    if (robotClipRef.current !== nextClip) {
      robotClipRef.current = nextClip;
      setRobotClip(nextClip);
    }

    if (agent.workstationActivity !== workstationActivityRef.current) {
      workstationActivityRef.current = agent.workstationActivity ?? null;
      setWorkstationActivity(agent.workstationActivity ?? null);
    }

    const working =
      agent.state === "sitting" ||
      isWorkout ||
      isDancing ||
      Boolean(agent.workstationActivity) ||
      agent.status === "working";
    const isError = agent.status === "error";
    const isAway = agent.state === "away";
    const seated = agent.state === "sitting";

    if (seated !== isSeatedRef.current) {
      isSeatedRef.current = seated;
      setIsSeated(seated);
    }

    if (statusDotMatRef.current) {
      statusDotMatRef.current.color.set(
        isError ? "#ef4444" : working ? "#22c55e" : "#f59e0b",
      );
    }

    const isSpeaking = Boolean(showSpeech || (agent.bumpTalkUntil ?? 0) > Date.now());

    if (pulseRingRef.current && pulseRingMatRef.current) {
      if (isSpeaking || working || isError) {
        const pulse = (Math.sin(agent.frame * 0.08) + 1) / 2;
        const scale = isSpeaking ? 1.35 + pulse * 0.45 : isError ? 1.25 + pulse * 0.55 : 1.2 + pulse * 0.8;
        pulseRingRef.current.scale.setScalar(scale);
        pulseRingMatRef.current.color.set(isSpeaking ? "#00f0ff" : isError ? "#ef4444" : "#22c55e");
        pulseRingMatRef.current.opacity = isSpeaking
          ? 0.85 - pulse * 0.35
          : isError
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
    ? Math.min(1.45, Math.max(0.75, 0.45 + speechBubbleTextLength * 0.012))
    : 0.22;
  const speechBubblePaddingX = activeSpeechBubble ? 0.12 : 0.04;
  const speechBubblePaddingY = activeSpeechBubble ? 0.08 : 0.04;
  const speechBubbleMaxWidth = Math.max(
    0.2,
    speechBubbleWidth - speechBubblePaddingX,
  );
  const estimatedSpeechCharsPerLine = activeSpeechBubble
    ? Math.max(12, Math.floor(speechBubbleMaxWidth * 14))
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
    ? Math.max(0.26, estimatedSpeechLines * 0.085 + speechBubblePaddingY)
    : 0.14;
  const speechBubbleFontSize = activeSpeechBubble
    ? speechBubbleTextLength > 110
      ? 0.062
      : speechBubbleTextLength > 70
        ? 0.068
        : 0.076
    : 0.055;
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
    : "#8dc4ff";
  // Not "transparent": three.js has no such colour and warns on every frame
  // for every agent, which is where the console flood came from. A border
  // that should not be seen is a border at zero opacity, not one painted
  // in a colour that does not exist.
  const speechBubbleBorderOpacity = activeSpeechBubble ? 1 : 0;
  const speechBubbleBorderInset = activeSpeechBubble ? 0.03 : 0;
  const isBoss = agentId.toLowerCase().includes("hermes") || (name?.toLowerCase().includes("hermes") ?? false);
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
  const lowerBrand = (agentId + " " + (name ?? "")).toLowerCase();
  const brandInfo = lowerBrand.includes("hermes")
    ? { icon: "👑", tag: "HERMES", color: "#f59e0b" }
    : lowerBrand.includes("claude") || lowerBrand.includes("anthropic")
      ? { icon: "✳", tag: "ANTHROPIC", color: "#ea580c" }
      : lowerBrand.includes("chatgpt") || lowerBrand.includes("gpt") || lowerBrand === "default"
        ? { icon: "🌀", tag: "OPENAI", color: "#2563eb" }
        : lowerBrand.includes("gemini") || lowerBrand.includes("google")
          ? { icon: "✦", tag: "GOOGLE", color: "#eab308" }
          : lowerBrand.includes("deepseek")
            ? { icon: "🐳", tag: "DEEPSEEK", color: "#a855f7" }
            : { icon: "🤖", tag: "AI", color: "#64748b" };

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
        setIsHoveredLocal(true);
        onHover?.(agentId);
      }}
      onPointerOut={() => {
        setIsHoveredLocal(false);
        onUnhover?.();
      }}
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
      {/* Invisible enlarged hit cylinder for effortless clicking & dragging */}
      <mesh position={[0, 0.45, 0]} visible={false}>
        <cylinderGeometry args={[0.36, 0.36, 0.9, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {/* Ground Contact Cyber Shadow Puck */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} />
      </mesh>
      <group position={[0, 0, 0]}>
        <RobotAgentModel
          clip={robotClip}
          color={isBoss ? "#f59e0b" : brandInfo.color}
          isAway={isAway}
          agentId={agentId}
          name={name}
          isBoss={isBoss}
          isWorking={status === "working" || Boolean(workstationActivity)}
          status={status}
          workstationActivity={workstationActivity ?? undefined}
        />
      </group>

      {/* Dynamic Anti-Gravity Tube Tractor Suction Beam & Warp Rings */}
      {groupRef.current && groupRef.current.position.y > -5.0 && groupRef.current.position.y < -0.15 && (
        <group position={[0, 0.45, 0]}>
          {/* Luminous suction vortex sheath */}
          <mesh>
            <cylinderGeometry args={[0.34, 0.42, 1.1, 16, 1, true]} />
            <meshBasicMaterial
              color="#00f0ff"
              transparent
              opacity={0.65}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Concentric high-speed energy rings */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.30, 0.42, 24]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.32, 24]} />
            <meshBasicMaterial
              color={isBoss ? "#fbbf24" : brandInfo.color}
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      <mesh
        ref={pulseRingRef}
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={status === "working" || status === "error" || effectiveHovered}
      >
        <ringGeometry args={[0.22, 0.32, 32]} />
        <meshBasicMaterial
          color={status === "error" ? "#ef4444" : status === "working" ? "#22c55e" : (isBoss ? "#fbbf24" : brandInfo.color)}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating Holographic Brand Emblem & Live Activity Badge */}
      {name ? (
        <Billboard position={[0, 0.65 + (inHuddle ? ((huddleSeatIndex ?? 0) % 4) * 0.05 : 0), 0]}>
          {/* 1. Floating Brand Logo / Icon */}
          <Text
            position={[0, (effectiveHovered || status === "working" || status === "error") ? 0.075 : 0, 0.002]}
            fontSize={isBoss ? 0.096 : 0.082}
            color={status === "error" ? "#f87171" : status === "working" ? "#4ade80" : (isBoss ? "#fef08a" : brandInfo.color)}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.004}
            outlineColor="#000000"
          >
            {brandInfo.icon}
          </Text>

          {/* 2. Micro Status Capsule — Permanent bei Arbeit/Fehler, sonst bei Hover */}
          {(effectiveHovered || status === "working" || status === "error") && (
            <group position={[0, -0.012, 0]}>
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[Math.max(0.28, nameplateText.length * 0.024 + 0.12), 0.058]} />
                <meshBasicMaterial
                  color="#030814"
                  transparent
                  opacity={0.92}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <lineSegments position={[0, 0, 0.001]}>
                <edgesGeometry
                  args={[
                    new THREE.PlaneGeometry(
                      Math.max(0.28, nameplateText.length * 0.024 + 0.12),
                      0.058,
                    ),
                  ]}
                />
                <lineBasicMaterial
                  color={status === "error" ? "#ef4444" : status === "working" ? "#22c55e" : (isBoss ? "#fbbf24" : brandInfo.color)}
                  transparent
                  opacity={0.85}
                />
              </lineSegments>

              {/* Status Dot */}
              <mesh position={[-Math.max(0.28, nameplateText.length * 0.024 + 0.12) / 2 + 0.022, 0, 0.002]}>
                <circleGeometry args={[0.011, 16]} />
                <meshBasicMaterial color={status === "error" ? "#ef4444" : status === "working" ? "#22c55e" : "#f59e0b"} />
              </mesh>

              {/* Agent Name + Status Tag */}
              <Text
                position={[0.01, 0, 0.003]}
                fontSize={0.038}
                color={status === "error" ? "#fca5a5" : status === "working" ? "#86efac" : "#ffffff"}
                anchorX="center"
                anchorY="middle"
                letterSpacing={0.05}
                outlineWidth={0.0015}
                outlineColor="#000000"
              >
                {status === "working"
                  ? `${nameplateText} • AKTIV`
                  : status === "error"
                    ? `${nameplateText} • FEHLER`
                    : (isBoss ? "HERMES" : nameplateText.toUpperCase())}
              </Text>
            </group>
          )}
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
        <Billboard position={[0, 0.95, 0]}>
          {/* Futuristic Cyber Speech Capsule */}
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[speechBubbleWidth, speechBubbleHeight]} />
            <meshBasicMaterial
              ref={speechBubbleMatRef}
              color="#030814"
              transparent
              opacity={0.88}
              side={THREE.DoubleSide}
            />
          </mesh>
          <lineSegments position={[0, 0, 0.001]}>
            <edgesGeometry args={[new THREE.PlaneGeometry(speechBubbleWidth, speechBubbleHeight)]} />
            <lineBasicMaterial
              color={speechBubbleBorderColor}
              transparent
              opacity={0.75 * speechBubbleBorderOpacity}
            />
          </lineSegments>
          {/* Subtle micro emitter ray down to logo */}
          <mesh position={[0, -speechBubbleHeight / 2 - 0.04, 0]}>
            <cylinderGeometry args={[0.002, 0.008, 0.08, 8]} />
            <meshBasicMaterial
              color={speechBubbleBorderColor}
              transparent
              opacity={0.35 * speechBubbleBorderOpacity}
            />
          </mesh>
          <Text
            position={
              activeSpeechBubble
                ? [-speechBubbleWidth / 2 + speechBubblePaddingX / 2, 0, 0.002]
                : [0, 0, 0.002]
            }
            fontSize={speechBubbleFontSize}
            color={speechBubbleTextColor}
            anchorX={activeSpeechBubble ? "left" : "center"}
            anchorY="middle"
            maxWidth={speechBubbleMaxWidth}
            textAlign={activeSpeechBubble ? "left" : "center"}
            lineHeight={1.15}
          >
            {speechBubbleDisplayText}
          </Text>
        </Billboard>
      </group>
    </group>
  );
});

AgentModel.displayName = "AgentModel";
