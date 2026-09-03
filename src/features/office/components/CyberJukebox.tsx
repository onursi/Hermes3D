"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Radio,
  Youtube,
  Disc,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Sliders,
} from "lucide-react";
import { cyberAudio } from "@/lib/sound/cyberAudio";

interface RadioChannel {
  id: string;
  name: string;
  genre: string;
  url: string;
  type: "audio" | "youtube" | "spotify";
}

const PRESET_CHANNELS: RadioChannel[] = [
  {
    id: "lofi-focus",
    name: "Lofi Deep Space Focus",
    genre: "Chillhop / Study",
    url: "https://stream.zeno.fm/f3wvbbqmdg8uv", // High-reliability 24/7 lofi chill stream
    type: "audio",
  },
  {
    id: "synthwave",
    name: "Synthwave Orbital Radio",
    genre: "Retro Cyber / 80s",
    url: "https://stream.zeno.fm/0r0xa792kwzuv", // High-reliability synthwave stream
    type: "audio",
  },
  {
    id: "ambient-space",
    name: "Deep Space Ambient",
    genre: "Sci-Fi Atmosphere",
    url: "https://stream.zeno.fm/5y3yudwv0hhvv", // Ambient space drone stream
    type: "audio",
  },
  {
    id: "youtube-lofi",
    name: "YouTube // Lofi Girl 24/7",
    genre: "YouTube Live Stream",
    url: "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1",
    type: "youtube",
  },
  {
    id: "spotify-synth",
    name: "Spotify // Cyberpunk 2077",
    genre: "Spotify Playlist",
    url: "https://open.spotify.com/embed/playlist/37i9dQZF1DXdLEN7aqioXM?utm_source=generator",
    type: "spotify",
  },
];

export function CyberJukebox() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMiniDocked, setIsMiniDocked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<RadioChannel>(PRESET_CHANNELS[0]);
  const [volume, setVolume] = useState(0.45);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<"radio" | "youtube" | "spotify">("radio");
  const [customUrl, setCustomUrl] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize or update HTML audio element
  useEffect(() => {
    if (!audioRef.current && typeof Audio !== "undefined") {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
    }

    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle Play/Pause
  const togglePlay = () => {
    cyberAudio.playBlip();
    if (currentChannel.type === "audio") {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        if (audioRef.current) {
          audioRef.current.src = currentChannel.url;
          audioRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const selectChannel = (channel: RadioChannel) => {
    cyberAudio.playBlip();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCurrentChannel(channel);

    if (channel.type === "audio") {
      if (audioRef.current) {
        audioRef.current.src = channel.url;
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    } else {
      setIsPlaying(true);
    }
  };

  const handleApplyCustomUrl = () => {
    if (!customUrl.trim()) return;
    cyberAudio.playChime();

    const raw = customUrl.trim();
    let formattedUrl = raw;
    let type: "youtube" | "spotify" = "youtube";

    if (raw.includes("spotify.com")) {
      type = "spotify";
      const spotifyMatch = raw.match(/open\.spotify\.com\/(track|playlist|album|artist|episode)\/([a-zA-Z0-9]+)/);
      if (spotifyMatch) {
        formattedUrl = `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}?utm_source=generator&theme=0`;
      } else if (!raw.includes("/embed/")) {
        formattedUrl = raw.replace("open.spotify.com/", "open.spotify.com/embed/");
      }
    } else {
      type = "youtube";
      // Support standard watch, youtu.be, live, shorts, and embed URLs
      const ytMatch = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([a-zA-Z0-9_-]{11})/);
      const listMatch = raw.match(/[?&]list=([a-zA-Z0-9_-]+)/);

      if (ytMatch && ytMatch[1]) {
        formattedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&enablejsapi=1`;
      } else if (listMatch && listMatch[1]) {
        formattedUrl = `https://www.youtube-nocookie.com/embed/videoseries?list=${listMatch[1]}&autoplay=1`;
      } else if (!raw.startsWith("http")) {
        formattedUrl = `https://www.youtube-nocookie.com/embed/${raw}?autoplay=1`;
      }
    }

    const newChannel: RadioChannel = {
      id: "custom-" + Date.now(),
      name: type === "spotify" ? "Eigene Spotify-Quelle" : "Eigene YouTube-Quelle",
      genre: "Benutzerdefiniert",
      url: formattedUrl,
      type,
    };

    selectChannel(newChannel);
    setCustomUrl("");
  };

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialOffsetRef = useRef({ x: 0, y: 0 });
  const snappedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialOffsetRef.current = { ...offset };
    snappedRef.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      let dx = moveEvent.clientX - dragStartRef.current.x;
      let dy = moveEvent.clientY - dragStartRef.current.y;
      let targetX = initialOffsetRef.current.x + dx;
      let targetY = initialOffsetRef.current.y + dy;

      // CAD SolidWorks-style magnetic snapping
      let didSnap = false;
      if (Math.abs(targetX) < 30) {
        targetX = 0;
        didSnap = true;
      }
      if (Math.abs(targetY) < 30) {
        targetY = 0;
        didSnap = true;
      }

      // Hard clamp inside screen
      targetX = Math.min(Math.max(targetX, -window.innerWidth + 320), 0);
      targetY = Math.min(Math.max(targetY, 0), window.innerHeight - 150);

      if (didSnap && !snappedRef.current) {
        cyberAudio.playSnap();
        snappedRef.current = true;
      } else if (!didSnap) {
        snappedRef.current = false;
      }

      setOffset({ x: targetX, y: targetY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className="fixed top-14 right-12 z-30 flex flex-col items-end"
    >
      {isMiniDocked ? (
        /* Minimized Tiny Cyber Music Dock */
        <button
          type="button"
          onClick={() => {
            cyberAudio.playBlip();
            setIsMiniDocked(false);
          }}
          className="flex items-center gap-2 rounded-full border border-cyan-500/40 bg-[#070e1a]/95 px-3 py-1.5 shadow-xl shadow-cyan-950/60 backdrop-blur-md hover:border-cyan-400 hover:scale-105 transition group"
          title="Cyber Jukebox / Spotify wieder vergrößern"
        >
          <div className="relative flex h-5 w-5 items-center justify-center text-cyan-400">
            <Music className={`h-4 w-4 ${isPlaying ? "animate-bounce text-cyan-300" : ""}`} />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-cyan-300 font-semibold tracking-wider">
            {isPlaying ? currentChannel.name.split("//")[0].trim() : "Jukebox"}
          </span>
          <span className="text-[9px] text-cyan-400/60 font-mono group-hover:text-white transition">
            [+]
          </span>
        </button>
      ) : (
        /* 1. Floating Mini Controller Bar */
        <div className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-[#070e1a]/92 px-3 py-1.5 shadow-xl shadow-cyan-950/40 backdrop-blur-md">
          <div
            onMouseDown={handleMouseDown}
            className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-cyan-400 font-mono text-[10px] select-none pr-0.5"
            title="Gedrückt halten zum Verschieben (CAD Snap)"
          >
            :::
          </div>
          <button
            onClick={() => {
              cyberAudio.playBlip();
              setIsOpen((prev) => !prev);
            }}
            className="flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-100 transition"
            title="Cyber Jukebox öffnen"
          >
            <div className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Music className="h-3.5 w-3.5" />
              {isPlaying && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                </span>
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-mono text-[10px] text-cyan-200 uppercase tracking-wider line-clamp-1 max-w-[130px]">
                {currentChannel.name}
              </span>
              <span className="text-[9px] text-slate-400 font-sans">
                {isPlaying ? "spielt jetzt..." : "pausiert"}
              </span>
            </div>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600/90 text-white hover:bg-cyan-500 transition shadow-sm"
            title={isPlaying ? "Pause" : "Abspielen"}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
          </button>

          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1 text-slate-400 hover:text-white transition"
            title={isMuted ? "Ton an" : "Stummschalten"}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* Volume Slider */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="h-1 w-14 accent-cyan-400 cursor-pointer hidden md:block"
          />

          {/* Minimize / Full Hide Toggle */}
          <button
            type="button"
            onClick={() => {
              cyberAudio.playBlip();
              setIsMiniDocked(true);
              setIsOpen(false);
            }}
            className="p-1 text-slate-400 hover:text-cyan-300 transition"
            title="Jukebox / Spotify komplett minimieren"
          >
            <span className="font-mono text-xs font-bold">_</span>
          </button>

          {/* Expand/Collapse Playlist Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-slate-400 hover:text-white transition"
            title={isOpen ? "Kanäle schließen" : "Kanäle öffnen"}
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* 2. Expanded Music Center Modal / Dropdown */}
      {isOpen && (
        <div className="mt-2 w-[380px] max-w-[92vw] rounded-2xl border border-cyan-500/40 bg-[#070c18]/96 p-4 shadow-2xl shadow-cyan-950/60 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Disc className="h-4 w-4 text-cyan-400 animate-spin" style={{ animationDuration: isPlaying ? "3s" : "0s" }} />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300">
                Cyber-Radio & Jukebox
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-3 flex gap-1 rounded-xl bg-slate-900/80 p-1 border border-slate-800">
            <button
              onClick={() => setActiveTab("radio")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition ${
                activeTab === "radio"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="h-3 w-3" />
              Radio Streams
            </button>
            <button
              onClick={() => setActiveTab("youtube")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition ${
                activeTab === "youtube"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Youtube className="h-3 w-3" />
              YouTube
            </button>
            <button
              onClick={() => setActiveTab("spotify")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition ${
                activeTab === "spotify"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Disc className="h-3 w-3" />
              Spotify
            </button>
          </div>

          {/* Tab Content */}
          <div className="mt-3">
            {activeTab === "radio" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400">
                  Ausgewählte 24/7 Kanäle:
                </span>
                {PRESET_CHANNELS.filter((c) => c.type === "audio").map((channel) => {
                  const isSelected = currentChannel.id === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => selectChannel(channel)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition ${
                        isSelected
                          ? "border-cyan-400/60 bg-cyan-950/30 text-white"
                          : "border-slate-800/80 bg-[#091220]/60 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-white">{channel.name}</div>
                        <div className="text-[10px] text-slate-400">{channel.genre}</div>
                      </div>
                      {isSelected && isPlaying && (
                        <div className="flex items-end gap-0.5 h-3">
                          <span className="w-0.5 h-3 bg-cyan-400 animate-pulse" />
                          <span className="w-0.5 h-2 bg-cyan-400 animate-pulse delay-75" />
                          <span className="w-0.5 h-2.5 bg-cyan-400 animate-pulse delay-150" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === "youtube" && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono uppercase text-slate-400">
                  YouTube-Stream oder Video einbetten:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="flex-1 rounded-xl border border-slate-800 bg-black/60 px-3 py-1.5 text-xs text-white focus:border-rose-500 focus:outline-none"
                  />
                  <button
                    onClick={handleApplyCustomUrl}
                    className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition"
                  >
                    Laden
                  </button>
                </div>

                {/* Pre-curated YouTube Lofi Button */}
                <button
                  onClick={() => selectChannel(PRESET_CHANNELS[3])}
                  className="mt-1 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5 text-left text-rose-200 hover:border-rose-400 transition"
                >
                  <div className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-rose-400" />
                    <div>
                      <div className="text-xs font-semibold">Lofi Girl 24/7 Live</div>
                      <div className="text-[10px] text-rose-300/60">YouTube Live Stream</div>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </button>

                {/* YouTube Iframe Preview if selected */}
                {currentChannel.type === "youtube" && isPlaying && (
                  <div className="mt-2 flex flex-col gap-1.5 w-full">
                    <div className="rounded-xl overflow-hidden border border-slate-800 shadow-md aspect-video w-full bg-black relative">
                      <iframe
                        src={currentChannel.url}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <a
                      href={currentChannel.url.replace("/embed/", "/watch?v=")}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1 font-mono transition"
                    >
                      <span>Direkt in YouTube öffnen</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {activeTab === "spotify" && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono uppercase text-slate-400">
                  Spotify Playlist / Track einbetten:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/..."
                    className="flex-1 rounded-xl border border-slate-800 bg-black/60 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={handleApplyCustomUrl}
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition"
                  >
                    Laden
                  </button>
                </div>

                {/* Pre-curated Spotify Button */}
                <button
                  onClick={() => selectChannel(PRESET_CHANNELS[4])}
                  className="mt-1 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-left text-emerald-200 hover:border-emerald-400 transition"
                >
                  <div className="flex items-center gap-2">
                    <Disc className="h-4 w-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold">Cyberpunk Synthwave</div>
                      <div className="text-[10px] text-emerald-300/60">Official Spotify Playlist</div>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </button>

                {/* Spotify Iframe Preview if selected */}
                {currentChannel.type === "spotify" && isPlaying && (
                  <div className="mt-2 flex flex-col gap-1.5 w-full">
                    <div className="rounded-xl overflow-hidden border border-slate-800 shadow-md h-[152px] w-full bg-black">
                      <iframe
                        src={currentChannel.url}
                        className="w-full h-full border-0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <a
                        href={currentChannel.url.replace("https://open.spotify.com/embed/", "spotify:").replace(/\?.*$/, "").replace(/\//g, ":")}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1 font-mono transition bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30 shadow-sm"
                        title="Öffnet die installierte Spotify Windows-App direkt im Hintergrund"
                      >
                        <span>In Spotify Desktop-App öffnen ↗</span>
                      </a>
                      <a
                        href={currentChannel.url.replace("/embed/", "/")}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-slate-300 hover:text-white flex items-center justify-center gap-1 font-mono transition bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700/60"
                      >
                        <span>Web Player ↗</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
