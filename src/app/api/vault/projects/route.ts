import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * The projects, as the vault actually has them.
 *
 * The room already floats projects in orbit, but it took them from Todoist,
 * where a project is a name and a count of open tasks. Onur's real projects
 * live in `05 🚀 Projekte` as folders of notes — architecture, decisions,
 * handovers, backlogs — and that is what he means when he says a galaxy is
 * something he travels to. A destination needs somewhere to arrive.
 *
 * Everything reported here is read off disk. Nothing is estimated, and a
 * project with no open tasks says zero rather than borrowing a number from
 * somewhere that sounds plausible.
 */

const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH?.trim() ||
  path.join(os.homedir(), "Desktop", "Life OS");

const PROJECTS_DIR = "05 🚀 Projekte";

/**
 * Folders that are not projects.
 *
 * "00 Übersicht" is an index of the others, so orbiting it beside them would
 * put the map inside the territory.
 */
const NOT_A_PROJECT = new Set(["00 Übersicht"]);

/** Checkbox lines, the way Obsidian writes them. */
const OPEN_TASK = /^\s*[-*]\s+\[ \]\s+/gm;
const DONE_TASK = /^\s*[-*]\s+\[[xX]\]\s+/gm;

/** How many characters of a note to read when counting tasks. */
const MAX_NOTE_CHARS = 256 * 1024;

export type VaultProjectNote = {
  title: string;
  /** Vault-relative, forward-slashed, so the client can ask to open it. */
  path: string;
  modified: string;
};

export type VaultProject = {
  name: string;
  /** The folder name as it sits on disk, prefix and all. */
  folder: string;
  noteCount: number;
  openTasks: number;
  doneTasks: number;
  /** ISO timestamp of the most recently touched note, or null when empty. */
  lastTouched: string | null;
  /** The handful of notes touched most recently — what you would open first. */
  recentNotes: VaultProjectNote[];
};

const countMatches = (text: string, pattern: RegExp): number => {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(text) !== null) count += 1;
  return count;
};

/**
 * `01 Hermes Agent OS` reads as `Hermes Agent OS`.
 *
 * The numbers exist to order folders in Obsidian's sidebar. In space they
 * would just be noise on a label, and the ordering is carried by the data.
 */
const displayName = (folder: string): string =>
  folder.replace(/^\d+\s*[-–—.]?\s*/, "").trim() || folder;

const collectNotes = (dir: string, out: string[]): void => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectNotes(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) out.push(full);
  }
};

const readProject = (projectsRoot: string, folder: string): VaultProject => {
  const projectDir = path.join(projectsRoot, folder);
  const files: string[] = [];
  collectNotes(projectDir, files);

  let openTasks = 0;
  let doneTasks = 0;
  let newest = 0;
  const notes: VaultProjectNote[] = [];

  for (const file of files) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    const modifiedMs = stat.mtimeMs;
    if (modifiedMs > newest) newest = modifiedMs;

    // Reading every note of every project on every request is fine at this
    // size — 35 notes across six folders — and it means the numbers are never
    // a cached guess. Revisit if the vault grows an order of magnitude.
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8").slice(0, MAX_NOTE_CHARS);
    } catch {
      // A note that cannot be read still counts as a note; it just cannot
      // contribute tasks. Silently dropping it would understate the project.
    }
    openTasks += countMatches(text, OPEN_TASK);
    doneTasks += countMatches(text, DONE_TASK);

    notes.push({
      title: path.basename(file, ".md"),
      path: path.relative(VAULT_PATH, file).split(path.sep).join("/"),
      modified: new Date(modifiedMs).toISOString(),
    });
  }

  notes.sort((a, b) => b.modified.localeCompare(a.modified));

  return {
    name: displayName(folder),
    folder,
    noteCount: files.length,
    openTasks,
    doneTasks,
    lastTouched: newest > 0 ? new Date(newest).toISOString() : null,
    recentNotes: notes.slice(0, 6),
  };
};

export async function GET() {
  const projectsRoot = path.join(VAULT_PATH, PROJECTS_DIR);

  let folders: string[];
  try {
    folders = fs
      .readdirSync(projectsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .filter((name) => !NOT_A_PROJECT.has(name));
  } catch (error) {
    // An unreachable vault is reported as unreachable. The room draws no
    // planets in that case, which is the honest picture — a sky invented
    // from a fallback list would be indistinguishable from a real one.
    return NextResponse.json(
      {
        projects: [],
        reachable: false,
        error: error instanceof Error ? error.message : "Vault nicht lesbar",
        vaultPath: projectsRoot,
      },
      { status: 200 },
    );
  }

  const projects = folders
    .map((folder) => readProject(projectsRoot, folder))
    .sort((a, b) => b.noteCount - a.noteCount);

  return NextResponse.json({ projects, reachable: true, vaultPath: projectsRoot });
}
