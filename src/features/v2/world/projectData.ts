export type ProjectSectorItem = {
  id: string;
  title: string;
  subtitle: string;
  sector: "quellen" | "werkstatt" | "ergebnisse";
  vaultPath?: string;
  date: string;
  status: "fertig" | "aktiv" | "entwurf" | "verifiziert";
  badge: string;
  summary: string;
  details: string;
  externalLink?: string;
  tags: string[];
};

export type TimelineMilestone = {
  id: string;
  date: string;
  title: string;
  category: string;
  summary: string;
  deliverableId?: string;
  color: string;
};

export type CouncilStance = {
  provider: "anthropic" | "gemini" | "openai" | "opencode";
  name: string;
  role: string;
  motto: string;
  tone: string;
  stance: string;
  approved: boolean;
};

export type ProjectShowcase = {
  id: string;
  name: string;
  folder: string;
  goal: string;
  tagline: string;
  progress: number;
  leadAgent: string;
  items: ProjectSectorItem[];
  timeline: TimelineMilestone[];
  council: CouncilStance[];
};

export const SHOWCASE_PROJECTS: Record<string, ProjectShowcase> = {
  "01 Hermes Agent OS": {
    id: "hermes-os",
    name: "01 Hermes Agent OS",
    folder: "05 🚀 Projekte/01 Hermes Agent OS",
    goal: "Autonomes 3D-Agent-Betriebssystem mit räumlicher Navigation, Multi-Agent-Council, Obsidian-Vault-Synchronisation und Ergebniswerft.",
    tagline: "Die Schaltzentrale für Onurs gesamtes Life & Work OS",
    progress: 88,
    leadAgent: "Antigravity & Claude",
    items: [
      // --- QUELLEN ---
      {
        id: "src-vision",
        title: "Spatial Life OS – Vision 2026-09-04",
        subtitle: "Grundstein & architektonische Vision",
        sector: "quellen",
        vaultPath: "05 🚀 Projekte/01 Hermes Agent OS/Architektur & Betrieb/Spatial Life OS – Vision 2026-09-04.md",
        date: "04.09.2026",
        status: "verifiziert",
        badge: "PDF / Spec",
        summary: "Die Ursprungsvision für das dreidimensionale Betriebssystem. Definiert die Räume, das Cockpit und den nahtlosen Übergang von 2D-Gedanken zu 3D-Welten.",
        details: `# Spatial Life OS – Vision 2026-09-04

## Kernprinzipien
1. **Ein Ort, ein Horizont:** Keine isolierten Menü-Kacheln, sondern zusammenhängende Räume.
2. **2D-Dashboard im 3D-Raum:** Tiefenwahrnehmung für Orientierung, scharfe 2D-Lesbarkeit für echte Arbeit.
3. **Echte Daten, kein Fake:** Was im Raum steht, existiert nachweislich auf der Festplatte.

> *„Der Raum ist das Gedächtnis, das Dokument die Tat."*`,
        tags: ["Vision", "Architektur", "LifeOS", "Fundament"],
      },
      {
        id: "src-bauplan",
        title: "Bauplan nach Priorität 2026-09-04",
        subtitle: "Roadmap für Welten & Features",
        sector: "quellen",
        vaultPath: "05 🚀 Projekte/01 Hermes Agent OS/Architektur & Betrieb/Hermes 3D – Umsetzungsplan nach Priorität 2026-09-04.md",
        date: "04.09.2026",
        status: "aktiv",
        badge: "Roadmap",
        summary: "Die Roadmap aller Welten: 1. Projektwelt & Ergebniswerft, 2. Council & Entscheidungsstation, 3. Erinnerungsorbit, 4. Ideengarten.",
        details: `# Hermes 3D – Umsetzungsplan nach Priorität

### Die 4 Ausbaustufen:
- **Stufe 1: Projektwelt & Ergebniswerft:** Räumliche Erkundung von Zielen, Quellen, Werkstatt und Ergebnissen mit 2D-Arbeitsfläche.
- **Stufe 2: Council & Entscheidungsstation:** Multi-Modell Abstimmung und Freigaben.
- **Stufe 3: Erinnerungsorbit:** Zeitreise durch belegte Projektergebnisse.
- **Stufe 4: Ideengarten:** Vernetzung und Reifung neuer Vorhaben.`,
        tags: ["Bauplan", "Priorität", "Meilensteine"],
      },
      {
        id: "src-council-briefing",
        title: "Briefing – Council bauen 2026-09-04",
        subtitle: "Multi-Agenten Entscheidungsfindung",
        sector: "quellen",
        vaultPath: "05 🚀 Projekte/01 Hermes Agent OS/Briefing für Hermes – Council bauen 2026-09-04.md",
        date: "04.09.2026",
        status: "verifiziert",
        badge: "Council",
        summary: "Anforderungen an das Zusammenspiel der 4 KI-Mitarbeiter (Claude, Antigravity, Codex, OpenCode) zur gemeinsamen Lösungsfindung.",
        details: `# Briefing: Council bauen

- Vier Agenten, ein Konferenztisch.
- Jeder Agent vertritt eine klare Perspektive:
  - **Claude:** Architektur & Stabilität
  - **Antigravity:** Design & visuelle Veredelung
  - **Codex:** Strategie & Abwägung
  - **OpenCode:** Reserve & Ausführung`,
        tags: ["Council", "Briefing", "Agenten"],
      },
      {
        id: "src-routing-policy",
        title: "Hermes Routing-Policy 2026-08-29",
        subtitle: "Modell-Zuweisung & Aufgabenverteilung",
        sector: "quellen",
        vaultPath: "05 🚀 Projekte/01 Hermes Agent OS/Routing & Modelle/Hermes Routing-Policy – Technische Referenz 2026-08-29.md",
        date: "29.08.2026",
        status: "verifiziert",
        badge: "Routing",
        summary: "Regelwerk für die dynamische Modell-Auswahl basierend auf Latenz, Kontextgröße und Fachgebiet.",
        details: `# Hermes Routing-Policy

Definiert die Zuweisung von Prompts an die spezialisierten KI-Modelle im Hermes Agent OS.`,
        tags: ["Routing", "Policy", "Modelle"],
      },

      // --- WERKSTATT ---
      {
        id: "wrk-dualtrack",
        title: "Dual-Track Workflow (Track 1 & 2)",
        subtitle: "Zwei-Gleise-Architektur",
        sector: "werkstatt",
        vaultPath: "05 🚀 Projekte/01 Hermes Agent OS/Dual-Track Workflow.md",
        date: "06.09.2026",
        status: "aktiv",
        badge: "Architektur",
        summary: "Track 1 (Claude Port 3400) als verlässliche Basis, Track 2 (Antigravity Port 3420) als kreativer Veredler und Challenger.",
        details: `# Dual-Track Workflow

- **Track 1:** \`http://localhost:3400/v2\` — Claude / Stabilität & Datenbasis
- **Track 2:** \`http://localhost:3420/v2\` — Antigravity / Roboter, Sound, Hyperlicht, Werft`,
        tags: ["Dual-Track", "Workflow", "DevOps"],
      },
      {
        id: "wrk-robots",
        title: "AgentDeck.tsx – Instanzierte Roboter",
        subtitle: "10 Draw Calls, 4 Logos, Gesten & Oktaeder",
        sector: "werkstatt",
        vaultPath: "src/features/v2/world/AgentDeck.tsx",
        date: "06.09.2026",
        status: "fertig",
        badge: "Code",
        summary: "Vollständig instanziertes Deck mit handgezeichnetem Canvas-Logo-Atlas, Blickverfolgung mit Limit, animiertem Mund, Blinzeln und schwebendem ChatGPT-Oktaeder.",
        details: `# AgentDeck.tsx

- 10 Draw Calls für alle Figuren zusammen.
- Texture-Atlas mit 4 Vektor-Logos (Anthropic, Gemini, OpenAI, OpenCode).
- Sanfte Blickverfolgung mit 65° Kopfwinkelsperre.
- Keinerlei störende Doppel-Auren – nahtlose Integration von Claudes AgentAura.`,
        tags: ["Three.js", "Roboter", "Shaders", "Performance"],
      },
      {
        id: "wrk-audio",
        title: "atmosphereAudio.ts – Dual-Mode Synth",
        subtitle: "Codex Normal-Flug + Antigravity Warp",
        sector: "werkstatt",
        vaultPath: "src/features/v2/atmosphereAudio.ts",
        date: "06.09.2026",
        status: "fertig",
        badge: "Audio Code",
        summary: "Synthesizer mit Codex' subtilem Quinten-Drone im Normalmodus und Antigravitys roaring Sonic Boom, Sub-Bass Roar und Turbinen-Sweep bei Hyperlicht.",
        details: `# atmosphereAudio.ts

- **Normal-Modus:** Codex 65.4Hz/196Hz Quinten, sanftes Rauschen, 48Hz Motor.
- **Hyperlicht-Modus:** 160Hz->24Hz Sonic Boom Knall, 28Hz/14Hz Sub-Bass Roar, 220Hz->2700Hz Turbine, 1600Hz Bandpass-Fahrtwind.`,
        tags: ["Web Audio", "Synthesizer", "Soundscape", "Warp"],
      },
      {
        id: "wrk-warpflight",
        title: "FreeFlight.tsx & HyperRide.tsx",
        subtitle: "Relativistischer Warp & Kanzel-Rütteln",
        sector: "werkstatt",
        vaultPath: "src/features/v2/universe/FreeFlight.tsx",
        date: "06.09.2026",
        status: "fertig",
        badge: "Physics / FX",
        summary: "Kanzel-Vibration auf Nick-, Gier- und Roll-Achse, 108° FOV Fischaugenverzerrung, rasende Warp-Lichtadern und 4.5-facher Schub.",
        details: `# FreeFlight & HyperRide

Stationäre Warp-Blase im All (0 km/h real) mit maximalem visuellem Ritt und echter Vorwärts-Beschleunigung bei Tastendruck.`,
        tags: ["FreeFlight", "Warp", "Camera Shake", "VFX"],
      },

      // --- ERGEBNISSE ---
      {
        id: "res-astra",
        title: "ASTRA – Onurs Universum (Runden 1–4)",
        subtitle: "Interaktive HTML-Reports",
        sector: "ergebnisse",
        vaultPath: "05 🚀 Projekte/01 Hermes Agent OS/Architektur & Betrieb/_Assets/ASTRA – Onurs Universum 2026-09-05.html",
        date: "05.09.2026",
        status: "verifiziert",
        badge: "Report",
        summary: "Vollständige Dokumentation aller 4 Revisionsrunden mit visuellen Side-by-Side Vergleichen, Design-Entscheidungen und Freigaben.",
        details: `# ASTRA – Onurs Universum

Umfassendes Audit und visuelle Auswertung der Weltideen und des räumlichen Aufbaus.`,
        tags: ["ASTRA", "Audit", "HTML", "Freigabe"],
      },
      {
        id: "res-audit-log",
        title: "A-B Testing Log – Audit Runde 1",
        subtitle: "Beweisbare Noten & Vergleiche",
        sector: "ergebnisse",
        vaultPath: "05 🚀 Projekte/01 Hermes Agent OS/A-B Testing Log.md",
        date: "06.09.2026",
        status: "verifiziert",
        badge: "Audit",
        summary: "Protokoll des A/B-Tests zwischen Track 1 (Original) und Track 2 (Veredelung). Bewertungssprung von 4/10 auf 8.5/10.",
        details: `# A-B Testing Log

Vergleich aller 5 Kernaspekte: Nebel, Portale, Roboter-Figuren, Soundscape & Hyperlichtgeschwindigkeit.`,
        tags: ["A/B Testing", "Audit", "Metriken"],
      },
      {
        id: "res-shipyard",
        title: "Ergebniswerft v1.0 (Live 3D)",
        subtitle: "Die erste voll nutzbare Projektwelt",
        sector: "ergebnisse",
        vaultPath: "src/features/v2/world/ProjectsWorld.tsx",
        date: "06.09.2026",
        status: "fertig",
        badge: "3D Welt",
        summary: "Räumlicher 3D-Werfthafen mit 3 Sektoren (Quellen, Werkstatt, Ergebnisse), Erinnerungsorbit-Zeitleiste, Mini-Council und 2D-Arbeitsfläche im Raum.",
        details: `# Ergebniswerft v1.0

Erste vollständige Umsetzung der Vorlage für alle kommenden Projektwelten.`,
        tags: ["Ergebniswerft", "Projektwelt", "Release", "Flagship"],
      },
    ],
    timeline: [
      {
        id: "tl-1",
        date: "04. Sep 2026",
        title: "Vision & Fundament",
        category: "Idee",
        summary: "Spatial Life OS Vision & Hermes 3D Umsetzungsplan aufgesetzt.",
        color: "#38bdf8",
      },
      {
        id: "tl-2",
        date: "05. Sep 2026",
        title: "ASTRA Runden 1–4",
        category: "Konzept",
        summary: "Weltideen ASTRA R1-R4 erarbeitet und Portal-System entworfen.",
        color: "#a855f7",
      },
      {
        id: "tl-3",
        date: "06. Sep 10:00",
        title: "Dual-Track Setup",
        category: "Architektur",
        summary: "Entkopplung von Track 1 (Stabilität) und Track 2 (Veredelung).",
        color: "#f59e0b",
      },
      {
        id: "tl-4",
        date: "06. Sep 14:00",
        title: "Roboter & Hyperlicht",
        category: "Engineering",
        summary: "Instanzierte Chassis, Logos, Sonic Boom und Warp-Turbine fertiggestellt.",
        color: "#06b6d4",
      },
      {
        id: "tl-5",
        date: "06. Sep 17:00",
        title: "Ergebniswerft & 2D-Workspace",
        category: "Meilenstein",
        summary: "Erste vollständige Projektwelt mit scharfer 2D-Arbeitsfläche im 3D-Raum.",
        color: "#10b981",
      },
    ],
    council: [
      {
        provider: "anthropic",
        name: "Claude",
        role: "Entwickler",
        motto: "Architektur, Code & Kosten",
        tone: "#c2410c",
        stance: "Deck-Architektur und Aura stabil bei 60 fps. Volle Zustimmung für getrennte Werft-Sektoren.",
        approved: true,
      },
      {
        provider: "gemini",
        name: "Antigravity",
        role: "Designer",
        motto: "Form, Farbe, Raum & Emotion",
        tone: "#7c3aed",
        stance: "Werfthafen als futuristische Konstruktionsbasis mit volumetrischer Tiefe und scharfer 2D-Arbeitsfläche umgesetzt.",
        approved: true,
      },
      {
        provider: "openai",
        name: "Codex",
        role: "Stratege",
        motto: "Plan, Abwägung, Entscheidung",
        tone: "#10b981",
        stance: "Zwei-Gleise-Workflow beibehalten. Erstes Projekt dient als perfekte Schablone für Company OS.",
        approved: true,
      },
      {
        provider: "opencode",
        name: "OpenCode",
        role: "Reserve",
        motto: "Bereit für Aufgaben",
        tone: "#0ea5e9",
        stance: "Bereitschaft zur Unterstützung bei Asset-Generierung und Performance-Monitoring.",
        approved: true,
      },
    ],
  },
  "02 Company OS": {
    id: "company-os",
    name: "02 Company OS & Filmstudio",
    folder: "05 🚀 Projekte/02 Company OS",
    goal: "Virtuelles Filmstudio, Content-Pipeline und automatisierte Agentur-Infrastruktur für Medienproduktion.",
    tagline: "Das digitale Filmstudio der nächsten Generation",
    progress: 65,
    leadAgent: "Antigravity",
    items: [
      {
        id: "cos-src-brief",
        title: "Creative Brief – Company-OS-Website",
        subtitle: "Markenidentität & Bildsprache",
        sector: "quellen",
        vaultPath: "05 🚀 Projekte/02 Company OS/Website/Creative Brief – Company-OS-Website.md",
        date: "05.09.2026",
        status: "verifiziert",
        badge: "Briefing",
        summary: "Kreativvorgaben für die Außendarstellung: Minimalistisches High-End Dark-Theme, Neon-Akzente, filmisches Storytelling.",
        details: `# Creative Brief – Company OS

Visuelle Leitlinien für das digitale Filmstudio und die Web-Präsenz.`,
        tags: ["Branding", "Design", "Filmstudio"],
      },
      {
        id: "cos-wrk-pilot",
        title: "Company OS – Single-File Pilot",
        subtitle: "Funktionsfähiger Web-Prototyp",
        sector: "werkstatt",
        vaultPath: "05 🚀 Projekte/02 Company OS/Website/Single-File Pilot/Start – Single-File-Pilot.md",
        date: "05.09.2026",
        status: "aktiv",
        badge: "Prototyp",
        summary: "Eigenständiger Prototyp der Studio-Website mit Video-Feed und Projekt-Portfolios.",
        details: `# Company OS Single-File Pilot

Interaktiver Prototyp zur Validierung des Studio-Konzepts.`,
        tags: ["Prototyp", "Website", "Frontend"],
      },
      {
        id: "cos-res-phase1",
        title: "Phase-1-Abnahme & Freigabe",
        subtitle: "Erfolgreicher Meilenstein",
        sector: "ergebnisse",
        vaultPath: "05 🚀 Projekte/02 Company OS/Website/Phase-1-Abnahme.md",
        date: "02.09.2026",
        status: "verifiziert",
        badge: "Abnahme",
        summary: "Formale Abnahme der ersten Design-Phase und Freigabe für 3D-Raum-Integration.",
        details: `# Phase-1 Abnahme

Vollständige Prüfung der Assets und Vorbereitung für die Ergebniswerft.`,
        tags: ["Freigabe", "Phase 1", "Ergebnis"],
      },
    ],
    timeline: [
      {
        id: "cos-tl-1",
        date: "30. Aug 2026",
        title: "Studio-Idee & Konzept",
        category: "Idee",
        summary: "Initiale Konzeption des Company OS Filmstudios.",
        color: "#38bdf8",
      },
      {
        id: "cos-tl-2",
        date: "02. Sep 2026",
        title: "Phase 1 Abnahme",
        category: "Meilenstein",
        summary: "Design-Briefing und Pilotstruktur freigegeben.",
        color: "#10b981",
      },
      {
        id: "cos-tl-3",
        date: "05. Sep 2026",
        title: "Website Pilot V1",
        category: "Entwurf",
        summary: "Single-File Pilot im Vault abgelegt.",
        color: "#f59e0b",
      },
    ],
    council: [
      {
        provider: "anthropic",
        name: "Claude",
        role: "Entwickler",
        motto: "Architektur, Code & Kosten",
        tone: "#c2410c",
        stance: "Filmstudio-Assets als eigenständige Sub-Werft bereitstellbar.",
        approved: true,
      },
      {
        provider: "gemini",
        name: "Antigravity",
        role: "Designer",
        motto: "Form, Farbe, Raum & Emotion",
        tone: "#7c3aed",
        stance: "Filmisches Licht-Setup mit Spotlight und Lens-Flares empfohlen.",
        approved: true,
      },
      {
        provider: "openai",
        name: "Codex",
        role: "Stratege",
        motto: "Plan, Abwägung, Entscheidung",
        tone: "#10b981",
        stance: "Fokus auf wiederverwendbare Komponenten für künftige Projekte.",
        approved: true,
      },
      {
        provider: "opencode",
        name: "OpenCode",
        role: "Reserve",
        motto: "Bereit für Aufgaben",
        tone: "#0ea5e9",
        stance: "Bereit für Rendering-Jobs.",
        approved: true,
      },
    ],
  },
};
