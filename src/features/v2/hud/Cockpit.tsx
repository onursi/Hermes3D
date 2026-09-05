"use client";

import { useCallback } from "react";

import { AREA_COLORS, DISTANT_TINT, SELECTION_COLOR } from "@/features/v2/palette";
import type { MarkerRegistry } from "@/features/v2/universe/CockpitProjector";
import type { Place } from "@/features/v2/universe/places";

/**
 * Das Cockpit — und es ist eine Funktion, keine Verzierung.
 *
 * Der Plan erlaubt „optionales leichtes Cockpit" und verbietet im selben Satz,
 * die Welt hinter einer Instrumentenmaske zu verstecken. Das entscheidet, was
 * hier steht: **kein Armaturenbrett, sondern ein Kompass.**
 *
 * Der Grund ist praktisch. Im freien Flug kann man sich verlieren — man dreht
 * sich zweimal und weiß nicht mehr, wo Zuhause liegt. Vorher war die einzige
 * Antwort darauf der Knopf „Heimkehr", also Aufgeben. Jetzt trägt jeder Ort
 * eine Markierung mit Entfernung, und was aus dem Bild läuft, klebt am Rand
 * und zeigt weiter dorthin. Man kann die Bibliothek nicht mehr verlieren.
 *
 * Die Zahlen setzt `CockpitProjector` direkt in diese Elemente — ohne React
 * dazwischen. Deshalb steht hier nur, wie ein Marker aussieht, und nie, wo er
 * gerade ist.
 */

const KIND_COLOUR: Record<string, string> = {
  cosmos: AREA_COLORS["07🧠Wissen"],
  library: AREA_COLORS["08📚Quellen"],
  project: AREA_COLORS["05 🚀 Projekte"],
  home: DISTANT_TINT,
};

export function Cockpit({
  places,
  markers,
  reachableId,
}: {
  places: Place[];
  /** Wird hier gefüllt und in der Canvas gelesen. */
  markers: React.MutableRefObject<MarkerRegistry>;
  reachableId: string | null;
}) {
  const attach = useCallback(
    (id: string) => (root: HTMLDivElement | null) => {
      if (!root) {
        markers.current.delete(id);
        return;
      }
      const distance = root.querySelector<HTMLElement>("[data-distance]");
      if (distance) markers.current.set(id, { root, distance });
    },
    [markers],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* Der Rahmen: vier kurze Winkel und ein weicher Rand. Mehr wäre eine
          Maske, und die Welt ist das, was man sehen soll. */}
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_58%,rgba(0,0,0,0.55)_100%)]" />
      {[
        "left-6 top-6 border-l border-t",
        "right-6 top-6 border-r border-t",
        "left-6 bottom-6 border-l border-b",
        "right-6 bottom-6 border-r border-b",
      ].map((corner) => (
        <span key={corner} className={`absolute h-7 w-7 border-white/12 ${corner}`} />
      ))}

      {/* Ein Fadenkreuz, so klein wie möglich: es sagt, wohin man fliegt. */}
      <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/18" />
      <span className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-white/18" />

      {places.map((place) => {
        const highlighted = place.id === reachableId;
        const colour = highlighted ? SELECTION_COLOR : (KIND_COLOUR[place.kind] ?? DISTANT_TINT);
        return (
          <div
            key={place.id}
            ref={attach(place.id)}
            data-off="0"
            // `group/marker` und `data-off`: am Rand wird der Marker zum Pfeil,
            // im Bild bleibt er ein Ring. Beides derselbe Knoten, damit nichts
            // beim Übergang neu angelegt werden muss.
            className="group/marker absolute left-0 top-0 flex items-center gap-1.5 will-change-transform"
          >
            <span
              className="block h-2.5 w-2.5 rotate-45 border group-data-[off='0']/marker:rounded-full group-data-[off='0']/marker:rotate-0"
              style={{ borderColor: colour }}
            />
            <span
              className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em]"
              style={{ color: colour, opacity: highlighted ? 1 : 0.62 }}
            >
              {place.name}
              <span className="ml-1 text-white/35">
                <span data-distance>—</span> E
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
