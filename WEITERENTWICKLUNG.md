# Weiterentwicklung durch Onur Sinoplu

> Dieses Repository ist ein Fork von [iamlukethedev/Hermes3D](https://github.com/iamlukethedev/Hermes3D).
> Der 3D-Raum, das Gateway und die Agentenverwaltung stammen aus dem Ursprungsprojekt.
> Diese Seite beschreibt ausschließlich, was ich darauf aufgebaut habe.

Ziel des Forks: aus einem 3D-Büro für KI-Agenten ein **persönliches Betriebssystem** machen — eines, das meinen Wissensspeicher kennt, Fragen daraus beantwortet und Antworten belegen kann.

---

## Jarvis — Fragen an den eigenen Wissensspeicher

Ein Assistent, der ausschließlich aus meinen 259 Obsidian-Notizen antwortet und jede Aussage mit einer Quelle belegt.

**Eigene Seite** (`/jarvis`) mit dem Wissensgraphen links und dem Assistenten rechts.

**Suche.** Bewertet Notizen nach Titel-, Ordner- und Volltexttreffern. Drei Eigenschaften, die in drei Durchgängen entstanden sind, weil die jeweils vorherige Version falsch rankte:

- **Längennormalisierung** — ohne sie gewann `Log.md` mit 7.000 Zeilen jede Frage, weil es fast alles einmal erwähnt.
- **Seltenheitsgewichtung (IDF)** — „Was denke ich über Religion" setzte eine Notiz namens „Wie wir denken, so leben wir" über „07 Religion & Glaube", weil „denken" in der halben Sammlung vorkommt und „Religion" in einer Handvoll.
- **Exakt vor Wortstamm im Titel** — ein Titel, der ein Wort *nennt*, ist eine stärkere Aussage als einer, der ihm ähnelt.

**Antwort.** Die sechs bestbewerteten Notizen gehen als Ausschnitte an das Modell, mit der Anweisung, jede Aussage zu belegen und zu sagen, wenn die Notizen die Frage nicht abdecken. Drei Dinge, die der Endpunkt bewusst *nicht* tut:

- Findet die Suche nichts, wird gar kein Modell befragt.
- Quellen werden immer mitgeliefert — auch im Fehlerfall.
- Ein Fehler wird nie als Antwort ausgegeben. Hermes meldet manche Fehler als normale Assistentennachricht; eine Antwort, die mit `Error:` beginnt, wird als Fehlschlag zurückgegeben, egal wie flüssig sie klingt.

**Quellen zum Anklicken.** Ein Klick fliegt die Kamera zur Notiz im 3D-Graphen. Das kostete drei Zeilen, weil beide Hälften eine Notiz über ihren Vault-Pfad identifizieren — geprüft, bevor ich mich darauf verlassen habe.

**Sprachmodus.** Erkennung und Ausgabe laufen im Browser (Web Speech API). Kein Server, kein API-Schlüssel, kein Ton verlässt den Rechner. Bewusste Entscheidung: Ein Wissensspeicher voller persönlicher Notizen wird nicht über einen fremden Transkriptionsdienst vorgelesen.

**„Merk dir das".** Eine Antwort wird zur Notiz im Eingangsordner — mit Frontmatter nach den Regeln des Wissensspeichers und den Quellen als echte Wikilinks, sodass sie im selben Moment im Graphen hängt.

---

## Die Fehlersuche, auf die ich am meisten halte

**Ein „401" war ein 404.** Nach einem Update meldete die Anbindung Authentifizierungsfehler. Wochenlang wurde an Zugangsdaten und Kostenketten gesucht. Der Adapter rief `/v1/chat/completions` — eine Adresse, die es in der neuen Version nicht mehr gibt. Ich habe den Quelltext der Gegenstelle gelesen (`web_server.py`, `dashboard_auth/`, `tui_gateway/`) und den Handschlag mit einer eigenen Sonde Schritt für Schritt nachgebaut. Drei Details waren jeweils ein stiller Fehlschlag:

- Der Sitzungstoken gehört bei WebSockets in die Query, nicht in den Header.
- Es darf kein Unterprotokoll angefordert werden — der Server bestätigt keins zurück, die Bibliothek bricht ab.
- Der Host muss `127.0.0.1` sein; bei `localhost` antwortet der DNS-Rebinding-Schutz mit 403 ohne Begründung.

**Ein Kostenlimit legte das ganze System lahm.** Eine Optimierung hatte das Kontextfenster auf 8192 Token begrenzt. Der Agent verlangt mindestens 64000 — jeder Lauf scheiterte, auch geplante Aufgaben. Der Fehler kam als normale Assistentennachricht zurück und sah deshalb nach einem Modellproblem aus statt nach einer Konfigurationszeile.

**Die Leertaste war unbenutzbar.** Auf dem Aufgabenbrett wurden Leerzeichen nicht angenommen. Ursache waren zwei getrennte Fehler mit derselben Form: Der Titel wurde *getrimmt* in den Zustand zurückgeschrieben, der die Eingabefelder speist — das Leerzeichen wurde beim Tippen sofort wieder gelöscht. Und die Antwort des Servers überschrieb das Feld, in dem gerade getippt wurde. Der zweite Fehler hing an der Netzlatenz und trat deshalb mal auf und mal nicht.

**Die Hälfte aller Verbindungen fehlte im Graphen.** Die Auswertung las nur die ersten 8 KB jeder Datei. Kanten stiegen nach der Korrektur von 570 auf 1067.

---

## Leistung

Gemessen und behoben, statt geraten:

- **Fünf Materialien mit `transmission > 0`** zwangen three.js, die gesamte Szene mehrfach pro Bild zusätzlich zu rendern — für Lichtbrechung durch 4 mm dünne, ohnehin durchsichtige Flächen. Die teuerste Einzelentscheidung im Projekt.
- **Der Auflösungsregler durfte unter die native Auflösung fallen** und kam nie zurück, weil das Heraufsetzen 57 fps verlangte. Eine Szene, die für Schärfe gebaut ist, rendert weich und bleibt weich.
- **`discard` im Shader** schaltet den frühen Tiefentest für den gesamten Shader ab; bei additivem Blending tut eine Maske dasselbe, ohne diesen Preis.
- **13 additive Materialien schrieben Tiefe**, was sie falsch sortiert und Füllrate für Flächen ausgibt, die leuchten und nicht verdecken sollen.

---

## Technik

Next.js 16 · React 19 · TypeScript · React Three Fiber / three.js · Tailwind · Web Speech API · Server-Sent Events · JSON-RPC über WebSocket

---

## Arbeitsweise

Was hier steht, ist geprüft. Wo etwas nicht geprüft werden konnte, steht es als ungeprüft in den Commit-Nachrichten — zum Beispiel eine Reparatur am Gravitationslift, deren Ursache belegt, deren Wirkung aber nie im Browser bestätigt wurde.

Eine Funktion wurde bewusst **nicht** gebaut: „Alter als Helligkeit" im Wissensgraphen. Alle Dateien tragen ein Änderungsdatum aus derselben Woche, weil der Ordner kopiert wurde, und genau eine von 300 Notizen hat ein Datum im Frontmatter. Es gibt keine Datenquelle dafür — die Funktion hätte eine gleichmäßig graue Wolke gezeigt und ausgesehen, als würde sie etwas aussagen.
