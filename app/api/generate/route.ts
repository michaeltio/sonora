import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { selectBgmForArtwork } from "@/lib/select-bgm";
import { searchKB } from "@/lib/search-kb";
import { BGM_TRACKS } from "@/lib/bgm-tracks";

const Schema = z.object({
  image: z.string().startsWith("data:image/").max(10_000_000),
});

/** Second Muse call (text-only, no image): rewrite the narration using verified KB facts. */
async function narrateWithFacts(
  vision: any,
  entry: { title: string; artist: string; period?: string; origin?: string; summary: string }
): Promise<string | null> {
  try {
    const apiKey = process.env.MUSE_API_KEY || process.env.FIREWORKS_API_KEY || process.env.BASETEN_API_KEY;
    let apiUrl = process.env.MUSE_API_URL || process.env.FIREWORKS_API_URL || "";
    if (!apiKey || !apiUrl) return null;
    if (!apiUrl.startsWith("http")) apiUrl = `https://${apiUrl}`;
    const model = process.env.MUSE_MODEL || "muse-wonder-1.0";
    const identityLine =
      `The artwork has been verified as "${entry.title}" by ${entry.artist} (${entry.period || "period unknown"}). State this confidently and directly — never hedge with phrases like "This may be", "possibly", "might be", or "could be".`;
    const prompt =
      `You are an expert Indonesian museum curator writing for an English-speaking blind or low-vision listener.\n` +
      `Write EVERYTHING in English. No Indonesian words anywhere — translate or use the English form.\n` +
      `VERIFIED FACTS (use these, do not invent others): Title: ${entry.title}. Artist: ${entry.artist}. Period: ${entry.period || "unknown"}. Origin: ${entry.origin || "unknown"}. Context: ${entry.summary}\n` +
      `WHAT IS VISIBLE: objects: ${(vision?.objects || []).join(", ")}. Composition: ${vision?.composition || ""}. Mood: ${vision?.mood || ""}.\n` +
      `${identityLine}\n` +
      `Write a 120-150 word English audio-guide narration (aim ~140 words, short 8-18 word sentences). ` +
      `Describe positions with left/right/center/foreground/background, familiar color words (never hex codes), texture, light, and emotion. ` +
      `Do not say "Once upon a time". Do not exceed 150 words. Output narration text only, no JSON, no preamble.`;
    const isResponsesApi = apiUrl.includes("/responses");
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(
        isResponsesApi
          ? { model, input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }], stream: false }
          : { model, messages: [{ role: "user", content: prompt }], temperature: 0.5, max_tokens: 400 }
      ),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    let text: string =
      data?.output_text || data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    if (!text && Array.isArray(data?.output)) {
      text = data.output
        .flatMap((x: any) => x.content || [])
        .map((x: any) => x.text || x.output_text || "")
        .join("");
    }
    text = String(text || "").trim();
    if (!text) return null;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 40 || words.length > 220) return null;
    return text;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {  try {
    const parsed = Schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid image input or image too large." }, { status: 400 });
    }
    // LLM dulu: hanya status "identified" (terverifikasi kuat) yang langsung dipercaya.
    // Status "possible" artinya LLM sendiri belum yakin, jadi searchKB tetap jalan
    // sebagai verifikasi/fallback. Begitu juga "unknown".

    // Reuse the existing, provider-compatible Muse vision route. It supports
    // both OpenAI chat-completions and Responses-style providers.
    const describeResponse = await fetch(new URL("/api/describe", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: parsed.data.image }),
      cache: "no-store",
    });
    const data = await describeResponse.json().catch(() => null);
    if (!describeResponse.ok) {
      return NextResponse.json({ ok: false, error: data?.error || "Muse vision failed.", details: data?.details }, { status: describeResponse.status });
    }

    const vision = data?.json;
    const llmIdentity: string | undefined = vision?.identity_status;
    const llmIdentified = llmIdentity === "identified";

    // ---- Retrieval: jalan kecuali LLM sudah "identified" dengan bukti kuat ----
    // searchKB murni kode lokal (tanpa API call): vision JSON in, entry + skor out.
    let kb: { entry: any; score: number; verdict: "identified" | "possible" | "unknown" } = {
      entry: null,
      score: 0,
      verdict: "unknown",
    };
    if (!llmIdentified && vision) {
      const found = searchKB({
        objects: vision.objects,
        colors: vision.colors,
        mood: vision.mood,
        composition: vision.composition,
        symbolic_elements: vision.symbolic_elements,
        title: vision.title,
        artist: vision.artist,
      });
      kb = { entry: found.entry, score: found.score, verdict: found.verdict };
    }

    // ---- Narasi berfakta: hanya kalau fallback KB menemukan yang cocok ----
    let narration: string = data?.audioScript?.plain || data?.caption || "";
    let narrationSource: "muse" | "muse+kb" = "muse";
    if (!llmIdentified && kb.entry && (kb.verdict === "identified" || kb.verdict === "possible")) {
      const kbNarration = await narrateWithFacts(vision, kb.entry);
      if (kbNarration) {
        narration = kbNarration;
        narrationSource = "muse+kb";
      }
    }

    const music = selectBgmForArtwork({
      title: kb.entry?.title || vision?.title,
      artist: kb.entry?.artist || vision?.artist,
      origin: kb.entry?.origin || vision?.origin,
      period: kb.entry?.period || vision?.period,
      mood: vision?.mood,
      composition: vision?.composition,
      objects: vision?.objects,
      symbolic_elements: vision?.symbolic_elements,
      narration,
      kind: data?.json?.period,
    });

    // Kalau KB cocok kuat dan entry punya music_profile, pakai musik dari KB.
    let musicOut = {
      trackId: music.track.id,
      url: music.track.url,
      label: music.track.label,
      score: music.score,
      reason: music.reason,
      alternatives: music.alternatives.map((a) => ({ trackId: a.track.id, url: a.track.url, label: a.track.label, score: a.score })),
      atmosphere: music.atmosphere,
    };
    if (kb.entry?.music_profile) {
      const kbTrack = BGM_TRACKS.find((t) => t.id === kb.entry!.music_profile);
      if (kbTrack) {
        musicOut = {
          ...musicOut,
          trackId: kbTrack.id,
          url: kbTrack.url,
          label: kbTrack.label,
          reason: `${music.reason} · Musik dipilih dari knowledge base (${kb.entry.title}).`,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      title: kb.entry?.title || vision?.title || "Unknown artwork",
      kind: kb.entry?.period || vision?.period || "Indonesian artwork",
      origin: kb.entry?.origin || vision?.origin || "Indonesia",
      narration,
      source: narrationSource,
      kb: kb.entry
        ? { matchId: kb.entry.id, title: kb.entry.title, score: kb.score, verdict: kb.verdict, sources: kb.entry.sources }
        : null,
      vision,
      music: musicOut,
      audioScript: data?.audioScript,
      colorsDescribed: data?.colorsDescribed,
      tabletZones: data?.tabletZones,
      cues: data?.cues,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}
