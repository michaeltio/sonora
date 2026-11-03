"use server";

import { z } from "zod";

export interface BgmAlternative {
  trackId: string;
  url: string;
  label: string;
  score: number;
}

export interface BgmMatchInfo {
  trackId: string;
  url: string;
  label: string;
  score: number;
  reason: string;
  alternatives: BgmAlternative[];
  atmosphere: {
    vector: number[];
    labels: Record<string, number>;
    category: string;
    cultureCues: string[];
    mood: string;
  };
}

export interface KbMatchInfo {
  matchId: string;
  title: string;
  score: number;
  verdict: "identified" | "possible" | "unknown";
  sources: string[];
}

export interface NarrationResult {
  title: string;
  kind: string;
  origin: string;
  narration: string;
  source?: "muse" | "muse+kb";
  note?: string | null;
  music?: BgmMatchInfo | null;
  kb?: KbMatchInfo | null;
}

const InputSchema = z.object({ image: z.string().min(1).max(10_000_000) });

export async function generateNarration(input: { image: string }): Promise<
  | ({ ok: true } & NarrationResult)
  | { ok: false; error: string }
> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid image or image too large." };

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: parsed.data.image }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.error || `API ${res.status}` };

    return {
      ok: true,
      ...data,
      title: data?.json?.title || data?.title || "Unknown artwork",
      kind: data?.json?.period || data?.kind || "Indonesian artwork",
      origin: data?.json?.origin || data?.origin || "Indonesia",
      narration: data?.audioScript?.plain || data?.narration || data?.caption || "",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach the Muse API." };
  }
}
