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
