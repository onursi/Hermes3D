import { describe, expect, it } from "vitest";
import { personaInstruction, readPersona } from "@/lib/jarvis/personas";

describe("Jarvis personas", () => {
  it("falls back to the default for unknown input", () => {
    expect(readPersona("stratege")).toBe("stratege");
    expect(readPersona("toString")).toBe("kumpel");
    expect(readPersona(undefined)).toBe("kumpel");
  });
  it("lets the buddy react to the camera and laugh in his own voice only without an external voice", () => {
    expect(personaInstruction("kumpel", false)).toContain("dreckig auflachen");
    expect(personaInstruction("kumpel", false)).toContain("Nur wirklich Sichtbares");
    expect(personaInstruction("kumpel", true)).not.toContain("auflachen");
    expect(personaInstruction("kumpel", true)).toContain("Nur wirklich Sichtbares");
  });
  it("keeps the strategist free of roasts and laughter", () => {
    expect(personaInstruction("stratege", true)).toContain("laugh false");
    expect(personaInstruction("stratege", false)).toContain("Kein Spott");
  });
});
