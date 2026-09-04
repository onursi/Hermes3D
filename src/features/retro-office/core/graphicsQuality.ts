// Graphics quality presets for the immersive office renderer.
// Persisted in localStorage so the choice survives reloads.

export type GraphicsQuality = "low" | "medium" | "balanced" | "ultra";

export const GRAPHICS_QUALITY_STORAGE_KEY = "hermes-office-graphics-quality-v1";

export const GRAPHICS_QUALITY_OPTIONS: Array<{
  id: GraphicsQuality;
  label: string;
  description: string;
}> = [
  {
    id: "low",
    label: "Low",
    description: "Fastest. No post-processing, small shadow maps.",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Bloom and smooth edges, without ambient occlusion.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Ambient occlusion, bloom and soft shadows.",
  },
  {
    id: "ultra",
    label: "Ultra",
    description: "Maximum fidelity. Large shadow maps and full effects.",
  },
];

export type GraphicsQualityConfig = {
  /** Shadow map resolution for the key light. */
  shadowMapSize: number;
  /** Upper bound for the adaptive device pixel ratio controller. */
  maxDpr: number;
  /** Whether the EffectComposer post-processing chain is mounted. */
  postProcessing: boolean;
  /** Screen-space ambient occlusion (N8AO). */
  ambientOcclusion: boolean;
  /** AO quality knob passed to N8AO. */
  aoQuality: "performance" | "low" | "medium" | "high";
  /** Bloom on bright emissive surfaces. */
  bloom: boolean;
  /** SMAA anti-aliasing inside the composer. */
  smaa: boolean;
  /**
   * MSAA samples on the composer's render target.
   *
   * This is the only real geometric anti-aliasing the scene gets. The
   * `antialias` flag on the canvas is inert while an EffectComposer is
   * mounted, because the composer renders into its own targets and never
   * touches the multisampled default framebuffer. With this at 0, every hard
   * edge in the room — box corners, table rims, LED rails, window frames —
   * relies on SMAA alone, which reconstructs edges from the finished image
   * and cannot recover what was never sampled.
   */
  msaaSamples: number;
  /**
   * Resolution of the buffer three renders for refractive materials, relative
   * to the viewport.
   *
   * Nothing in the room uses `transmission` any more.
   *
   * This comment used to name five materials — the smoked glass table top,
   * its core portal, the war room shell — and warn that each one makes the
   * renderer re-render the opaque scene into a separate target. They have
   * since been rebuilt as ordinary transparent materials, and the warning
   * outlived the thing it warned about. It was then read as evidence during
   * a performance hunt and sent that hunt down a dead end, until Codex
   * checked the bundle and found no transmissive material in it at all.
   *
   * The setting is kept because the cost it describes is real and would
   * return with the first transmissive material. Today it does nothing.
   */
  transmissionScale: number;
  /** Depth of field while the follow camera is active. */
  followDepthOfField: boolean;
};

const QUALITY_CONFIGS: Record<GraphicsQuality, GraphicsQualityConfig> = {
  low: {
    shadowMapSize: 1024,
    maxDpr: 1.25,
    postProcessing: false,
    ambientOcclusion: false,
    aoQuality: "performance",
    bloom: false,
    smaa: false,
    msaaSamples: 0,
    transmissionScale: 0.35,
    followDepthOfField: false,
  },
  /**
   * The step that was missing between "everything" and "nothing".
   *
   * Measured on an integrated Vega 11 driving a 34" ultrawide: "balanced"
   * gave 7 fps and "low" gave 60 — with the display's own 17 ms as the
   * ceiling and only about 4 ms of that spent on the GPU. So the machine was
   * not short of graphics power at "low"; it was drowning at "balanced", and
   * there was nothing in between to fall back to.
   *
   * What separates the two is which effects run across the whole screen.
   * Ambient occlusion samples the depth buffer many times per pixel and is by
   * far the most expensive of them, so it is the one that stays off. Bloom
   * works on a small downsampled copy and costs comparatively little, and it
   * is also the effect this room is built around — every emissive rail, badge
   * and hologram edge was authored expecting it. SMAA is a single cheap pass
   * over the finished image, which is what keeps the wall text from crawling.
   *
   * MSAA is kept at 2 rather than 0 for the hard geometric edges SMAA cannot
   * reconstruct, and rather than 4 because samples are memory bandwidth, and
   * bandwidth is exactly what an iGPU has least of.
   */
  medium: {
    shadowMapSize: 1024,
    maxDpr: 1.25,
    postProcessing: true,
    ambientOcclusion: false,
    aoQuality: "performance",
    bloom: true,
    smaa: true,
    msaaSamples: 2,
    transmissionScale: 0.35,
    followDepthOfField: false,
  },
  balanced: {
    shadowMapSize: 2048,
    maxDpr: 1.35,
    postProcessing: true,
    ambientOcclusion: true,
    aoQuality: "performance",
    bloom: true,
    smaa: true,
    msaaSamples: 4,
    transmissionScale: 0.5,
    followDepthOfField: false,
  },
  ultra: {
    shadowMapSize: 2048,
    maxDpr: 2.0, // Full 4K / Retina native pixel density
    postProcessing: true,
    ambientOcclusion: true,
    aoQuality: "high",
    bloom: true,
    smaa: true,
    msaaSamples: 8,
    transmissionScale: 0.75,
    followDepthOfField: true,
  },
};

export const getGraphicsQualityConfig = (
  quality: GraphicsQuality,
): GraphicsQualityConfig => QUALITY_CONFIGS[quality];

export const isGraphicsQuality = (value: unknown): value is GraphicsQuality =>
  value === "low" || value === "medium" || value === "balanced" || value === "ultra";

/** The explicit user choice, or null when the user never picked one. */
export const loadStoredGraphicsQuality = (): GraphicsQuality | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(GRAPHICS_QUALITY_STORAGE_KEY);
    if (isGraphicsQuality(stored)) return stored;
  } catch {
    // Storage unavailable (private mode, etc.) — fall through to default.
  }
  return null;
};

export const loadGraphicsQuality = (): GraphicsQuality =>
  loadStoredGraphicsQuality() ?? "balanced";

/**
 * True when WebGL runs on a CPU rasterizer (SwiftShader, llvmpipe, …).
 * Software renderers cannot keep up with the full pipeline and may lose
 * the GL context, so callers should drop to the "low" preset.
 */
export const isSoftwareWebGLRenderer = (
  context: WebGLRenderingContext | WebGL2RenderingContext,
): boolean => {
  try {
    const debugInfo = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      debugInfo
        ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : context.getParameter(context.RENDERER),
    );
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
};

let softwareWebGLProbe: boolean | null = null;

/**
 * Probes a throwaway WebGL context to learn whether the machine rasterizes
 * in software, BEFORE the main canvas mounts. This lets the initial quality
 * state start at "low" on such machines instead of downgrading after the
 * heavy pipeline has already overloaded (and possibly lost) the context.
 */
export const detectSoftwareWebGL = (): boolean => {
  if (typeof document === "undefined") return false;
  if (softwareWebGLProbe !== null) return softwareWebGLProbe;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!context) {
      softwareWebGLProbe = true;
      return true;
    }
    softwareWebGLProbe = isSoftwareWebGLRenderer(context);
    context.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    softwareWebGLProbe = false;
  }
  return softwareWebGLProbe ?? false;
};

/**
 * True on a phone/tablet-class device: coarse pointer (no mouse) combined
 * with a narrow viewport. Deliberately narrower than just "has touch" —
 * touch-screen laptops keep the desktop default. Mobile GPUs run the same
 * "balanced" preset (2048px shadow map, SSAO, bloom, SMAA) at a real cost:
 * this was a concrete, measured contributor to sub-30fps stutter on
 * mid-range phones, not just "the internet connection" — none of that
 * pipeline touches the network.
 */
export const isLikelyMobileDevice = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return (
      window.matchMedia("(pointer: coarse)").matches &&
      window.matchMedia("(max-width: 900px)").matches
    );
  } catch {
    return false;
  }
};

/**
 * The quality the office should boot with: the user's stored choice, or a
 * hardware-appropriate default.
 */
export const resolveInitialGraphicsQuality = (): GraphicsQuality => {
  const stored = loadStoredGraphicsQuality();
  if (stored) return stored;
  if (detectSoftwareWebGL() || isLikelyMobileDevice()) return "low";
  if (detectIntegratedGpu()) return "medium";
  return "balanced";
};

/**
 * Whether the GPU shares its memory with the rest of the machine.
 *
 * The old check knew two things: software rendering, and phones. Everything
 * else was handed "balanced", which on the machine this was written for
 * meant ambient occlusion, bloom, 4x MSAA and 2048 shadows across a 34"
 * ultrawide — measured at 7 fps. The same room on "low" ran at 60. So the
 * first thing the office ever showed its owner was the worst version of
 * itself, and it took a session of measurement to find out why.
 *
 * An integrated GPU is not slow at arithmetic; it is starved of bandwidth,
 * because every texture read competes with the CPU for the same system
 * memory. That is precisely what full-screen post-processing spends. Naming
 * the families is crude and will age — but a name we do not recognise falls
 * through to the old behaviour, so being wrong here costs nothing that was
 * not already being paid.
 */
const INTEGRATED_GPU_PATTERN =
  /\b(vega \d|radeon\(tm\) (vega|graphics)|iris|uhd graphics|hd graphics|intel\(r\) (arc )?graphics|adreno|mali|apple gpu)\b/i;

let integratedGpuProbe: boolean | null = null;

export const detectIntegratedGpu = (): boolean => {
  if (typeof document === "undefined") return false;
  if (integratedGpuProbe !== null) return integratedGpuProbe;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!context) {
      integratedGpuProbe = false;
      return false;
    }
    const debugInfo = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      debugInfo
        ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : context.getParameter(context.RENDERER),
    );
    integratedGpuProbe = INTEGRATED_GPU_PATTERN.test(renderer);
    return integratedGpuProbe;
  } catch {
    integratedGpuProbe = false;
    return false;
  }
};

export const saveGraphicsQuality = (quality: GraphicsQuality) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GRAPHICS_QUALITY_STORAGE_KEY, quality);
  } catch {
    // Best effort only.
  }
};
