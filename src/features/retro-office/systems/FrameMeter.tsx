"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

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

  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current < 0.5) return;

    onSample({
      fps: Math.round(frames.current / elapsed.current),
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    });
    frames.current = 0;
    elapsed.current = 0;
  });

  return null;
}
