import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * Onurs Zeitstrahl, so wie er im Vault steht.
 *
 * Der Erinnerungsorbit war in den Entwürfen ein Saturn mit Ringen namens
 * "Babyjahre", "Kindheit", "Jugend" — und darin Einträge wie `["2005",
 * "Sommer"]`, von Hand getippt. Das sieht schön aus und ist erfunden: kein
 * einziger dieser Sommer steht irgendwo in seinem Vault.
 *
 * Er hat aber einen echten Zeitstrahl. In `04📖 Lebensprofil` stehen zwanzig
 * Notizen, und in ihnen Abschnitte, die mit einer Jahreszahl überschrieben
 * sind: `## 1997`, `## 2007–2013`, `## 01.08.2023`. Darunter steht, was in
 * dieser Zeit passiert ist — von ihm geschrieben, nicht von mir.
 *
 * Diese Route liest genau das. Sie erfindet keine Station, sie füllt keine
 * Lücke, und wo kein Jahr steht, entsteht kein Punkt. Ein Leben mit Löchern
 * ist die Wahrheit; ein lückenlos schöner Orbit wäre eine Erfindung.
 *
 * Nur lesend, wie alles in V2. Diese Notizen sind als "persönlich" markiert —
 * sie bleiben auf diesem Rechner, gehen an keinen Dienst und werden hier
 * nicht zusammengefasst, sondern durchgereicht.
 */

const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH?.trim() || path.join(os.homedir(), "Desktop", "Life OS");

/** Der Ordner, in dem das Leben steht. */
const LIFE_DIR = "04📖 Lebensprofil";

/**
 * Eine Überschrift mit Jahr.
 *
 * Erlaubt ist, was er tatsächlich schreibt: `## 1997`, `## 1997–2008`,
 * `## ca. 2008`, `## 01.08.2023`, `## Februar 2025`, `## 2026-08-07`. Die
 * Zahl selbst wird danach herausgezogen; die Überschrift bleibt als Titel
 * unverändert stehen, weil "ca. 2008" etwas anderes heißt als "2008".
 */
const HEADING = /^(#{2,3})\s+(.+?)\s*$/;
const YEAR = /\b(19\d{2}|20\d{2})\b/;
/** Eine zweite Jahreszahl im selben Titel: eine Spanne. */
const SPAN = /\b(19\d{2}|20\d{2})\s*[–—-]\s*(19\d{2}|20\d{2})\b/;

/** Wie viel Text je Station mitkommt. Genug für einen Abschnitt, nicht mehr. */
const MAX_TEXT = 1600;

export type TimelineStation = {
  id: string;
  /** Die Überschrift, wie sie dasteht. */
  title: string;
  /** Das Jahr, an dem die Station hängt. */
  year: number;
  /** Das Endjahr, wenn die Überschrift eine Spanne nennt. */
  until: number | null;
  /** Der Text darunter, roh. */
  text: string;
  /** Aus welcher Notiz das kommt — nachprüfbar, nicht nur behauptet. */
  source: string;
  /** Länge des Abschnitts in Zeichen. Der Orbit macht daraus die Größe. */
  weight: number;
};

export async function GET() {
  const dir = path.join(VAULT_PATH, LIFE_DIR);
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".md"));
  } catch {
    // "Nicht erreichbar" ist etwas anderes als "kein Zeitstrahl". Der Raum
    // muss den Unterschied zeigen können, also sagt die Route ihn.
    return NextResponse.json(
      { ok: false, reachable: false, stations: [], reason: `${LIFE_DIR} nicht lesbar.` },
      { status: 200 },
    );
  }

  const stations: TimelineStation[] = [];

  for (const file of files.sort()) {
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(dir, file), "utf8");
    } catch {
      continue;
    }

    const lines = raw.split(/\r?\n/);
    let current: { title: string; year: number; until: number | null; body: string[] } | null = null;
    let inFence = false;

    const flush = () => {
      if (!current) return;
      // Codeblöcke sind schon draußen, aber Trennstriche und leere Zeilen
      // stehen noch drin — die tragen nichts und kosten Platz im Panel.
      const text = current.body
        .join("\n")
        .replace(/^---+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (text.length > 0) {
        stations.push({
          // Der laufende Zähler gehört dazu: sein Zeitstrahl hat **zweimal**
          // `## 2020`, und ohne ihn tragen beide Stationen dieselbe Kennung.
          // React hat das sofort gemeldet, und es wäre nicht bei einer Warnung
          // geblieben — zwei Erinnerungen mit einem Namen sind eine, die die
          // andere verdeckt.
          id: `${file}#${stations.length}#${current.title}`,
          title: current.title,
          year: current.year,
          until: current.until,
          text: text.slice(0, MAX_TEXT),
          source: `${LIFE_DIR}/${file}`,
          weight: text.length,
        });
      }
      current = null;
    };

    for (const line of lines) {
      // Mermaid- und Codeblöcke gehören nicht in eine Erinnerung. Der
      // Zeitstrahl enthält ein Flussdiagramm, und dessen Quelltext als
      // "Erinnerung" anzuzeigen wäre schlicht falsch.
      if (/^```/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      const heading = line.match(HEADING);
      if (heading) {
        flush();
        const title = heading[2];
        const span = title.match(SPAN);
        const single = title.match(YEAR);
        if (span) {
          current = {
            title,
            year: Number(span[1]),
            until: Number(span[2]),
            body: [],
          };
        } else if (single) {
          current = { title, year: Number(single[1]), until: null, body: [] };
        }
        // Eine Überschrift ohne Jahr beendet den vorigen Abschnitt und
        // beginnt keinen neuen. "Lebensstationen auf einen Blick" ist eine
        // Zwischenüberschrift, keine Station.
        continue;
      }

      if (current) current.body.push(line);
    }
    flush();
  }

  // Nach Jahr, dann nach Quelle: zwei Stationen im selben Jahr sollen in
  // stabiler Reihenfolge stehen und nicht bei jedem Aufruf tauschen.
  stations.sort((a, b) => a.year - b.year || a.source.localeCompare(b.source));

  return NextResponse.json({
    ok: true,
    reachable: true,
    stations,
    // Die Spanne, damit der Raum sie nicht selbst raten muss.
    from: stations[0]?.year ?? null,
    to: stations[stations.length - 1]?.year ?? null,
  });
}
