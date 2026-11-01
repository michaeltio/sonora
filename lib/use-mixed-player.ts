"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bufferToWavUrl, decodeAny, mixBuffers, synthesizeGamelan } from "@/lib/audio-mixer";

export type MixState = "idle" | "loading-tts" | "loading-music" | "ready" | "playing" | "exporting";
export type MusicPreset = "gamelan-calm" | "gamelan-meditative" | "ambient-warm";

export interface MixedPlayer {
  state: MixState;
  error: string | null;
  ttsUrl: string | null;
  musicUrl: string | null;
  mixedUrl: string | null;
  ttsVolume: number;
  musicVolume: number;
  preset: MusicPreset;
  durationSec: number;
  setTtsVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setPreset: (p: MusicPreset) => void;
  setDurationSec: (n: number) => void;
  generateTts: (text: string, lang?: string) => Promise<string | null>;
  generateMusic: (prompt?: string) => Promise<string | null>;
  loadBgm: (url: string) => void;
  setMusicUrl: (url: string | null) => void;
  buildMix: () => Promise<string | null>;
  playMixed: () => Promise<void>;
  playTtsOnly: () => Promise<void>;
  playMusicOnly: () => Promise<void>;
  stop: () => void;
  downloadMix: () => void;
}

export function useMixedPlayer(): MixedPlayer {
  const [state, setState] = useState<MixState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [mixedUrl, setMixedUrl] = useState<string | null>(null);
  const [ttsVolume, setTtsVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.12);
  const [preset, setPreset] = useState<MusicPreset>("gamelan-calm");
  const [durationSec, setDurationSec] = useState(18);

  const ctxRef = useRef<AudioContext | null>(null);
  const srcsRef = useRef<AudioBufferSourceNode[]>([]);
  const timersRef = useRef<number[]>([]);
  const mixedBufRef = useRef<AudioBuffer | null>(null);

  const loadBgm = useCallback((url: string) => {
    setMusicUrl((old) => {
      if (old && old.startsWith("blob:")) URL.revokeObjectURL(old);
      return url;
    });
    setMixedUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    mixedBufRef.current = null;
  }, []);

  function ensureCtx(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current!;
  }

  const stop = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    for (const s of srcsRef.current) try { s.stop(); } catch {}
    srcsRef.current = [];
    // also stop any <audio> fallback
    document.querySelectorAll("audio[data-mixed]").forEach((a) => { (a as HTMLAudioElement).pause(); });
    setState((s) => (s === "playing" ? "ready" : s));
  }, []);

  useEffect(() => () => {
    stop();
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} }
    if (mixedUrl) URL.revokeObjectURL(mixedUrl);
  }, []); // eslint-disable-line

  async function generateTts(text: string, lang = "id"): Promise<string | null> {
    setError(null);
    setState("loading-tts");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: lang }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // Check if fallback flag is set -> use browser TTS and record as ttsUrl via synthesis?
        if (data?.fallback) {
          // Fallback: use speechSynthesis to create? We can't get buffer, so use null and rely on browser TTS for playTtsOnly
          setError(data?.error || "TTS fallback ke browser. Hasil fine-tune tidak reachable dari sandbox.");
          setState("idle");
          return null;
        }
        throw new Error(data?.details || data?.error || `TTS ${res.status}`);
      }
      const url = data?.audio as string;
      if (!url) throw new Error("TTS tidak mengembalikan audio");
      setTtsUrl(url);
      setMixedUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
      mixedBufRef.current = null;
      setState("ready");
      return url;
    } catch (e: any) {
      setError(e.message ?? String(e));
      setState("idle");
      return null;
    }
  }

  async function generateMusic(prompt?: string): Promise<string | null> {
    setError(null);
    setState("loading-music");
    try {
      // Try server-side musicgen first
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt ?? preset, duration: durationSec }),
      });
      const data = await res.json().catch(() => null);
      if (data?.audio && typeof data.audio === "string" && data.audio.startsWith("data:")) {
        setMusicUrl(data.audio);
        setMixedUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
        mixedBufRef.current = null;
        setState("ready");
        return data.audio as string;
      }
      // Fallback: procedural synth locally
      const ctx = ensureCtx();
      const buf = synthesizeGamelan(ctx, durationSec, preset);
      const url = bufferToWavUrl(buf);
      // store decoded buffer directly is not URL-playable for buildMix, but URL is playable; for mixing we re-synthesize or decode
      // For now store the wav URL
      if (musicUrl && musicUrl.startsWith("blob:")) URL.revokeObjectURL(musicUrl);
      setMusicUrl(url);
      setMixedUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
      mixedBufRef.current = null;
      setState("ready");
      return url;
    } catch (e: any) {
      // absolute fallback: local synth
      try {
        const ctx = ensureCtx();
        const buf = synthesizeGamelan(ctx, durationSec, preset);
        const url = bufferToWavUrl(buf);
        setMusicUrl(url);
        setState("ready");
        return url;
      } catch (e2: any) {
        setError(e2.message ?? e.message ?? String(e));
        setState("idle");
        return null;
      }
    }
  }

  async function buildMix(): Promise<string | null> {
    if (!ttsUrl) { setError("Generate TTS dulu."); return null; }
    if (!musicUrl) { setError("Generate musik dulu."); return null; }
    setError(null);
    setState("exporting");
    try {
      const ctx = ensureCtx();
      const [ttsBuf, musicBuf] = await Promise.all([decodeAny(ttsUrl, ctx), decodeAny(musicUrl, ctx)]);
      const mixed = mixBuffers(ctx, ttsBuf, musicBuf, ttsVolume, musicVolume);
      mixedBufRef.current = mixed;
      const url = bufferToWavUrl(mixed);
      if (mixedUrl) URL.revokeObjectURL(mixedUrl);
      setMixedUrl(url);
      setState("ready");
      return url;
    } catch (e: any) {
      setError(e.message ?? String(e));
      setState("ready");
      return null;
    }
  }

  async function playBuffer(buf: AudioBuffer) {
    const ctx = ensureCtx();
    stop();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => setState("ready");
    srcsRef.current = [src];
    setState("playing");
    src.start(0);
  }

  // Live mix: 1.6s music intro, narration starts ducked, 30s BGM loops,
  // music fades out 1.5s after narration ends.
  async function playMixed() {
    if (!ttsUrl || !musicUrl) { setError("Generate TTS dan Musik dulu."); return; }
    setError(null);
    try {
      const ctx = ensureCtx();
      stop();
      const [ttsBuf, musicBuf] = await Promise.all([decodeAny(ttsUrl, ctx), decodeAny(musicUrl, ctx)]);

      const t0 = ctx.currentTime + 0.05;
      const introSec = 1.6;
      const fadeSec = 1.5;
      const ttsStart = t0 + introSec;

      // --- music chain (looped) ---
      const musicSrc = ctx.createBufferSource();
      musicSrc.buffer = musicBuf;
      musicSrc.loop = true;
      const musicGain = ctx.createGain();
      musicSrc.connect(musicGain);
      musicGain.connect(ctx.destination);

      // intro: silence -> bed*1.6, then duck to bed when narration starts
      const bed = Math.max(0, Math.min(musicVolume, 0.6));
      musicGain.gain.setValueAtTime(0.0001, t0);
      musicGain.gain.linearRampToValueAtTime(Math.max(0.0002, bed * 1.6), t0 + introSec * 0.9);
      musicGain.gain.linearRampToValueAtTime(Math.max(0.0002, bed * 0.65), ttsStart + 1.0);

      // --- narration chain ---
      const ttsSrc = ctx.createBufferSource();
      ttsSrc.buffer = ttsBuf;
      const ttsGain = ctx.createGain();
      ttsGain.gain.value = ttsVolume;
      ttsSrc.connect(ttsGain);
      ttsGain.connect(ctx.destination);

      const ttsDur = ttsBuf.duration;
      const endAt = ttsStart + ttsDur;

      musicSrc.start(t0);
      ttsSrc.start(ttsStart);
      srcsRef.current = [ttsSrc, musicSrc];
      setState("playing");

      // fade music out after narration ends, then stop everything
      const fadeTimer = window.setTimeout(() => {
        try {
          musicGain.gain.cancelScheduledValues(ctx.currentTime);
          musicGain.gain.setValueAtTime(Math.max(0.0002, musicGain.gain.value), ctx.currentTime);
          musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeSec);
        } catch {}
      }, Math.max(0, (endAt - t0) * 1000));
      const stopTimer = window.setTimeout(() => {
        stop();
        setState("ready");
      }, Math.max(0, (endAt - t0 + fadeSec + 0.15) * 1000));
      timersRef.current = [fadeTimer, stopTimer];

      ttsSrc.onended = () => {
        // ended fires at narration end; timers handle the fade + cleanup
      };
    } catch (e: any) {
      setError(e.message ?? String(e));
      setState("ready");
    }
  }

  async function playTtsOnly() {
    if (!ttsUrl) { setError("Generate TTS dulu."); return; }
    try {
      const ctx = ensureCtx();
      const buf = await decodeAny(ttsUrl, ctx);
      // apply ttsVolume
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < d.length; i++) d[i] *= ttsVolume;
      }
      await playBuffer(buf);
    } catch (e: any) { setError(e.message ?? String(e)); setState("ready"); }
  }

  async function playMusicOnly() {
    if (!musicUrl) { setError("Generate musik dulu."); return; }
    try {
      const ctx = ensureCtx();
      const buf = await decodeAny(musicUrl, ctx);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < d.length; i++) d[i] *= musicVolume * 2.5; // music preview louder
      }
      await playBuffer(buf);
    } catch (e: any) { setError(e.message ?? String(e)); setState("ready"); }
  }

  function downloadMix() {
    const url = mixedUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = "sonora-mix.wav"; a.click();
  }

  return {
    state, error, ttsUrl, musicUrl, mixedUrl,
    ttsVolume, musicVolume, preset, durationSec,
    setTtsVolume, setMusicVolume, setPreset, setDurationSec,
    setMusicUrl, loadBgm,
    generateTts, generateMusic, buildMix, playMixed, playTtsOnly, playMusicOnly, stop, downloadMix,
  };
}
