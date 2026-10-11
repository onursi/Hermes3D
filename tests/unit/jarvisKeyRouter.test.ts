import { afterEach, describe, expect, it, vi } from "vitest";
import { blockFreeTier, liveKey } from "@/lib/jarvis/vision";

afterEach(() => { vi.unstubAllEnvs(); blockFreeTier(0); });

describe("Jarvis live key router", () => {
  it("uses the free key first, the paid key when forced or blocked, and the paid key without a free one", () => {
    vi.stubEnv("GOOGLE_API_KEY", "paid-key"); vi.stubEnv("JARVIS_GEMINI_KEY_FREE", "free-key");
    const noon = Date.UTC(2026, 9, 11, 12, 0, 0);
    expect(liveKey(false, noon)).toMatchObject({ key: "free-key", tier: "free", hasFree: true });
    expect(liveKey(true, noon)).toMatchObject({ key: "paid-key", tier: "paid" });
    blockFreeTier(noon);
    expect(liveKey(false, noon + 3_600_000).tier).toBe("paid");
    expect(liveKey(false, Date.UTC(2026, 9, 12, 8, 30, 0)).tier).toBe("free");
  });
  it("never reports a free tier when the two keys are the same or only one exists", () => {
    vi.stubEnv("GOOGLE_API_KEY", "same"); vi.stubEnv("JARVIS_GEMINI_KEY_FREE", "same");
    expect(liveKey(false, 1)).toMatchObject({ key: "same", tier: "paid", hasFree: false });
  });
});
