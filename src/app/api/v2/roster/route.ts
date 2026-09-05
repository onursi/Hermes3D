import path from "node:path";
import { NextResponse } from "next/server";

type HermesClient = { hermesJson: (route: string) => Promise<unknown> };

/**
 * Loaded the way every other route here loads it: through `eval("require")`,
 * so the bundler leaves `server/hermes-ws-client.js` alone. That module is
 * plain Node and is shared with the gateway adapter, which is not bundled.
 */
function loadClient(): HermesClient {
  const nodeRequire = eval("require") as NodeJS.Require;
  return nodeRequire(
    path.join(process.cwd(), "server", "hermes-ws-client.js"),
  ) as HermesClient;
}

/**
 * The agents, as Hermes actually has them.
 *
 * V2 needs a roster before anything else: the plan says an agent must show its
 * real name, model and status, and that missing information must read as
 * unknown rather than as a plausible default. The office got this through the
 * gateway websocket, but that path is wired inside a 5,800-line screen
 * component — pulling it in would drag the whole of V1 along with it.
 *
 * `/api/profiles` on the Hermes HTTP API answers the same question in one
 * read. A profile *is* an agent here: its own model, provider, skills, memory
 * and session store.
 *
 * Read-only. This route never creates a session and never spends a token.
 */

export type RosterAgent = {
  id: string;
  name: string;
  /** The model id Hermes reports, e.g. "claude-sonnet-4-6". Null when absent. */
  model: string | null;
  /** "anthropic", "openai-codex", … — who actually answers. */
  provider: string | null;
  /** The operator's own description of the profile, when they wrote one. */
  role: string | null;
  isDefault: boolean;
  /** How many skills the profile carries; a rough sense of how equipped it is. */
  skillCount: number | null;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** "router-claude-review" reads as "Claude Review". */
const displayName = (raw: string): string =>
  raw
    .replace(/^router-/, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || raw;

export async function GET() {
  try {
    const payload = (await loadClient().hermesJson("/api/profiles")) as {
      profiles?: Array<Record<string, unknown>>;
    };

    const agents: RosterAgent[] = (payload?.profiles ?? []).map((profile) => {
      const name = asString(profile.name) ?? "unbenannt";
      return {
        id: name,
        name: asString(profile.display_name) ?? displayName(name),
        model: asString(profile.model),
        provider: asString(profile.provider),
        role: asString(profile.description),
        isDefault: profile.is_default === true,
        skillCount: typeof profile.skill_count === "number" ? profile.skill_count : null,
      };
    });

    // The default profile first, then alphabetically. A stable order matters
    // more than it looks: these become seats around the core, and a seat that
    // moves between reloads makes the room feel unreliable.
    agents.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name, "de");
    });

    return NextResponse.json({ agents, reachable: true });
  } catch (error) {
    // An unreachable Hermes is reported as unreachable. The room then shows
    // empty docks and says the connection is missing — it does not invent a
    // fleet, because a fabricated agent is indistinguishable from a real one
    // until you click it.
    return NextResponse.json(
      {
        agents: [],
        reachable: false,
        error: error instanceof Error ? error.message : "Hermes nicht erreichbar",
      },
      { status: 200 },
    );
  }
}
