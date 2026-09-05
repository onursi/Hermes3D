import os from "node:os";
import path from "node:path";

/**
 * Where the vault is. One answer, for every route that needs one.
 *
 * `/api/obsidian-graph` worked this out for itself, and the note reader needs
 * exactly the same answer — if the two ever disagreed, the graph would offer
 * notes the reader could not find, and the failure would look like a missing
 * file rather than a mismatched root. So the rule lives here and both import
 * it.
 *
 * `OBSIDIAN_VAULT_PATH` overrides. The fallback is a convenience for the
 * common layout, not a claim about anyone's machine.
 */
export const VAULT_ROOT =
  process.env.OBSIDIAN_VAULT_PATH?.trim() || path.join(os.homedir(), "Desktop", "Life OS");

/**
 * Turn a note id into an absolute path, or refuse.
 *
 * The graph's ids are vault-relative paths, and they arrive here from the
 * browser — which means they are input, not data. `..`, an absolute path, a
 * drive letter or a symlink-shaped detour must not reach `readFile`, so the
 * check is done on the *resolved* path rather than on the string: normalising
 * first and comparing afterwards is what makes "05/../../../etc/passwd"
 * fail instead of quietly working.
 *
 * Returns null when the id escapes the vault. The caller answers 400.
 */
export function resolveNotePath(id: string): string | null {
  if (!id || id.includes("\0")) return null;
  if (path.isAbsolute(id)) return null;

  const root = path.resolve(VAULT_ROOT);
  const target = path.resolve(root, id);

  // `startsWith(root)` alone would accept a sibling directory whose name
  // begins with the root's name. The separator is the whole point.
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}
