import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Retrieval over the vault: which notes actually answer a question.
 *
 * This is the half of "ask my second brain" that has to be right before any
 * model is involved. A language model given the wrong six notes writes a
 * confident wrong answer; given the right six it mostly cannot go wrong. So
 * this endpoint does one job and returns evidence rather than prose — the
 * ranked notes, why each scored, and the excerpt that matched.
 *
 * It is deliberately self-contained: it reads the vault directly rather than
 * going through QMD, whose semantic search has been timing out. Lexical
 * scoring over 255 notes is a few milliseconds, needs no index to stay warm,
 * and cannot silently return nothing because a service is down.
 */

export const dynamic = "force-dynamic";

const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH?.trim() ||
  path.join(os.homedir(), "Desktop", "Life OS");

const MAX_NOTE_CHARS = 512 * 1024;

/**
 * German and English filler. Without this, "wie ist der Stand von X" ranks
 * every note containing "ist" and buries the one about X.
 */
const STOPWORDS = new Set([
  "der","die","das","den","dem","des","ein","eine","einer","eines","einem","einen",
  "und","oder","aber","auch","als","am","an","auf","aus","bei","bis","für","hat",
  "ich","ihr","im","in","ist","mit","nach","nicht","noch","von","vom","vor","was",
  "wie","wo","wann","warum","wer","wird","werden","zu","zum","zur","über","mein",
  "meine","meinem","meinen","meiner","sich","sind","sein","seine","soll","kann",
  "the","and","for","with","that","this","from","have","has","was","are","you",
  "your","what","when","where","how","why","who","its","it","of","to","in","on",
  "a","an","is","be","or","at","as","by",
]);

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9äöüß]+/i)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

/**
 * A poor man's stemmer: two words count as the same if one begins with the
 * other and the shared prefix is long enough to mean something.
 *
 * German makes this necessary rather than nice. "Router" has to find
 * "Routing-Policy", "Bewerbung" has to find "Bewerbungen", "Projekt" has to
 * find "Projektübersicht". Without it the search only answers questions
 * phrased in exactly the words the note happens to use, which is the one thing
 * a search is supposed to spare you.
 */
function sharesStem(words: Set<string>, term: string) {
  if (term.length < 4) return false;
  for (const word of words) {
    if (word.length < 4) continue;
    const shorter = word.length < term.length ? word : term;
    const longer = word.length < term.length ? term : word;
    // Only accept a prefix match when the shorter word is most of the longer
    // one; otherwise "Sein" would match "Seitenleiste".
    if (longer.startsWith(shorter) && shorter.length >= Math.min(4, longer.length - 4)) {
      return true;
    }
  }
  return false;
}

const SKIP_DIRS = new Set([".obsidian", ".git", ".trash", "_Anhänge", "node_modules"]);

function collectNotes(dir: string, base: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectNotes(full, base, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/** Strips YAML frontmatter so `status: entwurf` does not become a match. */
function stripFrontmatter(content: string) {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  return end === -1 ? content : content.slice(end + 4);
}

/** The sentence around the strongest hit, so the evidence is readable. */
function excerptAround(body: string, terms: string[], length = 320) {
  const lower = body.toLowerCase();
  let best = -1;
  for (const term of terms) {
    const at = lower.indexOf(term);
    if (at !== -1 && (best === -1 || at < best)) best = at;
  }
  if (best === -1) return body.trim().slice(0, length);
  const start = Math.max(0, best - Math.floor(length / 3));
  return (start > 0 ? "… " : "") + body.slice(start, start + length).trim() + " …";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 6)));

  if (!query) {
    return NextResponse.json({ ok: false, reason: "Keine Frage übergeben.", results: [] });
  }

  const terms = tokenize(query);
  if (terms.length === 0) {
    return NextResponse.json({
      ok: false,
      reason: "Die Frage besteht nur aus Füllwörtern — bitte konkreter fragen.",
      results: [],
    });
  }

  try {
    const files = collectNotes(VAULT_PATH, VAULT_PATH);

    /**
     * How rare each query term is across the vault, and therefore how much a
     * hit on it is worth.
     *
     * Without this the search is at the mercy of whichever words the question
     * happens to contain. "Was denke ich über Religion" put a note titled "Wie
     * wir denken, so leben wir" above "07 Religion & Glaube", because both
     * scored a title hit and "denken" is in half the vault while "Religion" is
     * in a handful. Rarity is what separates the word the question is about
     * from the words it is merely made of — and it does the job a hand-written
     * stopword list only approximates.
     */
    const documentFrequency = new Map(terms.map((term) => [term, 0]));
    const bodies = files.map((file) => {
      const raw = fs.readFileSync(file, "utf8");
      const text = (raw.length > MAX_NOTE_CHARS ? raw.slice(0, MAX_NOTE_CHARS) : raw).toLowerCase();
      const name = path.basename(file, ".md").toLowerCase();
      terms.forEach((term) => {
        if (text.includes(term) || name.includes(term)) {
          documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
        }
      });
      return raw;
    });
    const total = Math.max(1, files.length);
    const weightOf = (term: string) => {
      const seen = documentFrequency.get(term) ?? 0;
      // Never below 0.05, so a common word still counts for something rather
      // than dropping a note that is otherwise a perfect match.
      return Math.max(0.05, Math.log((total + 1) / (seen + 1)));
    };

    const scored = files.map((file, fileIndex) => {
      const relPath = path.relative(VAULT_PATH, file).split(path.sep).join("/");
      const title = path.basename(file, ".md");
      const folder = relPath.includes("/") ? relPath.split("/")[0] : "(root)";
      const raw = bodies[fileIndex];
      const body = stripFrontmatter(raw.length > MAX_NOTE_CHARS ? raw.slice(0, MAX_NOTE_CHARS) : raw);

      const titleWords = new Set(tokenize(title));
      const folderWords = new Set(tokenize(folder));
      const bodyLower = body.toLowerCase();

      let score = 0;
      const matched: string[] = [];
      for (const term of terms) {
        const weight = weightOf(term);
        // A title hit is the strongest signal a note can give: it is the
        // author saying what the note is about. An exact word counts for more
        // than a shared stem, because "Werte" naming a note is a stronger
        // claim than "wichtig" resembling "Wichtige".
        if (titleWords.has(term)) {
          score += 14 * weight;
          matched.push(term);
          continue;
        }
        if (sharesStem(titleWords, term)) {
          score += 7 * weight;
          matched.push(term);
          continue;
        }
        if (folderWords.has(term) || sharesStem(folderWords, term)) {
          score += 4 * weight;
          matched.push(term);
          continue;
        }
        const occurrences = bodyLower.split(term).length - 1;
        if (occurrences > 0) {
          // Diminishing returns: a note that says a word forty times is not
          // forty times more relevant than one that says it twice.
          score += Math.min(6, 1 + Math.log2(occurrences)) * weight;
          matched.push(term);
        }
      }
      // Coverage matters more than raw frequency — a note touching every term
      // of the question beats one that hammers a single term.
      const coverage = matched.length / terms.length;
      score *= 0.5 + coverage;

      // Length normalisation, or the vault's journal wins every question.
      // `Log.md` runs to seven thousand lines and mentions nearly everything,
      // so without this it outranked "07 Religion & Glaube" on religion and
      // the routing reference on routing. A long note that happens to contain
      // a word is weaker evidence than a short one written about it.
      const focusPenalty = 1 + Math.max(0, Math.log10(Math.max(1, body.length) / 2500));
      score /= focusPenalty;

      return { relPath, title, folder, score, matched, body };
    });

    const results = scored
      .filter((note) => note.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((note) => ({
        id: note.relPath,
        title: note.title,
        folder: note.folder,
        score: Number(note.score.toFixed(2)),
        matchedTerms: note.matched,
        excerpt: excerptAround(note.body, note.matched),
      }));

    return NextResponse.json({
      ok: true,
      query,
      terms,
      searched: files.length,
      results,
      // Said plainly rather than answered with an empty list, which reads as
      // "nothing exists" instead of "nothing matched".
      reason:
        results.length === 0
          ? `Keine der ${files.length} Notizen enthält ${terms.join(", ")}.`
          : undefined,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      results: [],
      reason: `Vault nicht lesbar: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
