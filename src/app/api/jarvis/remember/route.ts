import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * "Remember that" — a thought becomes a note in the vault.
 *
 * This is the half that closes the loop. Asking the vault reads; without a
 * way back in, everything learned in a conversation evaporates when the tab
 * closes, and the second brain only ever gets smaller relative to what you
 * know.
 *
 * It writes to the Inbox and nowhere else. AGENTS.md is explicit that the
 * Inbox is the entry point for unprocessed captures and that a file there
 * stays untouched until Onur has processed it — so an automatic writer
 * belongs there and must not file things into the structured folders on its
 * own. A note that lands in the wrong place is worse than one that has to be
 * moved by hand.
 */

export const dynamic = "force-dynamic";

const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH?.trim() ||
  path.join(os.homedir(), "Desktop", "Life OS");

const INBOX = "00📥Inbox";

/**
 * A filename that cannot escape the Inbox.
 *
 * The title comes from whatever was typed, so it is untrusted input on its
 * way to a filesystem path. Separators and traversal are stripped rather
 * than escaped, and the result is checked against the Inbox afterwards —
 * belt and braces, because a path check that only looks at the input misses
 * whatever the platform normalises behind your back.
 */
function safeFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\.\.+/g, ".")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "Notiz";
}

/** The first line, shortened, as the note's name. */
function titleFrom(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim()) ?? "";
  const short = firstLine.trim().replace(/^[-*#>\s]+/, "");
  return short.length > 60 ? short.slice(0, 60).replace(/\s\S*$/, "") + "…" : short;
}

export async function POST(req: Request) {
  let body: { text?: string; question?: string; sources?: { id: string; title: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "Ungültige Anfrage." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, reason: "Nichts zu merken übergeben." });
  }

  const today = new Date().toISOString().slice(0, 10);
  const title = titleFrom(text);
  const fileName = `${safeFileName(title)} ${today}.md`;
  const target = path.join(VAULT_PATH, INBOX, fileName);

  const inboxDir = path.join(VAULT_PATH, INBOX);
  if (!path.resolve(target).startsWith(path.resolve(inboxDir) + path.sep)) {
    return NextResponse.json({ ok: false, reason: "Ungültiger Dateiname." }, { status: 400 });
  }

  // The frontmatter follows AGENTS.md: the opening --- on line one, only
  // fields that actually apply, and nothing invented. The sources are real
  // wikilinks, so the note is wired into the graph the moment it lands.
  const quelle = [`  - Gespräch mit Jarvis am ${today}`];
  if (body.question?.trim()) {
    quelle.push(`  - "Frage: ${body.question.trim().replace(/"/g, "'")}"`);
  }
  for (const source of body.sources ?? []) {
    const withoutExtension = source.id.replace(/\.md$/, "");
    quelle.push(`  - "[[${withoutExtension}]]"`);
  }

  const contents = [
    "---",
    "status: entwurf",
    "quelle:",
    ...quelle,
    `erfasst_am: ${today}`,
    `zeitbezug: ${today}`,
    "sensibilität: persönlich",
    "---",
    "",
    "> Von Jarvis aus dem Gespräch festgehalten. Ungeprüft — liegt in der Inbox, bis du sie verarbeitest.",
    "",
    text,
    "",
  ].join("\n");

  try {
    fs.mkdirSync(inboxDir, { recursive: true });
    // wx: never overwrite. Two thoughts captured under the same first line on
    // the same day must not silently replace each other.
    let finalPath = target;
    let attempt = 2;
    while (fs.existsSync(finalPath)) {
      finalPath = path.join(inboxDir, `${safeFileName(title)} ${today} (${attempt}).md`);
      attempt += 1;
      if (attempt > 20) break;
    }
    fs.writeFileSync(finalPath, contents, { encoding: "utf8", flag: "wx" });
    return NextResponse.json({
      ok: true,
      file: path.relative(VAULT_PATH, finalPath).split(path.sep).join("/"),
      title,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reason: `Konnte die Notiz nicht schreiben: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
