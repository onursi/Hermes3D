/**
 * Whether a keyboard event is someone writing text rather than pressing a
 * shortcut.
 *
 * Every global key handler in this app is a trap for the same bug: the room
 * listens on `window`, so a shortcut fires even while the cursor sits in a
 * search field or a Kanban card. Space is the worst of them — it is both the
 * most useful shortcut here and the most common character in a sentence, so a
 * handler that takes it makes text entry silently impossible. That is exactly
 * what happened in the vault search and on the Kanban board.
 *
 * One shared question, asked before any handler acts, instead of the same
 * check written five slightly different ways.
 */
export function isTypingTarget(event: Pick<KeyboardEvent, "target">): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    // Checkboxes and buttons are typed *at*, not typed *into* — Space is
    // meant to toggle them, and the browser already does that.
    const type = (target as HTMLInputElement).type;
    return type !== "checkbox" && type !== "radio" && type !== "button" && type !== "submit";
  }
  return false;
}
