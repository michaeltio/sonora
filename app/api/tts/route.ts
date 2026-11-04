import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(1, "text is required").max(2000, "text too long (max 2000)"),
  language: z.string().optional().default("en"),
  speaker_wav: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", details: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    );
  }

  const { text, language } = parsed.data;

  const xttsUrl = process.env.XTTS_URL;
  if (xttsUrl) {
    try {
      const r = await fetch(xttsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(180000),
        body: JSON.stringify({
          text,
          language,
          speaker_wav: process.env.XTTS_SPEAKER_WAV || "speaker.wav",
        }),
      });
      if (r.ok) {
        const contentType = r.headers.get("content-type") || "";
        if (contentType.includes("audio") || contentType.includes("octet-stream")) {
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > 1000) {
            return NextResponse.json({
              source: "xtts-custom",
              audio: `data:audio/wav;base64,${buf.toString("base64")}`,
              mime: "audio/wav",
            });
          }
        } else {
          const data = await r.json().catch(() => null);
          if (data?.audio) {
            return NextResponse.json({ source: "xtts-custom", audio: data.audio, mime: "audio/mpeg" });
          }
        }
      } else {
        const errText = await r.text().catch(() => "");
        console.warn("[tts] XTTS failed:", r.status, errText.slice(0, 300));
      }
    } catch (e) {
      console.warn("[tts] XTTS error:", e instanceof Error ? e.message : String(e));
    }
  }

  const ttsUrl = process.env.TTS_URL;
  if (ttsUrl) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.TTS_KEY) headers["x-sonora-key"] = process.env.TTS_KEY;
      const r = await fetch(ttsUrl, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({ text, language }),
      });
      const data = await r.json().catch(() => null);
      if (r.ok && data?.audio) {
        return NextResponse.json({ source: "hosted-tts", audio: data.audio, mime: "audio/mpeg" });
      }
      console.warn("[tts] hosted TTS failed:", r.status, JSON.stringify(data)?.slice(0, 300));
    } catch (e) {
      console.warn("[tts] hosted TTS error:", e instanceof Error ? e.message : String(e));
    }
  }

  return NextResponse.json(
    {
      error: "No active TTS endpoint",
      details: "Set XTTS_URL (XTTS server) or TTS_URL (hosted /speak endpoint) in the environment.",
    },
    { status: 503 }
  );
}
