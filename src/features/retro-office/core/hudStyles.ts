/**
 * One material for the whole HUD.
 *
 * The overlay had grown a different look per control: cyan borders here,
 * purple there, amber somewhere else, mono uppercase for labels that are not
 * code, and a glow on everything — which means a glow signifies nothing. Six
 * accent colours competing at once is why the room reads as a game rather than
 * an instrument.
 *
 * The rules these constants encode are the ones macOS uses for the same job:
 *
 * - One neutral material, translucent and blurred, so the 3D room stays
 *   visible behind the chrome and the chrome never competes with it.
 * - Hairline borders at low opacity instead of saturated outlines. A border is
 *   there to separate, not to decorate.
 * - Depth from shadow, not from glow. Glow is reserved for the few things that
 *   genuinely signal — the system state dot, an error.
 * - The interface font for prose and labels; monospace only for values that
 *   are actually machine output.
 * - Colour carries meaning or it is not used. Neutral is the default; accent
 *   marks the active thing; red, amber and green mean exactly what they mean
 *   in the system signal and nowhere else.
 */

/** The base surface: translucent, blurred, hairline-bordered. */
export const HUD_SURFACE =
  "border border-white/[0.09] bg-[#141619]/75 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.55)]";

/** A floating panel — settings, lists, anything with contents. */
export const HUD_PANEL = `rounded-2xl ${HUD_SURFACE}`;

/** A pill for status readouts and toolbars. */
export const HUD_PILL = `rounded-full ${HUD_SURFACE}`;

/**
 * A control at rest. Deliberately almost invisible until pointed at, because
 * a toolbar of twelve equally loud buttons is a toolbar you stop reading.
 */
export const HUD_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 h-7 text-[12px] font-medium tracking-[-0.005em] text-white/70 transition-colors duration-150 hover:bg-white/[0.08] hover:text-white active:bg-white/[0.12] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

/** The same control while its mode is on. One accent, used sparingly. */
export const HUD_BUTTON_ACTIVE =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 h-7 text-[12px] font-medium tracking-[-0.005em] bg-white/[0.14] text-white transition-colors duration-150 cursor-pointer";

/** Section labels. Sentence case, not shouted. */
export const HUD_LABEL = "text-[11px] font-medium text-white/45 tracking-[-0.005em]";

/** A number or identifier that came from a machine. */
export const HUD_VALUE = "font-mono text-[12px] text-white/85 tabular-nums";

/** Hairline divider between groups inside a pill. */
export const HUD_DIVIDER = "h-3.5 w-px bg-white/[0.12]";
