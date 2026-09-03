"use client";

import React from "react";
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, X, Sparkles, DollarSign, Activity, GitBranch, Terminal } from "lucide-react";

interface KontrollfahrtArrivalPanelProps {
  stationIndex: number;
  isArrived: boolean;
  onClose: () => void;
  onRepeatTour: () => void;
  onJumpStation?: (station: number) => void;
}

export function KontrollfahrtArrivalPanel({
  stationIndex,
  isArrived,
  onClose,
  onRepeatTour,
  onJumpStation,
}: KontrollfahrtArrivalPanelProps) {
  if (stationIndex < 0 || !isArrived) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-end pr-8 md:pr-14 animate-in fade-in zoom-in-95 duration-300">
      <div className="pointer-events-auto flex w-full max-w-[420px] flex-col gap-3 rounded-2xl border border-cyan-400/40 bg-[#050e1c]/95 p-5 shadow-2xl shadow-cyan-950/80 backdrop-blur-xl">
        
        {/* Header Badge */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
              STATION {stationIndex + 1}/5 · LEITSTAND
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
            title="Schließen [ESC]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content By Station */}
        {stationIndex === 0 && (
          <div className="flex flex-col gap-3 font-mono">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GitBranch className="text-cyan-400" size={18} />
                PROJEKT-STATUS & PIPELINE
              </h3>
              <p className="text-[11px] text-slate-400">Aktuelle Repositories, Branches & automatisierte Tests</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-slate-800 bg-black/40 p-2.5">
                <span className="text-[10px] text-slate-500 block">Repository</span>
                <span className="font-semibold text-cyan-200">Hermes 3D Cyber-HQ</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-black/40 p-2.5">
                <span className="text-[10px] text-slate-500 block">Aktiver Branch</span>
                <span className="font-semibold text-cyan-200">feature/executive-dash</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-black/40 p-3 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">CI/CD Build</span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <CheckCircle2 size={13} />
                  ERFOLGREICH (100%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Unit & End-to-End</span>
                <span className="text-slate-200">48 / 48 bestanden</span>
              </div>
            </div>
          </div>
        )}

        {stationIndex === 1 && (
          <div className="flex flex-col gap-3 font-mono">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="text-cyan-400" size={18} />
                SPRINT-KANBAN & WORKLOAD
              </h3>
              <p className="text-[11px] text-slate-400">Aufgabenverteilung der 4 aktiven KI-Agenten</p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 flex flex-col gap-1">
                <span className="text-[10px] text-amber-400 font-bold">⚡ IN ARBEIT (2)</span>
                <div className="text-xs text-slate-200 flex justify-between">
                  <span>[#401] 3D Orbital Bridge</span>
                  <span className="text-cyan-400 font-bold">Claude</span>
                </div>
                <div className="text-xs text-slate-200 flex justify-between">
                  <span>[#402] PBR Shader & 120Hz</span>
                  <span className="text-emerald-400 font-bold">GPT</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-800 bg-black/40 p-2 text-center">
                  <span className="text-slate-500 text-[10px] block">To Do</span>
                  <span className="text-lg font-bold text-slate-200">4</span>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2 text-center">
                  <span className="text-emerald-400 text-[10px] block">Heute erledigt</span>
                  <span className="text-lg font-bold text-emerald-300">8</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {stationIndex === 2 && (
          <div className="flex flex-col gap-3 font-mono">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="text-amber-400" size={18} />
                FINANZ- & RESSOURCEN-LAGE
              </h3>
              <p className="text-[11px] text-slate-400">Quantum War Room: Tagesbudget & Token-Durchsatz</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-[#0c0a06] p-3 flex flex-col gap-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-400">Tagesbudget verbraucht:</span>
                <span className="text-lg font-bold text-amber-300">14,2 %</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400 w-[14.2%]" />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Ist: € 3,55</span>
                <span>Limit: € 25,00</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-slate-800 bg-black/40 p-2.5">
                <span className="text-[10px] text-slate-500 block">Token-Durchsatz</span>
                <span className="font-semibold text-cyan-300">428k Tokens</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-black/40 p-2.5">
                <span className="text-[10px] text-slate-500 block">Gateway Latenz</span>
                <span className="font-semibold text-emerald-400">24 ms (Live)</span>
              </div>
            </div>
          </div>
        )}

        {stationIndex === 3 && (
          <div className="flex flex-col gap-3 font-mono">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="text-purple-400" size={18} />
                NACHTSCHICHT & CRON-JOBS
              </h3>
              <p className="text-[11px] text-slate-400">Was lief nachts, was ist durchgelaufen, was gescheitert?</p>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2.5 flex items-start gap-2 text-slate-200">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-bold text-emerald-300">03:00 · Git Sync & Backup</span>
                  <span className="text-[11px] text-slate-400">Erfolgreich beendet (0 Fehler, Snapshot verifiziert)</span>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2.5 flex items-start gap-2 text-slate-200">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-bold text-emerald-300">04:30 · Cache Cleanup & GC</span>
                  <span className="text-[11px] text-slate-400">Heap bereinigt (1,4 GB freigegeben)</span>
                </div>
              </div>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-2.5 flex items-start gap-2 text-slate-200">
                <Terminal size={15} className="text-cyan-400 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-bold text-cyan-300">06:00 · Stand-up Aggregator</span>
                  <span className="text-[11px] text-slate-400">Briefing-Notizen für heute generiert</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {stationIndex === 4 && (
          <div className="flex flex-col gap-3 font-mono">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="text-amber-400" size={18} />
                HERMES LEITSTAND-URTEIL
              </h3>
              <p className="text-[11px] text-slate-400">Operative Tagesentscheidung & Handlungsempfehlung</p>
            </div>

            <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-b from-[#08182b] to-[#040a14] p-4 text-xs text-slate-200 flex flex-col gap-2">
              <span className="text-cyan-400 font-bold uppercase text-[10px] tracking-wider">
                🤖 Empfehlung von Hermes für heute:
              </span>
              <p className="leading-relaxed text-slate-100 font-medium italic">
                „Ich empfehle heute: Fokus auf den Abschluss der PR-Freigaben und das Kanban-Board. Alle nächtlichen Jobs sind fehlerfrei durchgelaufen, das Budget liegt voll im grünen Bereich.“
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 px-4 text-xs font-bold text-black hover:bg-cyan-400 transition cursor-pointer shadow-lg shadow-cyan-500/25"
              >
                <span>Jetzt loslegen & Freigaben öffnen</span>
                <ArrowRight size={14} />
              </button>

              <button
                type="button"
                onClick={onRepeatTour}
                className="rounded-xl border border-slate-700 bg-slate-900/60 py-2 px-3 text-[11px] text-slate-300 hover:bg-slate-800 transition cursor-pointer text-center"
              >
                Kontrollfahrt wiederholen
              </button>
            </div>
          </div>
        )}

        {/* Station Navigation Bar: Skip stations via buttons or arrow keys */}
        <div className="flex items-center justify-between border-t border-cyan-500/20 pt-2.5 mt-1 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => onJumpStation?.((stationIndex - 1 + 5) % 5)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-400 hover:text-white transition cursor-pointer"
            title="Vorherige Station (Pfeiltaste Links ←)"
          >
            <span>◀ Zurück</span>
          </button>

          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onJumpStation?.(idx)}
                className={`h-6 w-6 rounded-md font-bold text-[10px] transition cursor-pointer flex items-center justify-center ${
                  stationIndex === idx
                    ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30"
                    : "bg-slate-900/80 text-slate-400 border border-slate-800 hover:border-slate-600 hover:text-slate-200"
                }`}
                title={`Station ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onJumpStation?.((stationIndex + 1) % 5)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-400 hover:text-white transition cursor-pointer"
            title="Nächste Station (Pfeiltaste Rechts →)"
          >
            <span>Weiter ▶</span>
          </button>
        </div>
      </div>
    </div>
  );
}
