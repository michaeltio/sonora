import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { searchKB } from "@/lib/search-kb";

const EntrySchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-z0-9-]+/),
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  year: z.string().max(50).default("unknown"),
  origin: z.string().max(100).default("Indonesia"),
  period: z.string().max(100).default("unknown"),
  category: z.enum(["painting", "sculpture", "textile"]),
  summary: z.string().min(20).max(2000),
  visual_cues: z.object({
    objects: z.array(z.string()).min(1),
    colors: z.array(z.string()).min(1),
    composition: z.string().min(1),
  }),
  identity_evidence: z.array(z.string()).default([]),
  music_profile: z.string().max(50).default("warm-reflective"),
  sources: z.array(z.string()).default([]),
});

const DB_PATH = path.join(process.cwd(), "data", "artworks.json");

export async function POST(request: NextRequest) {
  try {
    const parsed = EntrySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid entry", details: parsed.error.issues }, { status: 400 });
    }
    const entry = parsed.data;
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const db = JSON.parse(raw) as { version: number; entries: unknown[] };
    if (!Array.isArray(db.entries)) {
      return NextResponse.json({ ok: false, error: "KB database is corrupted." }, { status: 500 });
    }
    if ((db.entries as { id?: string }[]).some((e) => e.id === entry.id)) {
      return NextResponse.json({ ok: false, error: `ID '${entry.id}' already exists in the KB.` }, { status: 409 });
    }
    (db.entries as unknown[]).push(entry);
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2) + "\n");

    const selfTest = searchKB({
      objects: entry.visual_cues.objects,
      colors: entry.visual_cues.colors,
      mood: "",
      composition: entry.visual_cues.composition,
      symbolic_elements: [],
      title: entry.title,
      artist: entry.artist,
    });

    return NextResponse.json({
      ok: true,
      id: entry.id,
      totalEntries: db.entries.length,
      selfTest: {
        verdict: selfTest.verdict,
        score: selfTest.score,
        matchedId: selfTest.entry?.id || null,
      },
      note: "Saved permanently to data/artworks.json. Commit the file so it gets deployed.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}
