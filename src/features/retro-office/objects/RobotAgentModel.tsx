"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
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
}: {
  clip: RobotClipKey;
  /** Per-agent identity accent — tints the robot's chest/visor emissive. */
  color?: string;
  isAway?: boolean;
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

  // Recolor the chassis toward the agent's identity color — a strong lerp
  // on the base color plus a moderate emissive, not just a faint tint, so
  // the 4 agents actually read as differently colored robots, not identical
  // ones with a subtly different name-tag color.
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
      const baseColor = material.userData.baseColor as THREE.Color;
      material.color = baseColor.clone().lerp(tint, 0.65);
      material.emissive = tint.clone();
      material.emissiveIntensity = 0.35;
    });
  }, [cloned, color]);

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
    nextAction.reset().fadeIn(0.25).play();
    if (previousAction && previousAction !== nextAction) {
      previousAction.fadeOut(0.25);
    }
    currentClipRef.current = clip;
    return () => {
      nextAction.fadeOut(0.2);
    };
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

  return (
    <group ref={group} scale={ROBOT_BASE_SCALE}>
      <primitive object={cloned} />
    </group>
  );
}

useGLTF.preload(ROBOT_GLB_PATH);
