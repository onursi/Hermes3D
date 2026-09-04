"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

/**
 * What the room actually costs, per frame.
 *
 * Onur asked twice whether a change made things faster or slower, and both
 * times the honest answer was that I did not know — I had arithmetic about
 * removed vertices and no measurement. Arguing about performance without a
 * number is how a scene gets slowly worse while everyone agrees it feels fine.
 *
 * Three numbers, because each catches a different kind of mistake:
 *
 *   fps         what it feels like, and the only one that is the actual goal
 *   draw calls  how many separate things the CPU asks the GPU to draw. This
 *               is what a careless component multiplies — sixteen meshes
 *               where one instanced mesh would do.
 *   triangles   geometry weight, which is what a naive "more detail" change
 *               inflates without touching the draw count.
 *
 * Averaged over half a second: a per-frame readout flickers too much to
 * compare two states by eye, which defeats the purpose.
 */

export function FrameMeter({
  onSample,
}: {
  onSample: (sample: { fps: number; calls: number; triangles: number }) => void;
}) {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  const elapsed = useRef(0);
  const calls = useRef(0);
  const triangles = useRef(0);

  /**
   * The counters have to be read after the frame, not before it.
   *
   * useFrame runs ahead of the render, and three.js clears gl.info at the
   * start of each one, so reading there reports the state before anything was
   * drawn — which is how this first shipped saying "1 Draws, 0k Dreiecke" for
   * a scene with a planet, a galaxy and four robots in it.
   *
   * With autoReset off the counters accumulate instead, so each frame reads
   * what the *previous* one cost and then clears it by hand.
   */
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    calls.current = gl.info.render.calls;
    triangles.current = gl.info.render.triangles;
    gl.info.reset();

    if (elapsed.current < 0.5) return;
    onSample({
      fps: Math.round(frames.current / elapsed.current),
      calls: calls.current,
      triangles: triangles.current,
    });
    frames.current = 0;
    elapsed.current = 0;
  });

  return null;
}
