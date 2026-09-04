"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

/**
 * Real, rigged, CC0-licensed robot character (Quaternius "Animated Robot"
 * pack — https://quaternius.com, public domain) replacing the old
 * hand-built box-primitive humanoid in agents.tsx. Ships with a full
 * skeletal animation set we drive from AgentModel's existing state machine,
 * instead of faking limb swing with per-frame rotation math on primitive
 * meshes.
 */
/** Seconds between face repaints. Twenty per second reads as continuous. */
const VISOR_REDRAW_INTERVAL = 0.05;

const ROBOT_GLB_PATH = "/office-assets/models/agents/robot.glb";
const CLIP_PREFIX = "RobotArmature|Robot_";

// Every clip actually present in the pack, named as exported by
// FBX2glTF (kept as the armature-qualified name it ships with).
export type RobotClipKey =
  | "idle"
  | "standing"
  | "walking"
  | "running"
  | "sitting"
  | "dance"
  | "wave"
  | "thumbsUp"
  | "jump";

const CLIP_NAME: Record<RobotClipKey, string> = {
  idle: `${CLIP_PREFIX}Idle`,
  standing: `${CLIP_PREFIX}Standing`,
  walking: `${CLIP_PREFIX}Walking`,
  running: `${CLIP_PREFIX}Running`,
  sitting: `${CLIP_PREFIX}Sitting`,
  dance: `${CLIP_PREFIX}Dance`,
  wave: `${CLIP_PREFIX}Wave`,
  thumbsUp: `${CLIP_PREFIX}ThumbsUp`,
  jump: `${CLIP_PREFIX}Jump`,
};

// Model ships ~1.85 world-units tall (standard Quaternius/Mixamo-ish rig
// scale). AgentModel's outer group already applies AGENT_SCALE on top of
// this — this constant just brings the robot down to the same apparent
// height the old procedural body rendered at, so seat/desk/table contact
// points don't need to move.
const ROBOT_BASE_SCALE = 0.11;

export function RobotAgentModel({
  clip,
  color,
  isAway,
  agentId,
  name,
  isBoss,
  isWorking,
  workstationActivity,
}: {
  clip: RobotClipKey;
  /** Per-agent identity accent — tints the robot's chest/visor emissive. */
  color?: string;
  isAway?: boolean;
  agentId?: string;
  name?: string;
  isBoss?: boolean;
  isWorking?: boolean;
  workstationActivity?: string;
}) {
  const { scene, animations } = useGLTF(ROBOT_GLB_PATH);
  // useGLTF caches and returns the SAME scene graph to every instance;
  // cloning naively (Object3D.clone) drops the skeleton binding, so every
  // agent would end up sharing (and fighting over) one skeleton. SkeletonUtils
  // clones bones + skinned meshes correctly, matching the pattern threejs'
  // own multi-instance-of-a-rigged-character examples use — but it does NOT
  // clone materials, so every cloned mesh still points at the exact same
  // material objects as every other instance (and the cached source scene).
  // Tinting `material.emissive` below used to mutate that one shared
  // material, so whichever agent rendered/re-rendered last silently
  // recolored every robot in the room to the same color. Cloning each
  // mesh's material right after the skeleton clone gives every instance its
  // own material to tint independently.
  const cloned = useMemo(() => {
    const next = SkeletonUtils.clone(scene) as THREE.Group;
    next.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((mat) => mat.clone())
        : (mesh.material as THREE.Material).clone();
    });
    return next;
  }, [scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, cloned);
  const currentClipRef = useRef<RobotClipKey | null>(null);

  /**
   * Last time this robot repainted its face, offset per robot so a roomful of
   * them do not all repaint on the same frame. Seeded from the agent's colour
   * so the stagger is stable across reloads rather than random each mount.
   */
  const visorLastDrawRef = useRef(
    -((Array.from(color ?? "x").reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) | 0, 7) >>> 0) % 50) /
      50 *
      VISOR_REDRAW_INTERVAL,
  );

  // Build dynamic high-contrast Cyberpunk OLED Face Screen Texture
  const visorCanvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    return c;
  }, []);

  const visorTexture = useMemo(() => {
    if (!visorCanvas) return null;
    const tex = new THREE.CanvasTexture(visorCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [visorCanvas]);

  const visorCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    if (visorCanvas) visorCtxRef.current = visorCanvas.getContext("2d");
  }, [visorCanvas]);

  // Attach high-tech Cyber Screen Visor with glowing digital eyes and mouth to the Head
  useEffect(() => {
    let targetParent: THREE.Object3D | undefined;
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name === "Head_4") {
        targetParent = child;
      }
    });
    if (!targetParent) {
      cloned.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && child.name.toLowerCase().includes("head")) {
          targetParent = child;
        }
      });
    }
    if (!targetParent) {
      cloned.traverse((child) => {
        if ((child as THREE.Bone).isBone && child.name.toLowerCase().includes("head")) {
          targetParent = child;
        }
      });
    }

    if (targetParent && !targetParent.getObjectByName("CyberVisorPlate")) {
      const visorGeo = new THREE.PlaneGeometry(0.016, 0.008);
      const visorMat = new THREE.MeshBasicMaterial({
        map: visorTexture ?? undefined,
        transparent: true,
        opacity: 0.98,
        side: THREE.DoubleSide,
      });
      const visorPlate = new THREE.Mesh(visorGeo, visorMat);
      visorPlate.name = "CyberVisorPlate";
      // Positioned squarely and frontally on the face at eye height, facing forward (+Z in world)
      visorPlate.position.set(0.00018, -0.01387, 0.00017);
      visorPlate.rotation.set(1.63, 0.038, -0.049);
      targetParent.add(visorPlate);
    }

    // Set the robot's black visor surface to a sleek, glossy dark cyber visor backing
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.name.toLowerCase().includes("head")) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const standard = mat as THREE.MeshStandardMaterial;
        if (standard && standard.name.toLowerCase().includes("black")) {
          standard.map = null;
          standard.color.set("#040810");
          standard.emissive.set("#000814");
          standard.emissiveIntensity = 0.4;
          standard.roughness = 0.12;
          standard.metalness = 0.92;
          standard.needsUpdate = true;
        }
      });
    });
  }, [cloned, visorTexture]);

  // Animated expressive face loop (blinking, eye tracking, smile pulse, scanlines)
  useFrame(({ clock }) => {
    const ctx = visorCtxRef.current;
    if (!ctx || !visorCanvas || !visorTexture) return;
    const t = clock.getElapsedTime();

    // Every robot repainted its face on every frame — eight Canvas2D redraws
    // and eight 128 KB uploads per frame, all in the same instant. A face
    // blinks and glances; it does not need sixty updates a second. Twenty is
    // indistinguishable, and the per-robot offset spreads the remaining work
    // across frames instead of spiking one.
    if (t - visorLastDrawRef.current < VISOR_REDRAW_INTERVAL) return;
    visorLastDrawRef.current = t;

    ctx.clearRect(0, 0, 256, 128);

    // 1. OLED Deep Dark Glass Backing & Tech Grid Pattern
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, 256, 128);

    const themeColor = isBoss ? "#fbbf24" : (color || "#00f0ff");

    // Subtly visible digital dot matrix grid in background
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    for (let gx = 8; gx < 256; gx += 16) {
      for (let gy = 8; gy < 128; gy += 16) {
        ctx.fillRect(gx, gy, 2, 2);
      }
    }

    // 2. High-Tech Cyber Visor Frame & Tech Corner Brackets
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.85;

    // Corner HUD brackets
    const bracketLen = 14;
    // Top-Left
    ctx.beginPath(); ctx.moveTo(6, 6 + bracketLen); ctx.lineTo(6, 6); ctx.lineTo(6 + bracketLen, 6); ctx.stroke();
    // Top-Right
    ctx.beginPath(); ctx.moveTo(250 - bracketLen, 6); ctx.lineTo(250, 6); ctx.lineTo(250, 6 + bracketLen); ctx.stroke();
    // Bottom-Left
    ctx.beginPath(); ctx.moveTo(6, 122 - bracketLen); ctx.lineTo(6, 122); ctx.lineTo(6 + bracketLen, 122); ctx.stroke();
    // Bottom-Right
    ctx.beginPath(); ctx.moveTo(250 - bracketLen, 122); ctx.lineTo(250, 122); ctx.lineTo(250, 122 - bracketLen); ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Outer subtle neon glow line
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, 250, 122);

    // 3. Dynamic Facial Emotion States (Thinking, Dozing/Sleepy, Active, Blinking)
    const agentSeed = (agentId ?? name ?? "bot")
      .split("")
      .reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const moodCycle = (t + agentSeed * 2.3) % 24;

    // Mode determination:
    const isDozing = !isWorking && (clip === "sitting") && moodCycle > 16.5;
    const isThinking = isWorking || (moodCycle > 7.5 && moodCycle <= 14);

    const blinkCycle = t % (isDozing ? 6.2 : 3.6);
    const isBlinking = blinkCycle > (isDozing ? 6.05 : 3.42);

    let lookX = Math.sin(t * 0.85) * 9;
    let lookY = Math.cos(t * 1.3) * 4;

    if (isThinking) {
      // Glances up-left thoughtfully
      lookX = -14 + Math.sin(t * 2) * 3;
      lookY = -12;
    } else if (isDozing) {
      lookX = Math.sin(t * 0.4) * 3;
      lookY = 4;
    }

    const eyeY = 52 + lookY;
    const eyeDist = 58;
    const leftX = 128 - eyeDist + lookX;
    const rightX = 128 + eyeDist + lookX;

    const drawCyberEye = (cx: number, isRight: boolean) => {
      ctx.save();
      if (isBlinking) {
        // Cute glowing arc smile during blink
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(cx - 26, eyeY + 2);
        ctx.quadraticCurveTo(cx, eyeY - 20, cx + 26, eyeY + 2);
        ctx.stroke();
      } else if (isDozing) {
        // Dozing / Sleepy half-closed cozy eyelid (- -) with soft pulse
        const dozePulse = Math.sin(t * 2) * 1.5;
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 9;
        ctx.lineCap = "round";
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(cx - 24, eyeY + 6);
        ctx.quadraticCurveTo(cx, eyeY + 16 + dozePulse, cx + 24, eyeY + 6);
        ctx.stroke();

        // Soft drowsy pupil peeking below lid
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, eyeY + 7, 5, 0, Math.PI);
        ctx.fill();

        // Soft sleepy eyebrow resting low
        ctx.fillStyle = themeColor;
        ctx.fillRect(cx - 20, eyeY - 14, 40, 4);
      } else {
        // Outer glowing halo ring
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = 14;
        ctx.fillStyle = themeColor;
        ctx.beginPath();
        ctx.ellipse(cx, eyeY, 28, 34, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner glowing high-contrast iris capsule
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(cx + lookX * 0.25, eyeY + lookY * 0.25, 17, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Deep Pupil Core (dark cyber optic lens center)
        ctx.fillStyle = "#020617";
        ctx.beginPath();
        ctx.ellipse(cx + lookX * 0.35, eyeY + lookY * 0.35, 9, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Starburst Specular Highlight & Catchlight
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx + 9 + lookX * 0.1, eyeY - 13 + lookY * 0.1, 7, 0, Math.PI * 2);
        ctx.arc(cx - 9 + lookX * 0.1, eyeY + 9 + lookY * 0.1, 4, 0, Math.PI * 2);
        ctx.fill();

        // High-Tech Sci-Fi Eyebrow / Status Bar
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = 6;
        ctx.fillStyle = themeColor;
        const browTilt = isThinking
          ? (isRight ? 0.28 : -0.06) // One raised eyebrow when thinking!
          : (isRight ? 0.08 : -0.08);
        const browLift = isThinking && isRight ? -10 : 0;
        ctx.save();
        ctx.translate(cx, eyeY - 44 + browLift);
        ctx.rotate(browTilt);
        ctx.fillRect(-24, 0, 48, 6);
        ctx.restore();
      }
      ctx.restore();
    };

    drawCyberEye(leftX, false);
    drawCyberEye(rightX, true);

    // 4. Thinking Hologram Spinner / Data Activity Indicator
    if (isThinking) {
      ctx.save();
      ctx.translate(216, 32);
      ctx.rotate(t * 5);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();

      // Mini text badge: "KANBAN", "BUILD", "METRIC", "LOGS", "COFFEE", "THINK"
      const badgeText = workstationActivity?.includes("kanban")
        ? "KANBAN"
        : workstationActivity?.includes("pipeline")
        ? "BUILD"
        : workstationActivity?.includes("metrics")
        ? "METRIC"
        : workstationActivity?.includes("logs")
        ? "LOGS"
        : workstationActivity?.includes("coffee")
        ? "COFFEE"
        : workstationActivity?.includes("whiteboard")
        ? "DESIGN"
        : "THINK";
      ctx.fillStyle = themeColor;
      ctx.font = "bold 9px monospace";
      ctx.fillText(badgeText, 190, 56);
    } else if (isDozing) {
      // Drowsy "zZz" floating gently
      const zOffset = (t * 12) % 30;
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("z", 212 + zOffset * 0.3, 40 - zOffset * 0.5);
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("Z", 224 + zOffset * 0.4, 30 - zOffset * 0.7);
    }

    // 5. Expressive Cyber Mouth & Audio Equalizer / Smile Waveform
    ctx.save();
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    if (isThinking) {
      // Thoughtful pursed / curious mouth curve
      ctx.beginPath();
      ctx.moveTo(106, 110);
      ctx.quadraticCurveTo(128, 107, 148, 112);
      ctx.stroke();
    } else if (isDozing) {
      // Peaceful sleeping smile
      ctx.beginPath();
      ctx.moveTo(108, 108);
      ctx.quadraticCurveTo(128, 114, 148, 108);
      ctx.stroke();
    } else {
      // Animated mouth wave / cheerful smile
      const talkWave = Math.sin(t * 6) * 3;
      ctx.beginPath();
      ctx.moveTo(98, 104);
      ctx.quadraticCurveTo(128, 118 + talkWave, 158, 104);
      ctx.stroke();

      // Cute glowing smile dimples / LED nodes
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(96, 102, 4, 0, Math.PI * 2);
      ctx.arc(160, 102, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 6. CRT Scanlines & Cyber Glitch Pulse
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    for (let y = 0; y < 128; y += 4) {
      ctx.fillRect(0, y, 256, 1.5);
    }

    visorTexture.needsUpdate = true;
  });

  // Premium titanium chassis and metallic identity finish
  useEffect(() => {
    if (!color) return;
    const tint = new THREE.Color(color);
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material || !("emissive" in material)) return;
      if (!material.userData.baseColor) {
        material.userData.baseColor = material.color.clone();
      }

      const isHead =
        child.name.toLowerCase().includes("head") ||
        (mesh.geometry && child.parent?.name.toLowerCase().includes("head"));

      if (child.name === "Head_4") {
        // The visor face: Pure high-tech glossy obsidian black
        material.color.set("#02040a");
        material.emissive.set("#000000");
        material.emissiveIntensity = 0;
        material.roughness = 0.05;
        material.metalness = 0.98;
      } else if (isHead) {
        material.color.copy(tint);
        material.emissive.copy(tint);
        material.emissiveIntensity = 0.36;
        material.roughness = 0.16;
        material.metalness = 0.85;
      } else if (isBoss) {
        // Hermes: Executive Champagne Titanium-Gold chassis
        material.color.set("#fef08a");
        material.emissive.set("#78350f");
        material.emissiveIntensity = 0.18;
        material.roughness = 0.14;
        material.metalness = 0.95;
      } else {
        // Aerospace brushed high-grade titanium chassis
        material.color.set("#e2e8f0");
        material.emissive.set(tint);
        material.emissiveIntensity = 0.06;
        material.roughness = 0.18;
        material.metalness = 0.92;
      }

      if (isAway) {
        material.color.set("#4b5563");
        material.emissive.set("#000000");
        material.roughness = 0.6;
        material.metalness = 0.2;
      }
    });
  }, [cloned, color, isAway, isBoss]);

  useEffect(() => {
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }, [cloned]);

  useEffect(() => {
    const nextClipName = CLIP_NAME[clip];
    const nextAction = actions[nextClipName];
    if (!nextAction) return;
    if (currentClipRef.current === clip) return;
    const previousClipName = currentClipRef.current
      ? CLIP_NAME[currentClipRef.current]
      : null;
    const previousAction = previousClipName ? actions[previousClipName] : null;

    if (clip === "sitting") {
      nextAction.reset();
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.fadeIn(0.2).play();
    } else if (clip === "wave" || clip === "thumbsUp") {
      nextAction.reset();
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.fadeIn(0.18).play();
    } else {
      nextAction.reset();
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
      nextAction.fadeIn(0.25).play();
    }

    if (previousAction && previousAction !== nextAction) {
      previousAction.fadeOut(0.25);
    }
    currentClipRef.current = clip;
  }, [actions, clip]);

  useEffect(() => {
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material) return;
      material.transparent = Boolean(isAway);
      material.opacity = isAway ? 0.45 : 1;
    });
  }, [cloned, isAway]);

  const crownRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crownRef.current && isBoss) {
      const ct = clock.getElapsedTime();
      crownRef.current.rotation.y = ct * 0.9;
      crownRef.current.position.y = 4.3 + Math.sin(ct * 2.2) * 0.12;
    }
  });

  const finalScale = isBoss ? ROBOT_BASE_SCALE * 1.14 : ROBOT_BASE_SCALE;

  return (
    <group ref={group} scale={finalScale}>
      <primitive object={cloned} />
      {isBoss && (
        <group ref={crownRef} position={[0, 4.3, 0]}>
          {/* Floating cyber boss crown */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.05, 16, 32]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#f59e0b"
              emissiveIntensity={1.4}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i * Math.PI * 2) / 5;
            const cx = Math.cos(angle) * 0.42;
            const cz = Math.sin(angle) * 0.42;
            return (
              <mesh key={i} position={[cx, 0.22, cz]}>
                <octahedronGeometry args={[0.08, 0]} />
                <meshStandardMaterial
                  color="#ffd700"
                  emissive="#f59e0b"
                  emissiveIntensity={1.8}
                />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

useGLTF.preload(ROBOT_GLB_PATH);
