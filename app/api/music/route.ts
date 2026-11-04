import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const Schema = z.object({
  prompt: z.string().min(1).max(500).optional().default("gentle gamelan slendro, soft suling flute, sparse kendang, ambient, calm"),
  duration: z.number().min(2).max(30).optional().default(15),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }
  const { prompt, duration } = parsed.data;

  return NextResponse.json({
    source: "procedural",
    procedural: true,
    prompt,
    duration,
    hint: "Uses the local gamelan synthesizer (Web Audio). No API key needed.",
    presets: [
      { id: "gamelan-calm", label: "Gamelan Calm — gentle slendro", prompt: "gamelan slendro, suling, gong sparse" },
      { id: "gamelan-meditative", label: "Meditative — bonang + gong", prompt: "meditative bonang, gong ageng, slow" },
      { id: "ambient-warm", label: "Ambient Warm — pad + suling", prompt: "warm ambient pad, suling flute" },
    ],
  });
}
