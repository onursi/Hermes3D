/**
 * The gravity lift ride, as shared state.
 *
 * Three unrelated parts of the scene need to know that someone is travelling:
 * the agent being carried, the deck it passes through, and the meeting table
 * that has to get out of the way. Keeping it here rather than in the agents
 * module means the furniture can read it without importing the entire cast.
 *
 * Driven by the render loop rather than a timer — see the agent frame loop,
 * which computes `currentY` from elapsed time. The agent list is rebuilt by a
 * `.map()` every tick, so anything written onto an agent is written to an
 * object about to be discarded; this object survives.
 */
export const activeLiftSuction = {
  agentId: null as string | null,
  currentY: 0,
  startedAt: 0,
  fromY: 0,
  toY: 0,
  durationMs: 1600,
  /** Called once when the ride ends, so the caller can place the agent. */
  onArrive: null as (() => void) | null,
};
