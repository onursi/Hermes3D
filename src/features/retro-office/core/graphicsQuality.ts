// Graphics quality presets for the immersive office renderer.
// Persisted in localStorage so the choice survives reloads.

export type GraphicsQuality = "low" | "balanced" | "ultra";

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
   * Five materials in the room use `transmission` (the smoked glass table top,
   * its core portal, the war room shell). A single one of them makes the
   * renderer re-render the whole opaque scene into a separate target and build
   * its mip chain, every frame. What that buffer actually shows here is the
   * floor seen through dark glass at 0.88 opacity, so it survives being
   * rendered smaller far better than the rest of the image does.
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
  value === "low" || value === "balanced" || value === "ultra";

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
  return "balanced";
};

export const saveGraphicsQuality = (quality: GraphicsQuality) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GRAPHICS_QUALITY_STORAGE_KEY, quality);
  } catch {
    // Best effort only.
  }
};
