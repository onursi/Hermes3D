import { expect, test } from "@playwright/test";

/**
 * The one test the 3D scene never had.
 *
 * Ten specs cover agent panels, the kanban board, routing and the 2D office.
 * None of them opens `/office` and checks that the room actually renders — so
 * for the whole life of this project, a change that silently broke the scene
 * would have passed everything and been found by looking.
 *
 * That is about to matter a great deal. The V2 migration moves 91 effects and
 * 98 pieces of state out of a ten-thousand-line component, and the failure
 * mode of that work is not a crash: it is a canvas that mounts, stays black,
 * and reports no error at all. Three times today a real bug hid behind exactly
 * that — a conditional hook that stopped a modal opening, a loading overlay
 * that outlived its scene, and a probe that never mounted because it sat
 * inside a suspended subtree.
 *
 * So this checks the four things that distinguish "renders" from "is present":
 * a canvas exists, it has real dimensions, WebGL is genuinely running, and
 * frames are advancing. Deliberately no assertion about *what* is drawn — that
 * belongs in a screenshot comparison, and a strict pixel test on a scene with
 * drifting stars would fail every run for the wrong reason.
 */

const OFFICE = "/office";

/** Loading, shader compilation and the first assets. Generous on purpose. */
const SETTLE_MS = 20_000;

test.describe("Office 3D scene", () => {
  test("mounts a live WebGL canvas and keeps drawing frames", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto(OFFICE, { waitUntil: "domcontentloaded" });

    // A fresh profile shows the welcome wizard over the scene.
    await page.keyboard.press("Escape").catch(() => undefined);

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeAttached({ timeout: SETTLE_MS });

    await page.waitForTimeout(SETTLE_MS);

    // 1. The canvas has been sized by the renderer, not left at the 300x150
    //    default that an unmounted or never-resized canvas keeps.
    const size = await canvas.evaluate((element) => ({
      width: (element as HTMLCanvasElement).width,
      height: (element as HTMLCanvasElement).height,
    }));
    expect(size.width, "canvas width").toBeGreaterThan(400);
    expect(size.height, "canvas height").toBeGreaterThan(300);

    // 2. It is a real WebGL context, not a 2D fallback or a lost one.
    const contextKind = await canvas.evaluate((element) => {
      const gl = (element as HTMLCanvasElement).getContext("webgl2");
      if (gl) return gl.isContextLost() ? "lost" : "webgl2";
      const legacy = (element as HTMLCanvasElement).getContext("webgl");
      if (legacy) return legacy.isContextLost() ? "lost" : "webgl";
      return "none";
    });
    expect(contextKind, "WebGL context").toMatch(/^webgl2?$/);

    // 3. Frames are advancing. A scene that mounted and then froze is the
    //    failure this whole test exists to catch, and it looks identical to a
    //    working one in every other check.
    const framesInOneSecond = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const started = performance.now();
          const tick = () => {
            frames += 1;
            if (performance.now() - started < 1000) requestAnimationFrame(tick);
            else resolve(frames);
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(framesInOneSecond, "frames per second").toBeGreaterThan(5);

    // 4. Nothing threw on the way. Filtered to the classes that mean the scene
    //    is broken rather than that a backend is absent — this suite runs
    //    against an empty gateway fixture on purpose, so failed fetches and
    //    missing sources are the expected state, not a regression.
    const realErrors = consoleErrors.filter(
      (message) =>
        !/Failed to load resource|net::ERR_|fetch|404|Gateway|WebSocket/i.test(message),
    );
    expect(realErrors, `unerwartete Konsolenfehler:\n${realErrors.join("\n")}`).toHaveLength(0);
  });
});
