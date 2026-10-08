"use client";
import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useV2 } from "@/features/v2/state";
import { handPose, type GestureClip } from "./gestures";

export type PlayerMotion = { moving: boolean; airborne: boolean; pointing: number; gesture: GestureClip | null };
const SKIN = "#c98d63", SLEEVE = "#121a24";
const LENGTHS = [.059, .064, .06, .049];

function Hand({ side, motionRef, reduced }: { side: -1 | 1; motionRef: MutableRefObject<PlayerMotion>; reduced: boolean }) {
  const root = useRef<THREE.Group>(null), thumb = useRef<THREE.Group>(null);
  // Finger joint angles are sampled from the same clip without per-frame React state.
  const joints = useRef({ curl: .32, point: 0 });
  useFrame(() => {
    const motion = motionRef.current, clip = motion.gesture;
    const pose = handPose(side, clip?.kind ?? null, clip ? (performance.now() - clip.started) / 1000 : 0, performance.now() - motion.pointing < 420, reduced);
    if (root.current) { root.current.position.set(...pose.position); root.current.rotation.set(...pose.rotation, "ZYX"); }
    joints.current.curl = pose.curl; joints.current.point = pose.point;
    const closed = Math.max(0, (pose.curl - .32) / 1.13) * (1 - pose.thumb);
    if (thumb.current) {
      thumb.current.rotation.set(.18 * (1 - pose.thumb) - closed * .63, 1.02 - pose.thumb * .97 - closed * 2.17, .12 * (1 - pose.thumb));
      thumb.current.position.z = -.006 - pose.thumb * .035;
    }
  }, -0.5);
  return <group ref={root}><group scale={[side, 1, 1]}>
    <RoundedBox args={[.098, .044, .115]} radius={.018} smoothness={3}><meshStandardMaterial color={SKIN} roughness={.65} /></RoundedBox>
    {[-.035, -.012, .012, .035].map((x, i) => <AnimatedFinger key={x} x={x} index={i} joints={joints} />)}
    <group ref={thumb} position={[-.05, -.009, -.006]}>
      <mesh position={[0, 0, -.025]} rotation-x={Math.PI / 2}><capsuleGeometry args={[.014, .05, 4, 10]} /><meshStandardMaterial color={SKIN} roughness={.65} /></mesh>
    </group>
    <mesh position={[0, 0, .082]} rotation-x={Math.PI / 2}><cylinderGeometry args={[.046, .05, .068, 12]} /><meshStandardMaterial color={SLEEVE} roughness={.5} /></mesh>
    <mesh position={[0, 0, .19]} rotation-x={Math.PI / 2}><cylinderGeometry args={[.05, .065, .15, 12]} /><meshStandardMaterial color={SLEEVE} roughness={.5} /></mesh>
    <mesh position={[0, 0, .047]} rotation-x={Math.PI / 2}><torusGeometry args={[.046, .003, 6, 20]} /><meshBasicMaterial color="#5fe3ff" /></mesh>
  </group></group>;
}

function AnimatedFinger({ x, index, joints }: { x: number; index: number; joints: MutableRefObject<{ curl: number; point: number }> }) {
  // Refs allow the two joints to move without remounting meshes or allocating geometry.
  const base = useRef<THREE.Group>(null), tip = useRef<THREE.Group>(null);
  useFrame(() => {
    const curl = joints.current.curl * (1 - (index === 0 ? joints.current.point : 0));
    if (base.current) base.current.rotation.x = -curl;
    if (tip.current) tip.current.rotation.x = -curl * .94;
  });
  const half = LENGTHS[index] / 2;
  return <group ref={base} position={[x, -.002, -.052]}>
    <mesh position={[0, 0, -half / 2]} rotation-x={Math.PI / 2}><capsuleGeometry args={[.011, half, 4, 8]} /><meshStandardMaterial color={SKIN} roughness={.65} /></mesh>
    <group ref={tip} position={[0, 0, -half]}><mesh position={[0, 0, -half / 2]} rotation-x={Math.PI / 2}><capsuleGeometry args={[.0105, half, 4, 8]} /><meshStandardMaterial color={SKIN} roughness={.65} /></mesh></group>
  </group>;
}

export function FirstPersonHands({ motionRef, visible }: { motionRef: MutableRefObject<PlayerMotion>; visible: boolean }) {
  const { camera } = useThree(), { prefs } = useV2();
  const rig = useRef<THREE.Group>(null), phase = useRef(0), lift = useRef(0);
  useEffect(() => {
    if (!visible) return;
    const point = (event: PointerEvent) => {
      if (event.target instanceof HTMLCanvasElement) motionRef.current.pointing = performance.now();
    };
    window.addEventListener("pointerdown", point);
    return () => window.removeEventListener("pointerdown", point);
  }, [motionRef, visible]);
  useFrame((_, rawDt) => {
    if (!rig.current) return;
    const dt = Math.min(rawDt, .05), m = motionRef.current;
    phase.current += dt * (m.moving ? 9 : 1.6);
    lift.current = THREE.MathUtils.damp(lift.current, m.airborne ? .05 : 0, 10, dt);
    const strength = prefs.reducedMotion ? 0 : m.gesture ? .2 : 1;
    rig.current.position.copy(camera.position);
    rig.current.quaternion.copy(camera.quaternion);
    rig.current.translateX(Math.cos(phase.current * .5) * (m.moving ? .008 : .002) * strength);
    rig.current.translateY((Math.sin(phase.current) * (m.moving ? .012 : .003) + lift.current) * strength);
  });
  return visible ? <group ref={rig}><group scale={.85}><Hand side={-1} motionRef={motionRef} reduced={prefs.reducedMotion} /><Hand side={1} motionRef={motionRef} reduced={prefs.reducedMotion} /></group></group> : null;
}
