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
  /** Where the narration voice comes from: server TTS, on-device browser voice, or none yet. */
  ttsSource: "server" | "browser" | null;
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
  const [ttsSource, setTtsSource] = useState<"server" | "browser" | null>(null);
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
  // Fallback narration when the TTS server is unreachable: { text } spoken
  // with the on-device English voice instead of a server-generated audio URL.
  const ttsFallbackRef = useRef<{ text: string; lang: string } | null>(null);
  // Increments on every stop()/new playback so stale async continuations bail out.
  const runIdRef = useRef(0);
  const speakTimeoutRef = useRef<number | null>(null);
  const speakFinishRef = useRef<(() => void) | null>(null);
  const mixedUrlRef = useRef<string | null>(null);

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
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current!;
  }

  const stop = useCallback(() => {
    runIdRef.current++;
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    if (speakTimeoutRef.current) {
      window.clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    // Resolve any pending on-device narration so awaiting callers don't hang.
    if (speakFinishRef.current) {
      const finish = speakFinishRef.current;
      speakFinishRef.current = null;
      try { finish(); } catch {}
    }
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    for (const s of srcsRef.current) try { s.stop(); } catch {}
    srcsRef.current = [];
    // also stop any <audio> fallback
    document.querySelectorAll("audio[data-mixed]").forEach((a) => { (a as HTMLAudioElement).pause(); });
    setState((s) => (s === "playing" ? "ready" : s));
  }, []);

  /** Pick the best on-device English voice, if any. */
  function pickEnglishVoice(): SpeechSynthesisVoice | null {
    try {
      const voices = window.speechSynthesis.getVoices();
      return (
        voices.find((v) => v.lang?.toLowerCase().startsWith("en-us")) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
        null
      );
    } catch {
      return null;
    }
  }

  /** Speak text with the on-device English voice. Resolves when done, on error, or on timeout. */
  function speakFallback(text: string): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        speakFinishRef.current = null;
        if (speakTimeoutRef.current) {
          window.clearTimeout(speakTimeoutRef.current);
          speakTimeoutRef.current = null;
        }
        resolve();
      };
      speakFinishRef.current = finish;
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        const voice = pickEnglishVoice();
        if (voice) u.voice = voice;
        u.rate = 1;
        u.pitch = 1;
        u.onend = finish;
        u.onerror = finish;
        // Safety net: words-per-minute estimate + grace period, in case events never fire.
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        speakTimeoutRef.current = window.setTimeout(finish, Math.max(8000, (words / 2.2) * 1000 + 6000));
        synth.speak(u);
      } catch {
        finish();
      }
    });
  }

  useEffect(() => {
    mixedUrlRef.current = mixedUrl;
  }, [mixedUrl]);

  useEffect(() => {
    return () => {
      stop();
      // Close only once: close() on an already-closed/closing context
      // returns a REJECTED promise (try/catch can't catch that — must .catch it).
      // Without this guard, unmounting mid-playback throws "cannot close AudioContext".
      const ctx = ctxRef.current;
      ctxRef.current = null;
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }
      if (mixedUrlRef.current) {
        try {
          URL.revokeObjectURL(mixedUrlRef.current);
        } catch {}
        mixedUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateTts(text: string, lang = "en"): Promise<string | null> {
    setError(null);
    setTtsSource(null);
    ttsFallbackRef.current = null;
    setState("loading-tts");

    // Server TTS failed/unreachable -> fall back to the on-device English voice.
    const useBrowserFallback = (): boolean => {
      try {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
        ttsFallbackRef.current = { text, lang };
        setTtsSource("browser");
        setState("ready");
        return true;
      } catch {
        return false;
      }
    };

    let serverError: string | null = null;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: lang }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.audio) {
        const url = data.audio as string;
        setTtsUrl(url);
        setTtsSource("server");
        setMixedUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
        mixedBufRef.current = null;
        setState("ready");
        return url;
      }
      serverError = data?.details || data?.error || `TTS ${res.status}`;
    } catch (e: any) {
      serverError = e instanceof Error ? e.message : String(e);
    }

    if (useBrowserFallback()) return null;
    setError(serverError || "TTS unavailable and no on-device voice found.");
    setState("idle");
    return null;
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
    if (!ttsUrl) { setError("Generate TTS first."); return null; }
    if (!musicUrl) { setError("Generate music first."); return null; }
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
  // music fades out 1.5s after narration ends. Narration comes from the
  // server TTS audio when available, otherwise the on-device English voice.
  async function playMixed() {
    const fallback = !ttsUrl ? ttsFallbackRef.current : null;
    if ((!ttsUrl && !fallback) || !musicUrl) { setError("Generate TTS and music first."); return; }
    setError(null);
    try {
      const ctx = ensureCtx();
      stop();
      const musicBuf = await decodeAny(musicUrl, ctx);
      const ttsBuf = ttsUrl ? await decodeAny(ttsUrl, ctx) : null;

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

      const myRun = ++runIdRef.current;
      srcsRef.current = [musicSrc];
      musicSrc.start(t0);
      setState("playing");

      const finishPlayback = () => {
        if (runIdRef.current !== myRun) return;
        try {
          musicGain.gain.cancelScheduledValues(ctx.currentTime);
          musicGain.gain.setValueAtTime(Math.max(0.0002, musicGain.gain.value), ctx.currentTime);
          musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeSec);
        } catch {}
        const stopTimer = window.setTimeout(() => {
          if (runIdRef.current !== myRun) return;
          stop();
          setState("ready");
        }, (fadeSec + 0.15) * 1000);
        timersRef.current.push(stopTimer);
      };

      if (ttsBuf) {
        // --- narration chain (server TTS audio) ---
        const ttsSrc = ctx.createBufferSource();
        ttsSrc.buffer = ttsBuf;
        const ttsGain = ctx.createGain();
        ttsGain.gain.value = ttsVolume;
        ttsSrc.connect(ttsGain);
        ttsGain.connect(ctx.destination);
        ttsSrc.onended = () => finishPlayback();
        srcsRef.current.push(ttsSrc);
        ttsSrc.start(ttsStart);
      } else if (fallback) {
        // --- narration chain (on-device English voice), starts as the music ducks ---
        const speakTimer = window.setTimeout(() => {
          if (runIdRef.current !== myRun) return;
          void speakFallback(fallback.text).then(() => finishPlayback());
        }, Math.max(0, (ttsStart - t0) * 1000));
        timersRef.current.push(speakTimer);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
      setState("ready");
    }
  }

  async function playTtsOnly() {
    if (!ttsUrl) {
      const fb = ttsFallbackRef.current;
      if (!fb) { setError("Generate TTS first."); return; }
      setError(null);
      setState("playing");
      const myRun = ++runIdRef.current;
      await speakFallback(fb.text);
      if (runIdRef.current !== myRun) return;
      setState("ready");
      return;
    }
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
    if (!musicUrl) { setError("Generate music first."); return; }
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
    state, error, ttsUrl, musicUrl, mixedUrl, ttsSource,
    ttsVolume, musicVolume, preset, durationSec,
    setTtsVolume, setMusicVolume, setPreset, setDurationSec,
    setMusicUrl, loadBgm,
    generateTts, generateMusic, buildMix, playMixed, playTtsOnly, playMusicOnly, stop, downloadMix,
  };
}
