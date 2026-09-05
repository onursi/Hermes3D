import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { resolveNotePath } from "@/lib/vault/root";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One note, read. Nothing else.
 *
 * V6-05 is blunt about what this replaces: Onur wants the document "direkt
 * vor die Nase" instead of being handed to Obsidian. Until now the only way
 * to read a note in V2 was `window.location.href = "obsidian://..."` — which
 * leaves the app to open another one.
 *
 * Deliberately narrow:
 * - read only. There is no POST, no PUT, no delete. LifeOS stays the single
 *   writable truth, and this route cannot change a byte of it.
 * - no directory listing. The graph already names every note; a second way
 *   to enumerate the vault is a second thing to keep in step.
 * - the id is checked against the resolved path, not the string (see
 *   `resolveNotePath`).
 *
 * The states are separate because the reader has to tell them apart: a note
 * that is missing, a note that is empty, a format we cannot show and an
 * error are four different sentences, and collapsing them into "nichts da"
 * is the failure V2 exists to avoid.
 */

/** Above this, the note is sent truncated and says so. */
const MAX_BYTES = 400_000;

const FORMATS: Record<string, "markdown" | "text"> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "text",
  ".csv": "text",
  ".json": "text",
  ".yaml": "text",
  ".yml": "text",
};

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ ok: false, reason: "missing-id" }, { status: 400 });
  }

  const target = resolveNotePath(id);
  if (!target) {
    return NextResponse.json({ ok: false, reason: "outside-vault" }, { status: 400 });
  }

  const extension = path.extname(target).toLowerCase();
  const format = FORMATS[extension];

  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) {
      return NextResponse.json({ ok: false, reason: "not-a-file" }, { status: 404 });
    }

    if (!format) {
      // Honest rather than empty: the note exists, we simply cannot show this
      // kind of file yet, and saying which kind is what makes it a known gap
      // instead of a bug.
      return NextResponse.json({
        ok: true,
        id,
        format: "unsupported",
        extension,
        bytes: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    }

    const raw = await fs.readFile(target, "utf8");
    const truncated = Buffer.byteLength(raw, "utf8") > MAX_BYTES;
    const content = truncated ? raw.slice(0, MAX_BYTES) : raw;

    return NextResponse.json({
      ok: true,
      id,
      format,
      content,
      truncated,
      bytes: stat.size,
      mtimeMs: stat.mtimeMs,
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ ok: false, reason: "not-found", id }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, reason: "read-failed", detail: code ?? "unknown" },
      { status: 500 },
    );
  }
}
