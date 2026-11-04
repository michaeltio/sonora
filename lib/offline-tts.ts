"use client";

import {
  KOKORO_MODEL_ID,
  KOKORO_SAMPLE_RATE,
  KOKORO_VOICE,
  concatWithSilence,
  float32ToWavBlob,
  splitChunks,
} from "./kokoro-utils";

type Pending = {
  key: string;
  resolve: (url: string | null) => void;
  onProgress?: (message: string) => void;
  timer: number;
};

const urlCache = new Map<string, string>();
const MAX_CACHE = 3;
const DEFAULT_TIMEOUT_MS = 240000;

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function cacheUrl(text: string, url: string): string {
  urlCache.set(text, url);
  if (urlCache.size > MAX_CACHE) {
    const oldest = urlCache.keys().next().value as string | undefined;
    if (oldest && oldest !== text) {
      const oldUrl = urlCache.get(oldest);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      urlCache.delete(oldest);
    }
  }
  return url;
}

function getWorker(): Worker | null {
  if (typeof Worker === "undefined" || workerFailed) return null;
  try {
    if (!worker) {
      worker = new Worker(new URL("./kokoro.worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data as {
          id: number;
          type: string;
          message?: string;
          samples?: Float32Array;
          sampleRate?: number;
        };
        const p = pending.get(m.id);
        if (!p) return;
        if (m.type === "progress") {
          p.onProgress?.(m.message ?? "");
        } else if (m.type === "done") {
          pending.delete(m.id);
          window.clearTimeout(p.timer);
          if (m.samples && m.samples.length > 0) {
            p.resolve(cacheUrl(p.key, URL.createObjectURL(float32ToWavBlob(m.samples, m.sampleRate ?? KOKORO_SAMPLE_RATE))));
          } else {
            p.resolve(null);
          }
        } else {
          pending.delete(m.id);
          window.clearTimeout(p.timer);
          p.resolve(null);
        }
      };
      worker.onerror = () => {
        workerFailed = true;
        try {
          worker?.terminate();
        } catch {}
        worker = null;
        for (const [, p] of pending) {
          window.clearTimeout(p.timer);
          p.resolve(null);
        }
        pending.clear();
      };
    }
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

async function generateOnMainThread(
  text: string,
  onProgress?: (message: string) => void
): Promise<string | null> {
  try {
    const { KokoroTTS } = await import("kokoro-js");
    onProgress?.("Loading offline voice…");
    const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
      dtype: "q8",
      device: "wasm",
    });
    const chunks = splitChunks(text);
    const parts: Float32Array[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(`Voicing offline (${i + 1}/${chunks.length})…`);
      const out = await tts.generate(chunks[i], { voice: KOKORO_VOICE });
      if (!out?.audio?.length) return null;
      parts.push(out.audio);
    }
    const merged = concatWithSilence(parts, KOKORO_SAMPLE_RATE);
    return URL.createObjectURL(float32ToWavBlob(merged, KOKORO_SAMPLE_RATE));
  } catch {
    return null;
  }
}

export async function generateOfflineSpeechUrl(
  text: string,
  onProgress?: (message: string) => void,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string | null> {
  const clean = text.trim();
  if (!clean) return null;
  const cached = urlCache.get(clean);
  if (cached) return cached;

  const w = getWorker();
  if (w) {
    onProgress?.("Loading offline voice…");
    const result = await new Promise<string | null>((resolve) => {
      const id = nextId++;
      const timer = window.setTimeout(() => {
        pending.delete(id);
        resolve(null);
      }, timeoutMs);
      pending.set(id, { key: clean, resolve, onProgress, timer });
      try {
        w.postMessage({ id, text: clean });
      } catch {
        pending.delete(id);
        window.clearTimeout(timer);
        resolve(null);
      }
    });
    if (result) return result;
  }

  const fallback = await generateOnMainThread(clean, onProgress);
  if (fallback) return cacheUrl(clean, fallback);
  return null;
}
