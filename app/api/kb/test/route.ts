import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchKB } from "@/lib/search-kb";
import { BGM_TRACKS } from "@/lib/bgm-tracks";

const Schema = z.object({
  objects: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  mood: z.string().default(""),
  composition: z.string().default(""),
  symbolic_elements: z.array(z.string()).default([]),
  title: z.string().default(""),
  artist: z.string().default(""),
});

/** Test how well given attributes match the current KB (top 3). No file is written. */
export async function POST(request: NextRequest) {
  try {
    const parsed = Schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Input tidak valid", details: parsed.error.issues }, { status: 400 });
    }
    const v = parsed.data;
    const result = searchKB({
      objects: v.objects,
      colors: v.colors,
      mood: v.mood,
      composition: v.composition,
      symbolic_elements: v.symbolic_elements,
      title: v.title,
      artist: v.artist,
    });
    // Suggest music based on the matched entry, fallback to neutral.
    const musicId = result.entry?.music_profile || "warm-reflective";
    const musicLabel = BGM_TRACKS.find((t) => t.id === musicId)?.label || musicId;
    return NextResponse.json({
      ok: true,
      verdict: result.verdict,
      score: result.score,
      matchId: result.entry?.id || null,
      matchTitle: result.entry?.title || null,
      suggestedMusic: musicId,
      suggestedMusicLabel: musicLabel,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Request gagal." }, { status: 400 });
  }
}
