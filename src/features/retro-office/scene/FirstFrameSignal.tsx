"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";

/**
 * Reports when the scene has actually been drawn, not when its data arrived.
 *
 * The knowledge graph takes about ten seconds between "the notes are loaded"
 * and "there is something on screen": 259 spheres, a thousand edges and a
 * point cloud have to be built and uploaded first. Everything up to now
 * treated the fetch as the end of loading, so for those ten seconds the
 * window showed a finished, black, empty canvas — which reads as broken, and
 * was reported as broken.
 *
 * A frame counter rather than a single frame: the first pass renders before
 * the geometry is on the GPU, so it is still black. Waiting a few frames
 * means the signal fires when there is genuinely something to look at.
 */
export function FirstFrameSignal({
  onReady,
  frames = 4,
  timeoutMs = 12000,
}: {
  onReady: () => void;
  frames?: number;
  /** Hard ceiling — see below. */
  timeoutMs?: number;
}) {
  const seen = useRef(0);
  const fired = useRef(false);

  const fire = () => {
    if (fired.current) return;
    fired.current = true;
    onReady();
  };

  /**
   * The frame counter is the good signal; the timer is the one that matters.
   *
   * A loading indicator must never be able to outlive the thing it covers. If
   * the frame loop is slow to start — a suspended subtree waiting on a font,
   * a stalled context, anything — an indicator that only listens for frames
   * hides a working scene forever, which is strictly worse than the blank
   * canvas it was built to replace. So whichever comes first wins, and the
   * failure mode is a visible scene rather than a permanent spinner.
   */
  const fireRef = useRef(fire);
  fireRef.current = fire;
  useEffect(() => {
    const timer = setTimeout(() => fireRef.current(), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  useFrame(() => {
    if (fired.current) return;
    seen.current += 1;
    if (seen.current >= frames) fire();
  });

  return null;
}
