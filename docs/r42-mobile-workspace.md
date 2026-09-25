# R42 · Mobile Arbeitsoberfläche

Auftrag vom 21.09.2026: Hermes auf dem iPhone als Arbeitswerkzeug nutzbar machen. Umsetzung auf R40 (`173d2d9`), isolierter Branch `codex/r42-mobile-focus`. Der Research-/YouTube-Dienst gehört nicht zu diesem Paket.

## Bedienung

- **Start:** vorhandene Arbeitszentrale mit Projekten, Aufgaben und Entscheidungen. Keine zweite Aufgabenliste und keine neue Datenquelle.
- **Hermes:** dieselbe Konsole mit erhaltenem Entwurf; kompakter Kopf, scrollbarer Antwortbereich und Texteingabe am unteren Rand. Zusätzliche Scan-Aktionen hinter „Mehr“.
- **Räume:** vorhandene Raumauswahl mit gut erreichbaren Karten. Auf kleinen Bildschirmen direkter Raumwechsel. Die Suche öffnet nicht ungefragt die Bildschirmtastatur.

Mobile Eingabefelder verwenden 16 px Schrift. Enter fügt mobil eine neue Zeile ein; Absenden bleibt eine ausdrückliche Aktion. „LifeOS fragen“ fokussiert einen vorhandenen Entwurf, statt ihn zu löschen. Beim Verlassen der Konsole wird ein laufendes Mikrofon ausgeschaltet. Navigation und Konsole berücksichtigen Safe Areas und `visualViewport`; bei wenig Höhe werden sekundäre Bedienelemente reduziert. Pinch-Zoom wird nicht durch eine nachgeführte verkleinerte Layoutfläche überschrieben.

Der Desktop behält seine Raumwerkzeuge, das Dock und die Fensteransicht. Der 3D-Renderer selbst wurde nicht optimiert; dies ist kein Leistungs- oder Akkulaufzeitversprechen.

## Technische Grenzen

R42 ändert die Darstellung und Navigation, keine Backend-Verträge, keine Konsilmodelle und keinen automatischen Wissensrückfluss. Die Konsole behält ihren bisherigen Komponenten- und Entwurfszustand. Browserlokale Daten bleiben bei einer Auslieferung unter der bisherigen Adresse erreichbar. Ein anderer Preview-Port besitzt einen eigenen Browser-Origin und darf nicht als Beleg für fehlende Benutzerdaten gewertet werden.

Für den vollständigen Next-Build waren zwei bestehende Typfehler zu korrigieren: Die reine `/agents/[agentId]/settings`-Weiterleitung benötigt keine `params`-Union; die Upload-Grenze liegt jetzt in `src/lib/elevenlabs/limits.ts`, da ein Next-Route-Modul keine beliebigen Konstanten exportieren darf. Die Grenze von 20 MiB und die Upload-Prüfungen bleiben unverändert.

## Reproduzierbare Prüfungen

```sh
node node_modules/vitest/vitest.mjs run tests/unit/mobileWorkspace.test.ts tests/unit/voiceTranscribe.test.ts tests/unit/panelWindow.test.ts tests/unit/workCentralModel.test.ts tests/unit/commandPresence.test.ts --maxWorkers=1
node node_modules/typescript/bin/tsc --noEmit
```

Produktionsbuild in PowerShell:

```powershell
$env:NEXT_DIST_DIR = '.next-mobile-release'
npm run build -- --webpack
```

Die Auslieferung verwendet den bisherigen Port 3464 und unveränderte private Tailscale-Zuordnung. R40s `.next-r40-release` bleibt als Rückfallversion erhalten. Kein öffentliches Funnel, keine Änderung der `/research`- oder `/youtube`-Zuordnung.

## Geräteabnahme

Browserprüfung: Start, Konsole, Entwurferhalt, Zeilenumbruch, Zusatzaktionen, Raumauswahl und Rückkehr. Den abschließenden Prüfstand und Betriebsstand hält der R42-Bericht im LifeOS fest.

Auf einem physischen iPhone bleiben Safari-/Homescreen-Tastatur, Safe Areas, Drehung, Open Mic und Audio praktisch abzunehmen. Ein schmaler Chromium-Browser ersetzt diese Geräteprüfung nicht. Beim Ausbau war der konfigurierte Hermes-Dienst auf Port 9119 nicht erreichbar; dieser Zustand wurde sichtbar belassen und nicht als erfolgreiche KI-Verbindung ausgegeben. R41 Betriebssicherheit bleibt ein eigener offener Auftrag.
