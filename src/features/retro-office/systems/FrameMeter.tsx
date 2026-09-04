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
  onSample: (sample: { fps: number; calls: number; triangles: number; jsMs: number; renderMs: number }) => void;
}) {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  const elapsed = useRef(0);
  const calls = useRef(0);
  const triangles = useRef(0);
  const jsTotal = useRef(0);
  const renderTotal = useRef(0);

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

  /**
   * How much of each frame is spent in JavaScript.
   *
   * fps alone cannot say why a scene is slow. A frame that takes 125ms is
   * either the CPU building it or the GPU drawing it, and the two have
   * opposite fixes: fewer objects and less per-frame logic on one side,
   * fewer pixels and simpler shaders on the other. Guessing wrong costs a
   * day — which is what happened when the galaxies were blamed and removing
   * them changed nothing at all.
   *
   * Every frame runs inside a requestAnimationFrame callback, so wrapping
   * rAF times all of it: React, every useFrame, and the draw submission. If
   * that number sits close to the frame time the CPU is the wall; if it is a
   * fraction of it, the rest is the GPU and the browser waiting on it.
   */
  /**
   * Of the JavaScript in a frame, how much is three.js drawing.
   *
   * "23 ms of JavaScript" is not yet an instruction. Inside gl.render sits
   * matrix updates, frustum culling and the sorting of every transparent
   * object in the room — costs that scale with how many objects exist, and
   * that no amount of tuning the per-frame callbacks would touch. Outside it
   * sits everything the scene's own code does each frame.
   *
   * The two have different fixes, so the meter separates them rather than
   * inviting another confident guess.
   */
  useEffect(() => {
    const originalRender = gl.render.bind(gl);
    const patched = gl as unknown as { render: typeof gl.render };
    patched.render = ((scene, camera) => {
      const start = performance.now();
      originalRender(scene, camera);
      renderTotal.current += performance.now() - start;
    }) as typeof gl.render;
    return () => {
      patched.render = originalRender;
    };
  }, [gl]);

  useEffect(() => {
    const native = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      native((time) => {
        const start = performance.now();
        cb(time);
        jsTotal.current += performance.now() - start;
      });
    return () => {
      window.requestAnimationFrame = native;
    };
  }, []);

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
      jsMs: Math.round((jsTotal.current / frames.current) * 10) / 10,
      renderMs: Math.round((renderTotal.current / frames.current) * 10) / 10,
    });
    frames.current = 0;
    elapsed.current = 0;
    jsTotal.current = 0;
    renderTotal.current = 0;
  });

  return null;
}
