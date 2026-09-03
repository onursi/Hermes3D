# Offener Folgeauftrag: Remote-/HTTPS-Proxy-Auflösung

Status: **offen, bewusst zurückgestellt** (2026-09-01)
Betroffene Datei: [`src/lib/gateway/proxy-url.ts`](../src/lib/gateway/proxy-url.ts) (`resolveStudioProxyGatewayUrl`)
Quelle: `/codex:review --base main --scope branch` gegen Commit `82d6f02`

## Kontext

`82d6f02` führte eine adapterType-abhängige Studio-Proxy-Auflösung ein: für
einen loopback-gebundenen, nicht-übersetzenden Upstream (z. B. `hermes` auf
`localhost`/`127.0.0.1`) verbindet sich der Browser direkt statt über den
Studio-Proxy, und unter Windows wird `localhost` explizit auf `127.0.0.1`
gepinnt (wegen möglicher `::1`-Auflösung, während der isolierte Dev-Studio
nur IPv4 bindet). Der lokale Pilotbetrieb auf diesem Rechner wurde damit
live gegen den echten nativen Gateway verifiziert und funktioniert korrekt.

## Zwei offene, unabhängige Funde

**[P1] Loopback-Passthrough bricht Remote-Zugriff**
`src/lib/gateway/proxy-url.ts:20-24`
Wird Studio von einem ANDEREN Gerät geöffnet, aber der konfigurierte
Upstream zeigt auf `localhost`/`127.0.0.1` (bezogen auf den Studio-Server,
nicht auf das Gerät des Browsers), verbindet sich der Browser fälschlich
mit seinem EIGENEN Loopback-Interface statt über `/api/gateway/ws` zum
eigentlichen Server zu proxien. Der Loopback-Passthrough darf nur
greifen, wenn wirklich sichergestellt ist, dass Browser und Server denselben
Host teilen — sonst muss der bestehende Proxy-Pfad Standard bleiben.

**[P1] HTTPS-Proxy-WebSocket verliert den gültigen Hostnamen**
`src/lib/gateway/proxy-url.ts:37-40`
Wird Studio als `https://localhost` ausgeliefert, macht das Umschreiben
auf `wss://127.0.0.1` die WebSocket-Verbindung TLS-ungültig, da lokale
Zertifikate typischerweise auf `localhost` ausgestellt sind, nicht auf die
IP-Adresse. Die Umschreibung greift außerdem plattformunabhängig, obwohl
die Begründung (Windows-`::1`-Problem) nur für Windows gilt. Für HTTPS
sollte `window.location.host` erhalten bleiben (idealerweise überhaupt
keine Veränderung des im Browser sichtbaren Origins).

## Einordnung

- **Lokaler Gateway-Betrieb (dieser Rechner, HTTP, Browser und Server auf
  derselben Maschine) ist live verifiziert und funktioniert.**
- **Remote-Zugriff von einem anderen Gerät sowie HTTPS-Betrieb sind NICHT
  abgenommen** und nach aktuellem Codex-Fund vermutlich aktuell defekt.
- Beide Funde betreffen ausschließlich Remote-/HTTPS-Szenarien, nicht den
  aktuell verifizierten lokalen Pilotbetrieb.

## Vor einer Remote-/HTTPS-Nutzung erforderlich

1. Beide Funde gezielt beheben (`resolveStudioProxyGatewayUrl`).
2. Danach live testen: Studio von einem zweiten Gerät im selben Netz
   öffnen (Remote-Zugriff), sowie Studio über HTTPS ausliefern und die
   Gateway-WebSocket-Verbindung prüfen (kein TLS-Fehler, kein
   fehlgeschlagener Verbindungsaufbau).
3. Erst nach erfolgreichem Test freigeben.

Bis dahin: **kein Remote- oder HTTPS-Einsatz dieser Studio-Instanz.**
