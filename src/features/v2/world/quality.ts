"use client";
/**
 * Render quality tiers (R45).
 *
 * The old pipeline was sized for a weak GPU: bloom only, ambient occlusion was
 * measured at 7 fps and dropped. With a discrete GPU on the desktop that limit
 * no longer holds, but the same page also runs on an iPhone, where the phone's
 * own chip renders it. So the tier is chosen per device, not per machine owner.
 */
export type QualityTier = "cinema" | "balanced" | "lite";
export type QualityPref = "auto" | QualityTier;

export type QualitySpec = {
  dpr: [number, number];
  shadowMap: number;
  multisampling: number;
  ambientOcclusion: boolean;
  grain: boolean;
  vignette: boolean;
  orbSegments: number;
};

/*
 * R48 retune after Onur measured 120 → 50 fps on an RTX 3060 at 3440×1440/180 Hz.
 * The expensive part was per-pixel work on ~5 MP: 4× MSAA on every composer
 * buffer plus full-quality AO. MSAA is replaced by SMAA (one cheap pass), AO
 * runs in its "performance" preset, and the render resolution never exceeds
 * what the pre-R45 pipeline used (dpr ≤ 1.35), so cinema can only add effects,
 * not pixels. A PerformanceMonitor in V2Scene steps down a tier on its own.
 */
export const QUALITY: Record<QualityTier, QualitySpec> = {
  cinema: { dpr: [1, 1.35], shadowMap: 2048, multisampling: 0, ambientOcclusion: true, grain: true, vignette: true, orbSegments: 120 },
  balanced: { dpr: [1, 1.35], shadowMap: 1024, multisampling: 0, ambientOcclusion: false, grain: false, vignette: true, orbSegments: 96 },
  lite: { dpr: [1, 1.25], shadowMap: 1024, multisampling: 0, ambientOcclusion: false, grain: false, vignette: false, orbSegments: 64 },
};

export const TIER_ORDER: QualityTier[] = ["cinema", "balanced", "lite"];

/** One step cheaper, used by the automatic fps guard. */
export function stepDown(tier: QualityTier, steps: number): QualityTier {
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(tier) + steps)];
}

export const QUALITY_LABELS: Record<QualityPref, string> = {
  auto: "Automatisch",
  cinema: "Kino (starke Grafikkarte)",
  balanced: "Ausgewogen",
  lite: "Leicht (Handy, Akku)",
};

let detected: QualityTier | null = null;

/** Best effort and cached: the GPU string is only read once per page. */
export function detectQuality(): QualityTier {
  if (detected) return detected;
  if (typeof window === "undefined") return "balanced";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const small = Math.min(window.screen?.width ?? 0, window.screen?.height ?? 0) < 820;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (ios || (coarse && small)) return (detected = "lite");
  let renderer = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl2") as WebGL2RenderingContext | null;
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    renderer = String(info && gl ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? "");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    renderer = "";
  }
  detected = /NVIDIA|GeForce|RTX|GTX|Radeon RX|Radeon Pro|Arc A/i.test(renderer) ? "cinema" : "balanced";
  return detected;
}

export function resolveQuality(pref: QualityPref | undefined): QualityTier {
  return !pref || pref === "auto" ? detectQuality() : pref;
}
