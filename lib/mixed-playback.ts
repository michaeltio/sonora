"use client";

import { dataUrlToAudioBuffer, fetchAudioBuffer } from "@/lib/audio-mixer";

export type MixedNote = "mixed" | "narration-only" | "browser" | "generated";

export interface MixedHandle {
  stop(): void;
}

function decodeAudio(url: string, ctx: AudioContext): Promise<AudioBuffer> {
  if (url.startsWith("data:")) return dataUrlToAudioBuffer(url, ctx);
  return fetchAudioBuffer(url, ctx);
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

let sharedCtx: AudioContext | null = null;

function ensureCtx(): AudioContext {
  if (sharedCtx && sharedCtx.state !== "closed") {
    if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
    return sharedCtx;
  }
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  sharedCtx = new AC();
  if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

async function fetchGeneratedNarration(text: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      "/api/tts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: "en" }),
      },
      120000
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.audio) return null;
    return data.audio as string;
  } catch {
    return null;
  }
}

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

export async function playMixedNarration(opts: {
  narrationUrl: string | null;
  narrationText: string;
  musicUrl: string | null;
  musicVolume?: number;
  onEnded?: () => void;
}): Promise<{ handle: MixedHandle; note: MixedNote }> {
  const bed = Math.max(0, Math.min(opts.musicVolume ?? 0.12, 0.6));
  const onEnded = opts.onEnded;

  let settled = false;
  let sources: AudioBufferSourceNode[] = [];
  let timers: number[] = [];
  let utterance: SpeechSynthesisUtterance | null = null;

  const fireEnded = () => {
    if (settled) return;
    settled = true;
    try {
      onEnded?.();
    } catch {}
  };

  const stop = () => {
    if (settled) return;
    settled = true;
    for (const t of timers) window.clearTimeout(t);
    timers = [];
    for (const s of sources) {
      try {
        s.stop();
      } catch {}
    }
    sources = [];
    if (utterance) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      utterance = null;
    }
  };

  const speakWithMusic = async (musicBuf: AudioBuffer | null): Promise<MixedNote> => {
    if (!("speechSynthesis" in window)) {
      fireEnded();
      return "browser";
    }
    try {
      const ctx = ensureCtx();
      if (musicBuf) {
        const musicSrc = ctx.createBufferSource();
        musicSrc.buffer = musicBuf;
        musicSrc.loop = true;
        const musicGain = ctx.createGain();
        musicGain.gain.value = Math.max(0.0002, bed);
        musicSrc.connect(musicGain);
        musicGain.connect(ctx.destination);
        sources = [musicSrc];
        musicSrc.start(0);
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(opts.narrationText);
      u.lang = "en-US";
      u.rate = 0.95;
      const voice = pickEnglishVoice();
      if (voice) u.voice = voice;
      u.onend = () => {
        stop();
        fireEnded();
      };
      u.onerror = () => {
        stop();
        fireEnded();
      };
      utterance = u;
      window.speechSynthesis.speak(u);
      return "browser";
    } catch {
      stop();
      fireEnded();
      return "browser";
    }
  };

  let narrationUrl = opts.narrationUrl;
  let note: MixedNote = "mixed";
  if (!narrationUrl) {
    narrationUrl = await fetchGeneratedNarration(opts.narrationText);
    note = "generated";
    if (settled) return { handle: { stop }, note };
  }

  try {
    const ctx = ensureCtx();
    let narrationBuf: AudioBuffer | null = null;
    if (narrationUrl) {
      try {
        narrationBuf = await decodeAudio(narrationUrl, ctx);
      } catch {
        narrationBuf = null;
      }
    }
    if (settled) return { handle: { stop }, note };

    if (!narrationBuf) {
      let musicBuf: AudioBuffer | null = null;
      if (opts.musicUrl) {
        try {
          musicBuf = await decodeAudio(opts.musicUrl, ctx);
        } catch {
          musicBuf = null;
        }
      }
      if (settled) return { handle: { stop }, note };
      return { handle: { stop }, note: await speakWithMusic(musicBuf) };
    }

    let musicBuf: AudioBuffer | null = null;
    if (opts.musicUrl) {
      try {
        musicBuf = await decodeAudio(opts.musicUrl, ctx);
      } catch {
        musicBuf = null;
      }
    }
    if (settled) return { handle: { stop }, note };

    if (!musicBuf) {
      const ttsSrc = ctx.createBufferSource();
      ttsSrc.buffer = narrationBuf;
      ttsSrc.connect(ctx.destination);
      ttsSrc.onended = () => fireEnded();
      sources = [ttsSrc];
      ttsSrc.start(0);
      return { handle: { stop }, note: "narration-only" };
    }

    const t0 = ctx.currentTime + 0.05;
    const introSec = 1.6;
    const fadeSec = 1.5;
    const ttsStart = t0 + introSec;

    const musicSrc = ctx.createBufferSource();
    musicSrc.buffer = musicBuf;
    musicSrc.loop = true;
    const musicGain = ctx.createGain();
    musicSrc.connect(musicGain);
    musicGain.connect(ctx.destination);

    musicGain.gain.setValueAtTime(0.0001, t0);
    musicGain.gain.linearRampToValueAtTime(Math.max(0.0002, bed * 1.6), t0 + introSec * 0.9);
    musicGain.gain.linearRampToValueAtTime(Math.max(0.0002, bed * 0.65), ttsStart + 1.0);

    sources = [musicSrc];
    musicSrc.start(t0);

    const finishPlayback = () => {
      if (settled) return;
      try {
        musicGain.gain.cancelScheduledValues(ctx.currentTime);
        musicGain.gain.setValueAtTime(Math.max(0.0002, musicGain.gain.value), ctx.currentTime);
        musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeSec);
      } catch {}
      const stopTimer = window.setTimeout(() => {
        stop();
        fireEnded();
      }, (fadeSec + 0.15) * 1000);
      timers.push(stopTimer);
    };

    const ttsSrc = ctx.createBufferSource();
    ttsSrc.buffer = narrationBuf;
    ttsSrc.connect(ctx.destination);
    ttsSrc.onended = () => finishPlayback();
    sources.push(ttsSrc);
    ttsSrc.start(ttsStart);

    return { handle: { stop }, note };
  } catch {
    stop();
    fireEnded();
    return { handle: { stop }, note: "narration-only" };
  }
}
