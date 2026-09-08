/**
 * Ansprüche — was gerade tatsächlich etwas von Onur will.
 *
 * Der Hermes-Kern kannte bisher genau ein Bit: `approvalsWaiting > 0`. Hier
 * kommt der Rest her. Und zwar nach Regeln, die Onur am 2026-09-08 selbst
 * gesetzt hat — sie sind der Grund, warum diese Datei existiert und nicht
 * einfach „alles Offene" angezeigt wird.
 *
 * **Regel 1 — nur hohe Priorität und heute fällig.** Onur: „In die Kugel
 * gehört nur etwas, wenn etwas eine hohe Priorität hat und heute anfällig
 * ist." Alles andere ist kein Anspruch, sondern eine Liste, und Listen gehören
 * nicht um einen Kern zu kreisen.
 *
 * **Regel 2 — Überfälligkeit hebt eine Stufe.** Meine Ergänzung, gemessen
 * begründet: Am 2026-09-08 waren zwei Aufgaben von gestern offen, davon eine
 * nur p2. Bei reiner p1-Filterung wäre ausgerechnet das durchgerutscht, was
 * schon einmal liegengeblieben ist.
 *
 * **Regel 3 — Undatiertes taucht nie auf.** Das ist die wichtigste und die,
 * die man am leichtesten falsch macht. Onur lässt Aufgaben *absichtlich* ohne
 * Datum: „um bewusst keinen Druck auszulösen, weil ich neige dazu, mir zu viel
 * vorzunehmen für einen einzelnen Tag. Und wenn ich das dann nicht schaffe,
 * dann beende ich den Tag mit einem negativen Gefühl." Am 2026-09-08 waren das
 * 11 von 31 Aufgaben. Sie als Zähler, Rückstand oder auch nur als Hinweis zu
 * zeigen, baut genau den Druck wieder auf, den er sich abgewöhnt hat.
 *
 * **Regel 4 — wer nicht am Zug ist, erzeugt keinen Anspruch.** Eine Frist, bei
 * der `am_zug: andere` steht, ist kein Versäumnis. Die Hadsch ist der Fall,
 * an dem das hängt: bezahlt, Visum bei den Behörden, Nichtstun ist richtig.
 *
 * Jeder Anspruch trägt seine **Herkunft** und einen **gemessenen Grund**.
 * Nichts hier schätzt, gewichtet nach Gefühl oder erfindet Dringlichkeit.
 */

export type ClaimKind = "aufgabe" | "freigabe" | "frist";

export type Claim = {
  /** Eindeutig und rückverfolgbar — der Körper im Raum muss zum Ursprung führen. */
  id: string;
  kind: ClaimKind;
  title: string;
  /** Woher er stammt, im Klartext: „Todoist · Inbox", „Vault · Ziele". */
  source: string;
  /** Wohin der Klick führt, falls es einen Ort gibt. */
  href?: string;
  /** Lag der Termin vor heute? */
  overdue: boolean;
  /**
   * Warum dieser Anspruch hier ist — aus den Daten abgeleitet, nicht getextet.
   * Steht am Körper, damit nie unklar ist, wieso etwas den Kern umkreist.
   */
  reason: string;
};

/** Was der Kern über seine Quellen weiß. „Unbekannt" ist nicht „null". */
export type SourceState = "verbunden" | "nicht verbunden" | "fehler";

export type ClaimResult = {
  claims: Claim[];
  sources: Record<string, { state: SourceState; note?: string }>;
};

export type TodoistTask = {
  id: string;
  content: string;
  /** Todoist zählt umgekehrt: 4 = p1 (höchste), 1 = p4 (keine). */
  priority: number;
  dueDate?: string | null;
  projectName?: string | null;
};

/** Tagesdatum in der Zeitzone des Betrachters, nicht in UTC. */
export function heute(now = new Date()): string {
  const z = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

const STUFE: Record<number, string> = { 4: "p1", 3: "p2", 2: "p3", 1: "p4" };

/**
 * Die Auswahl aus Todoist.
 *
 * `stufe = priority + (überfällig ? 1 : 0)`, aufgenommen ab 4. Damit gilt:
 * p1 heute ✓ · p1 überfällig ✓ · p2 überfällig ✓ · p2 heute ✗ · alles ohne
 * Datum ✗. Eine Zeile Regel statt einer Tabelle Sonderfälle.
 */
export function claimsFromTodoist(tasks: TodoistTask[], tag = heute()): Claim[] {
  const out: Claim[] = [];
  for (const task of tasks) {
    const due = task.dueDate?.slice(0, 10);
    if (!due) continue; // Regel 3 — bewusst undatiert, niemals ein Anspruch
    if (due > tag) continue; // liegt in der Zukunft
    const overdue = due < tag;
    if (task.priority + (overdue ? 1 : 0) < 4) continue; // Regel 1 und 2

    out.push({
      id: `todoist:${task.id}`,
      kind: "aufgabe",
      title: task.content,
      source: `Todoist · ${task.projectName || "Inbox"}`,
      overdue,
      reason: overdue
        ? `${STUFE[task.priority] ?? "?"}, fällig war ${due}`
        : `${STUFE[task.priority] ?? "?"}, heute fällig`,
    });
  }
  // Liegengebliebenes zuerst, danach das Ältere.
  return out.sort((a, b) => Number(b.overdue) - Number(a.overdue));
}

export type WorldObjectLike = {
  id: string;
  kind: string;
  title: string;
  due?: string;
  waiting?: string;
};

/**
 * Fristen aus dem Vault — aber nur die, bei denen Onur selbst am Zug ist.
 *
 * `horizontTage` ist bewusst kurz. Eine Frist in zwei Jahren ist kein Anspruch,
 * sie ist ein Horizont; die gehört in die stille Zeile des Kerns, nicht in die
 * Schale.
 */
export function claimsFromWorlds(
  objects: WorldObjectLike[],
  tag = heute(),
  horizontTage = 14,
): Claim[] {
  const grenze = new Date(tag);
  grenze.setDate(grenze.getDate() + horizontTage);
  const bis = grenze.toISOString().slice(0, 10);

  const out: Claim[] = [];
  for (const o of objects) {
    if (!o.due) continue;
    if (o.waiting && o.waiting !== "ich") continue; // Regel 4
    // Der Vault kennt auch grobe Fristen wie „2027" oder „2027-06".
    const due = o.due.length === 4 ? `${o.due}-12-31` : o.due.length === 7 ? `${o.due}-28` : o.due;
    if (due > bis) continue;
    const overdue = due < tag;
    out.push({
      id: `vault:${o.id}`,
      kind: "frist",
      title: o.title,
      source: "Vault · Ziele und Projekte",
      href: o.id,
      overdue,
      reason: overdue ? `Frist ${o.due} verstrichen` : `Frist ${o.due}, du bist am Zug`,
    });
  }
  return out;
}

export function claimsFromApprovals(count: number): Claim[] {
  if (count <= 0) return [];
  return [
    {
      id: "approvals",
      kind: "freigabe",
      title: count === 1 ? "Eine Freigabe wartet" : `${count} Freigaben warten`,
      source: "Hermes · Freigaben",
      overdue: false,
      reason: "wartet auf deine Entscheidung",
    },
  ];
}
