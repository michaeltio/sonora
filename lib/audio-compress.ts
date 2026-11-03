"use client";

import { Mp3Encoder } from "@breezystack/lamejs";

// Compress narration audio so it fits localStorage (~5MB shared quota).
// Strategy: mono mixdown -> resample to 22050 Hz -> MP3 (mono).
// ~2 minutes of narration at 48 kbps is roughly 700 KB as base64 —
// far smaller than WAV, with voice quality far better than 8-bit PCM.

function arrayBufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function renderMono22050(decoded: AudioBuffer): Promise<Float32Array> {
  const targetRate = 22050;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * targetRate)), targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function encodeMp3Mono(samples16: Int16Array, sampleRate: number, kbps: number): Uint8Array {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const frame = 1152;
  const parts: Uint8Array[] = [];
  for (let i = 0; i < samples16.length; i += frame) {
    const chunk = samples16.subarray(i, i + frame);
    const data = encoder.encodeBuffer(chunk);
    if (data.length > 0) parts.push(new Uint8Array(data));
  }
  const end = encoder.flush();
  if (end.length > 0) parts.push(new Uint8Array(end));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * Returns a smaller data:audio/mp3 URL, or null if it can't fit maxChars.
 * Tries 48 kbps first, then falls back to 24 kbps.
 */
export async function compressAudioForStorage(dataUrl: string, maxChars = 1_400_000): Promise<string | null> {
  if (!dataUrl) return null;
  if (dataUrl.startsWith("data:audio/mp3") && dataUrl.length <= maxChars) return dataUrl;
  if (dataUrl.length <= maxChars && dataUrl.startsWith("data:audio/wav")) {
    // Even small WAVs are worth re-encoding: MP3 keeps quality while staying tiny.
  }
  try {
    const res = await fetch(dataUrl);
    const buf = await res.arrayBuffer();
    const AC: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    let decoded: AudioBuffer;
    try {
      decoded = await ctx.decodeAudioData(buf.slice(0));
    } finally {
      ctx.close?.().catch(() => {});
    }
    const mono = await renderMono22050(decoded);
    const pcm16 = floatToInt16(mono);
    for (const kbps of [48, 24]) {
      const mp3 = encodeMp3Mono(pcm16, 22050, kbps);
      const url = `data:audio/mp3;base64,${arrayBufferToBase64(mp3)}`;
      if (url.length <= maxChars) return url;
    }
    return null;
  } catch {
    return null;
  }
}
