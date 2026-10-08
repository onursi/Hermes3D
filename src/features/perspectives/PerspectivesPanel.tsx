"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { ROLES, defaultSettings, plannedCalls, type CatalogProvider, type Choice, type Contribution, type CouncilRun, type CouncilSettings, type ProviderId } from "./model";
import "./perspectives.css";

const STORAGE = "hermes-perspectives-settings-v1";
const PRESETS = "hermes-perspectives-presets-v1";
const RUN = "hermes-perspectives-run-v1";
const STATE: Record<Contribution["state"], string> = { waiting: "Wartet", running: "Prüft …", done: "Fertig", error: "Fehlt", cancelled: "Abgebrochen", skipped: "Nicht gestartet" };

function ChoiceFields({ id, value, providers, onChange, disabled }: { id: string; value: Choice; providers: CatalogProvider[]; onChange: (value: Choice) => void; disabled: boolean }) {
  const provider = providers.find((entry) => entry.id === value.provider);
  const model = provider?.models.find((entry) => entry.id === value.model);
  function chooseProvider(id: ProviderId) {
    const source = providers.find((entry) => entry.id === id);
    const preferred = source?.models.find((entry) => /haiku|gemini.*flash(?!.*image)|gpt-6-luna|:free$/i.test(entry.id)) ?? source?.models[0];
    onChange({ provider: id, model: preferred?.id ?? "", effort: preferred?.efforts[0] ?? "" });
  }
  function chooseModel(id: string) {
    const selected = provider?.models.find((entry) => entry.id === id);
    onChange({ ...value, model: id, effort: selected?.efforts.includes(value.effort) ? value.effort : selected?.efforts[0] ?? "" });
  }
  return <div className="pr-choice">
    <label>Zugang<select aria-label={`${id} Zugang`} value={value.provider} onChange={(event) => chooseProvider(event.target.value as ProviderId)} disabled={disabled}>
      {providers.map((entry) => <option key={entry.id} value={entry.id} disabled={!entry.available}>{entry.name}{!entry.available ? " · nicht verfügbar" : ""}</option>)}
    </select></label>
    <label>Modell{provider?.id === "codex" || provider?.id === "ollama" ? <select aria-label={`${id} Modell`} value={value.model} onChange={(event) => chooseModel(event.target.value)} disabled={disabled}>
      {!model && <option value={value.model}>{value.model || "Modell auswählen"}</option>}
      {provider.models.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select> : <><input aria-label={`${id} Modell`} list={`pr-models-${id}`} value={value.model} onChange={(event) => chooseModel(event.target.value)} placeholder="Modell suchen oder ID eingeben" disabled={disabled} autoComplete="off" spellCheck={false} /><datalist id={`pr-models-${id}`}>
      {provider?.models.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.inputPrice === 0 && entry.outputPrice === 0 ? " · ohne Tokenpreis" : ""}</option>)}
    </datalist></>}</label>
    <label>Denkstufe<select aria-label={`${id} Denkstufe`} value={value.effort} onChange={(event) => onChange({ ...value, effort: event.target.value })} disabled={disabled || !model?.efforts.length}>
      {!model?.efforts.length && <option value="">Vom Modell</option>}
      {model?.efforts.map((effort) => <option key={effort} value={effort}>{effort}</option>)}
    </select></label>
    {value.model && !model && <p className="pr-invalid">Dieses Modell ist nicht im geladenen Katalog. Bitte einen Vorschlag auswählen.</p>}
    {model?.inputPrice !== undefined && model.outputPrice !== undefined && <p className="pr-meta pr-model-price">Tokenpreis: ${Number(model.inputPrice * 1_000_000).toFixed(2)} Eingabe / ${Number(model.outputPrice * 1_000_000).toFixed(2)} Ausgabe je 1 Mio. Tokens.</p>}
  </div>;
}

function ContributionCard({ entry }: { entry: Contribution }) {
  return <article className={`pr-result pr-result--${entry.state}`}>
    <header><h3>{entry.name}</h3><span>{STATE[entry.state]}</span></header>
    <p className="pr-meta">{entry.model}{entry.effort ? ` · ${entry.effort}` : ""}</p>
    {entry.answer && <div className="pr-answer"><ReactMarkdown skipHtml components={{ img: () => null }}>{entry.answer.text}</ReactMarkdown></div>}
    {entry.error && <p className="pr-invalid">{entry.error}</p>}
    {entry.answer && <p className="pr-meta">{entry.answer.inputTokens !== undefined ? `${entry.answer.inputTokens.toLocaleString("de-DE")} Eingabetokens · ` : ""}{entry.answer.outputTokens !== undefined ? `${entry.answer.outputTokens.toLocaleString("de-DE")} Ausgabetokens` : ""}{entry.answer.costUsd !== undefined ? ` · gemeldet: $${entry.answer.costUsd.toFixed(5)}` : ""}</p>}
  </article>;
}

export function PerspectivesPanel({ onClose }: { onClose?: () => void }) {
  const [providers, setProviders] = useState<CatalogProvider[]>([]);
  const [settings, setSettings] = useState<CouncilSettings>(() => defaultSettings());
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mission, setMission] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [run, setRun] = useState<CouncilRun | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [presets, setPresets] = useState<Record<string, CouncilSettings>>({});
  const [presetName, setPresetName] = useState("");
  const [bulk, setBulk] = useState<Choice>({ provider: "codex", model: "", effort: "" });
  const settingsLoaded = useRef(false);
  const mounted = useRef(true);
  const busy = submitting || run?.state === "running";
  const runId = run?.id;
  const runState = run?.state;

  async function loadCatalog(refresh = false) {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/perspectives/models${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Modellliste konnte nicht geladen werden.");
      const data = await response.json() as { providers: CatalogProvider[] };
      if (!mounted.current) return;
      setProviders(data.providers);
      if (!settingsLoaded.current) {
        let initial = defaultSettings(data.providers.find((entry) => entry.id === "codex")?.models);
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
          if (saved && Array.isArray(saved.roles) && saved.roles.length === ROLES.length && saved.moderator && ROLES.every((role) => saved.roles.some((entry: { role?: string }) => entry.role === role.id))) initial = saved;
          const savedPresets = JSON.parse(localStorage.getItem(PRESETS) || "{}");
          if (savedPresets && typeof savedPresets === "object" && !Array.isArray(savedPresets)) setPresets(savedPresets);
        } catch { /* use visible initial settings */ }
        setSettings(initial); setBulk(initial.moderator); settingsLoaded.current = true; setLoaded(true);
      }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Modellliste fehlt."); }
    finally { if (mounted.current) setLoading(false); }
  }

  useEffect(() => {
    mounted.current = true;
    void loadCatalog();
    try {
      const id = localStorage.getItem(RUN);
      if (id) void fetch(`/api/perspectives/runs/${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (response) => {
        if (!response.ok) { localStorage.removeItem(RUN); return; }
        const data = await response.json(); if (mounted.current) { setRun(data.run); setMission(data.run.mission); }
      }).catch(() => {});
    } catch { /* private mode */ }
    return () => { mounted.current = false; };
    // Mount once. Reloading the catalogue must not replace the user's choices.
  }, []);

  useEffect(() => { if (loaded) { try { localStorage.setItem(STORAGE, JSON.stringify(settings)); } catch { /* storage unavailable */ } } }, [settings, loaded]);
  useEffect(() => {
    if (!runId || runState !== "running") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const id = runId;
    async function poll() {
      try {
        const response = await fetch(`/api/perspectives/runs/${id}`, { cache: "no-store" });
        const data = await response.json();
        if (stopped) return;
        if (!response.ok) { setError(data.error || "Ratslauf nicht erreichbar."); return; }
        setRun(data.run); setError("");
      } catch { if (!stopped) setError("Verbindung unterbrochen. Der laufende Rat wird erneut abgefragt."); }
      if (!stopped) timer = setTimeout(poll, 1400);
    }
    timer = setTimeout(poll, 800);
    return () => { stopped = true; clearTimeout(timer); };
  }, [runId, runState]);

  function changeRole(role: string, value: Partial<Choice> & { enabled?: boolean }) {
    setSettings((current) => ({ ...current, roles: current.roles.map((entry) => entry.role === role ? { ...entry, ...value } : entry) }));
  }
  function savePreset() {
    const name = presetName.trim().slice(0, 60);
    if (!name) return;
    const next = { ...presets, [name]: structuredClone(settings) };
    setPresets(next); setNotice(`Belegung „${name}“ gespeichert.`);
    try { localStorage.setItem(PRESETS, JSON.stringify(next)); } catch { setNotice("Speichern ist in diesem Browser nicht verfügbar."); }
  }
  async function start() {
    if (busy) return;
    setSubmitting(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/perspectives/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mission, context, settings }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ratslauf konnte nicht gestartet werden.");
      setRun(data.run); try { localStorage.setItem(RUN, data.run.id); } catch { /* no persistent storage */ }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ratslauf fehlgeschlagen."); }
    finally { setSubmitting(false); }
  }
  async function cancel() {
    if (!run) return;
    try {
      const response = await fetch(`/api/perspectives/runs/${run.id}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Abbrechen fehlgeschlagen.");
      setRun(data.run); setNotice("Abgebrochen. Bereits verbrauchte Tokens können trotzdem berechnet werden.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Abbrechen fehlgeschlagen."); }
  }
  function copyResult() {
    if (!run) return;
    const entries = [...run.opinions, ...run.reviews, run.moderation];
    const text = `${run.mission}\n\n${entries.map((entry) => `${entry.name} (${entry.model})\n${entry.answer?.text || entry.error || STATE[entry.state]}`).join("\n\n")}`;
    void navigator.clipboard.writeText(text).then(() => setNotice("Ergebnis kopiert.")).catch(() => setError("Kopieren wurde vom Browser blockiert."));
  }

  const active = settings.roles.filter((entry) => entry.enabled);
  const choices = [...active, settings.moderator];
  const valid = choices.every((choice) => providers.some((provider) => provider.id === choice.provider && provider.available && provider.models.some((model) => model.id === choice.model)));
  const codexCalls = active.filter((choice) => choice.provider === "codex").length * (settings.review ? 2 : 1) + (settings.moderator.provider === "codex" ? 1 : 0);
  const apiCalls = active.filter((choice) => !["codex", "ollama"].includes(choice.provider)).length * (settings.review ? 2 : 1) + (!["codex", "ollama"].includes(settings.moderator.provider) ? 1 : 0);
  const sameModels = new Set(active.map((choice) => `${choice.provider}/${choice.model}`)).size < active.length;
  const totalReportedCost = run ? [...run.opinions, ...run.reviews, run.moderation].reduce((sum, entry) => sum + (entry.answer?.costUsd ?? 0), 0) : 0;

  return <section className="pr-shell" aria-label="Perspektivenrat" onKeyDown={(event) => {
    if (!onClose) return;
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    if (event.key === "Tab") {
      const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')).filter((node) => node.getClientRects().length > 0);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="pr-header"><div><p className="pr-eyebrow">Hermes · Zweiter Ratsmodus</p><h1>Perspektivenrat</h1><p>Sechs Blickwinkel. Du bestimmst die Modelle.</p></div>{onClose ? <button type="button" className="pr-close" onClick={onClose} aria-label="Perspektivenrat schließen">×</button> : <Link href="/walk" className="pr-back">Zum 3D-Raum ↗</Link>}</header>
    <div className="pr-body">
      <div className="pr-brief"><label htmlFor="pr-mission">Welche Entscheidung möchtest du prüfen?</label><textarea id="pr-mission" value={mission} onChange={(event) => setMission(event.target.value)} rows={3} maxLength={3000} disabled={busy} placeholder="Soll ich …? Was spricht dafür, was dagegen?" />
        <details><summary>Ziel, bekannte Fakten und Grenzen ergänzen</summary><textarea aria-label="Zusätzlicher Kontext" value={context} onChange={(event) => setContext(event.target.value)} rows={4} maxLength={12000} disabled={busy} placeholder="Mein Ziel, meine bisherige Meinung, Zeitbudget, belegte Fakten …" /><p className="pr-meta">Nur dieser eingegebene Kontext wird an die gewählten Modelle geschickt.</p></details>
      </div>

      <details className="pr-config" open><summary>Rollen & Modelle <span>{active.length} aktiv</span></summary>
        <div className="pr-presets"><label>Gespeicherte Belegung<select aria-label="Gespeicherte Belegung" defaultValue="" disabled={busy} onChange={(event) => { const preset = presets[event.target.value]; if (preset?.roles?.length === 6 && preset.moderator) { setSettings(structuredClone(preset)); setNotice("Gespeicherte Belegung geladen. Verfügbarkeit vor dem Start prüfen."); } }}><option value="">Auswählen …</option>{Object.keys(presets).map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label>Name<input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="z. B. Mein GPT-Rat" maxLength={60} disabled={busy} /></label><button type="button" disabled={busy || !loaded || !presetName.trim()} onClick={savePreset}>Belegung speichern</button></div>
        <details className="pr-bulk"><summary>Ein Modell für alle Rollen wählen</summary><ChoiceFields id="Alle" value={bulk} providers={providers} disabled={Boolean(busy || loading)} onChange={setBulk} /><button type="button" disabled={Boolean(busy || !providers.some((provider) => provider.id === bulk.provider && provider.models.some((model) => model.id === bulk.model)))} onClick={() => { setSettings((current) => ({ ...current, roles: current.roles.map((entry) => ({ ...entry, ...bulk })), moderator: { ...bulk } })); setNotice("Modell für alle Rollen und die Auswertung übernommen."); }}>Für alle übernehmen</button></details>
        {loading && <p role="status">Modellkataloge werden geladen …</p>}
        <div className="pr-roles">{ROLES.map((role) => {
          const value = settings.roles.find((entry) => entry.role === role.id)!;
          return <div key={role.id} className={`pr-role${value.enabled ? "" : " pr-role--off"}`}><div className="pr-role-head"><label><input type="checkbox" checked={value.enabled} disabled={busy} onChange={(event) => changeRole(role.id, { enabled: event.target.checked })} /><strong>{role.name}</strong></label><span>{role.question}</span></div><ChoiceFields id={role.name} value={value} providers={providers} disabled={Boolean(busy || loading || !value.enabled)} onChange={(choice) => changeRole(role.id, choice)} /></div>;
        })}</div>
        <div className="pr-moderator"><div className="pr-role-head"><strong>Hermes · Auswertung</strong><span>Empfehlung, Einwand und nächster Schritt</span></div><ChoiceFields id="Auswertung" value={settings.moderator} providers={providers} disabled={Boolean(busy || loading)} onChange={(choice) => setSettings((current) => ({ ...current, moderator: choice }))} /></div>
        <div className="pr-options"><label>Antwortlänge<select aria-label="Antwortlänge" value={settings.words} disabled={busy} onChange={(event) => setSettings((current) => ({ ...current, words: Number(event.target.value) }))}><option value={80}>Kurz · 80 Wörter</option><option value={120}>Normal · 120 Wörter</option><option value={180}>Ausführlich · 180 Wörter</option></select></label><label className="pr-check"><input type="checkbox" checked={settings.review} disabled={busy} onChange={(event) => setSettings((current) => ({ ...current, review: event.target.checked }))} />Eine Gegenprüfungsrunde hinzufügen</label></div>
        <details className="pr-access"><summary>Zugänge & Abrechnung prüfen</summary>{providers.map((provider) => <p key={provider.id}><strong>{provider.name}</strong> · {provider.available ? `${provider.models.length} Modelle · ${provider.billing}` : provider.reason}</p>)}<button type="button" disabled={Boolean(busy || loading)} onClick={() => void loadCatalog(true)}>Modelllisten aktualisieren</button><p className="pr-meta">Denkstufen werden nur angeboten, wenn der Zugang sie ausdrücklich unterstützt.</p></details>
      </details>

      <div className="pr-start"><div><strong>{plannedCalls(settings)} geplante Aufrufe</strong><p>{codexCalls ? `${codexCalls} über dein Codex-Kontingent` : ""}{codexCalls && apiCalls ? " · " : ""}{apiCalls ? `${apiCalls} über API-Zugänge` : ""}{!codexCalls && !apiCalls ? "Lokal auf deinem PC" : ""}</p>{apiCalls > 0 && <p className="pr-meta">API-Kosten nach Tokenverbrauch. Keine vollständige Kostenschätzung verfügbar; kein festes Geldlimit zugesagt. Keine automatische Wiederholung oder Ersatzwahl.</p>}{sameModels && <p className="pr-meta">Wiederholte Modelle sind erlaubt. Gemeinsame blinde Flecken können bleiben.</p>}</div>{run?.state === "running" ? <button type="button" className="pr-stop" onClick={() => void cancel()}>Rat abbrechen</button> : <button type="button" className="pr-primary" disabled={Boolean(busy || loading || !valid || !active.length || !mission.trim())} onClick={() => void start()}>{submitting ? "Startet …" : "Perspektivenrat starten"}</button>}</div>
      {error && <p className="pr-alert" role="alert">{error}</p>}{notice && <p className="pr-notice" role="status">{notice}</p>}

      {run && <div className="pr-results" aria-live="polite"><div className="pr-results-head"><h2>{run.state === "running" ? ({ opinions: "Erste Perspektiven entstehen …", review: "Der Rat prüft die Beiträge …", moderation: "Hermes wertet aus …", finished: "Abschluss …" }[run.phase]) : run.state === "cancelled" ? "Rat abgebrochen" : "Ergebnis deines Rats"}</h2><button type="button" onClick={copyResult}>Ergebnis kopieren</button></div><p className="pr-meta">{run.mission}</p>{run.error && <p className="pr-alert">{run.error}</p>}<div className="pr-result-grid">{run.opinions.map((entry) => <ContributionCard key={entry.role} entry={entry} />)}</div>{run.reviews.length > 0 && <details open><summary>Gegenseitige Prüfung</summary><div className="pr-result-grid">{run.reviews.map((entry) => <ContributionCard key={entry.role} entry={entry} />)}</div></details>}<div className="pr-final"><ContributionCard entry={run.moderation} /></div>{totalReportedCost > 0 && <p className="pr-meta">Von Anbietern gemeldete Kosten: ${totalReportedCost.toFixed(5)}. Nicht gemeldete Kosten und Abokontingent sind hierin nicht enthalten.</p>}<p className="pr-meta">Ergebnisse bleiben vorübergehend im Server-Arbeitsspeicher; keine automatische LifeOS- oder Aufgabenablage. Schließen beendet einen laufenden Rat nicht; dafür „Rat abbrechen“ verwenden.</p></div>}
    </div>
  </section>;
}
