/** Lets Jarvis show something in a visible browser window. He can open searches, never submit, buy or sign in. */
export const BROWSER_KINDS = ["search", "maps", "youtube", "close"] as const;
export type BrowserKind = typeof BROWSER_KINDS[number];

export const browserDeclaration = {
  name: "show_in_browser",
  description: "Etwas sichtbar neben dir im Bild von Boss öffnen: search für eine Websuche, maps für Orte, Restaurants oder Läden, youtube für Videos, close zum Schließen (query dann leer lassen). Öffnet nur eine Suchseite. Kann nichts anklicken, bestellen, kaufen oder absenden.",
  parameters: { type: "OBJECT", properties: { kind: { type: "STRING", enum: [...BROWSER_KINDS] }, query: { type: "STRING" } }, required: ["kind"] },
};

/** The only addresses the tool can produce: fixed search pages with the encoded query. */
export function browserUrl(kind: unknown, query: unknown) {
  if (typeof query !== "string" || !BROWSER_KINDS.includes(kind as BrowserKind)) return null;
  const text = query.replace(/\s+/g, " ").trim().slice(0, 160);
  if (text.length < 2) return null;
  const q = encodeURIComponent(text);
  return kind === "maps" ? `https://www.google.com/maps/search/${q}` : kind === "youtube" ? `https://www.youtube.com/results?search_query=${q}` : `https://www.google.com/search?q=${q}`;
}

/** The same fixed searches in the form Google allows inside a frame, for the panel beside the head. */
export function browserEmbedUrl(kind: unknown, query: unknown) {
  if (kind === "close" || !browserUrl(kind, query)) return null;
  const q = encodeURIComponent((query as string).replace(/\s+/g, " ").trim().slice(0, 160));
  // Google's plain map frame only knows addresses; its search page shows places with map, ratings and opening hours.
  return `https://www.google.com/search?igu=1${kind === "youtube" ? "&tbm=vid" : ""}&q=${q}`;
}

/** A place name typed by the user, reduced to plain characters before it enters the prompt. */
export const readPlace = (value: unknown) => typeof value === "string" ? value.replace(/[^\p{L}\p{N} ,.-]/gu, "").trim().slice(0, 60) : "";

/** grounded: Google Search answers are available to the model (needs a paid Gemini quota). */
export function browserInstruction(place: string, grounded = false) {
  return ` Der Browser ist freigegeben. ${grounded ? "Für aktuelle Fakten wie Wetter, Öffnungszeiten, Orte oder Preise nutze die Google-Suche und nenne nur, was sie wirklich liefert. Wenn Boss einen Vorschlag will, etwa wo er essen soll, such zuerst bei Google, nenne dann genau einen Ort mit Namen und einem kurzen Grund aus den Treffern, und ruf danach show_in_browser mit genau diesem Namen und dem Ort auf." : "Du hast keine eigene Websuche und siehst den Inhalt des Browserfensters nicht. Nenne deshalb keine Suchergebnisse, Namen, Preise, Bewertungen oder Öffnungszeiten, die du nicht kennst; sag, dass die Treffer jetzt neben dir im Bild liegen, und frag, was er davon nimmt."} Wenn Boss etwas sehen will oder du etwas Konkretes vorschlägst, rufe show_in_browser auf, damit es groß neben dir im Bild erscheint: maps für Essen, Läden und Orte, youtube für Videos, sonst search. Wenn Boss sagt mach zu, weg damit oder danke, rufe show_in_browser mit close auf. Sag in einem kurzen Satz, was du geöffnet hast. Du kannst nichts anklicken, bestellen, kaufen, bezahlen oder absenden und behauptest das auch nie. Wenn Boss etwas bestellen will, öffne die passende Suche, mach einen Vorschlag und sag, dass er den letzten Schritt selbst macht.${place ? ` Boss hat als Ort für Suchen in der Nähe angegeben: ${place}. Nutze ihn nur für solche Suchen.` : " Du kennst seinen Standort nicht; frag bei Suchen in der Nähe nach dem Ort oder nutze die Kartensuche mit in der Nähe."}`;
}
