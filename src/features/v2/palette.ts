/**
 * The colours that mean something, in one place.
 *
 * ASTRA caught this in review and was right: the selected note pulsed in the
 * same amber the core uses for a waiting decision. Two different facts wearing
 * one colour is worse than an ugly palette — it teaches the eye to stop
 * trusting the signal, and the signal is the one thing amber is for.
 *
 * So: amber is reserved. It appears when, and only when, a decision is
 * genuinely waiting for Onur. Selection is cyan-white, which is the colour
 * every other "this is the thing you are looking at" already uses.
 */

/** A decision is waiting. Nothing else, anywhere, ever. */
export const DECISION_COLOR = "#fbbf24";

/** What is currently selected — in any world, in any HUD. */
export const SELECTION_COLOR = "#a5f3ff";

/**
 * The ten areas of LifeOS, and one for what has no area.
 *
 * Onur's complaint was that everything is blue, and he was right about the
 * cause without naming it: eight of the eleven area colours sat between cyan
 * and violet, on a blue-black ground, under a blue fill light, with additive
 * blending pulling every overlap further toward cyan. The room could not be
 * anything but blue.
 *
 * The fix is fewer blue things, not more colourful ones. V6-02 says it in as
 * many words: adding cyan, rings and bloom everywhere is not depth. So the
 * hues now spread across warm greys, sand, rose, green and ochre, and exactly
 * one area stays blue — knowledge, the centre, where it means something.
 *
 * Two colours are deliberately absent from this list: cyan, because it now
 * means *selected* and nothing else, and amber, because it means *a decision
 * is waiting*. A palette that reuses a signal colour for decoration spends
 * the signal.
 *
 * Keyed by the vault's real folder names, emoji and spacing included — those
 * strings are what `/api/obsidian-graph` actually returns.
 */
export const AREA_COLORS: Record<string, string> = {
  "00📥Inbox": "#86d99c",
  "01📦RAW": "#8d8a83",
  "02⚙️ System": "#9aa3ad",
  "03🪪 Identität": "#e08a8a",
  "04📖 Lebensprofil": "#d9b382",
  "05 🚀 Projekte": "#57c98a",
  "06💡Interessen": "#d982c4",
  "07🧠Wissen": "#8fa8ff",
  "08📚Quellen": "#c9944a",
  "09🅿️Ideenparkplatz": "#b7d96a",
  Ungeordnet: "#5c5f66",
};

/** For anything the vault knows and this palette does not. */
export const AREA_FALLBACK = "#5c5f66";

/**
 * The ground everything is drawn on.
 *
 * Near-neutral rather than blue-black. A tinted background tints every dark
 * pixel in the scene, which is most of them.
 */
export const SPACE_BLACK = "#07070a";

/** A far object nobody has selected. Warm grey, so cyan reads as a state. */
export const DISTANT_TINT = "#b9b3a8";
