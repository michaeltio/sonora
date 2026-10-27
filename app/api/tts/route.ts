import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(1, "text is required").max(2000, "text too long (max 2000)"),
  language: z.string().optional().default("en"),
  // optional speaker reference as data URL for fairy-tale voice cloning later
  speaker_wav: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON valid.", details: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    );
  }

  const { text, language } = parsed.data;
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  const hfModel = process.env.HF_MODEL || "coqui/XTTS-v2";

  if (!hfToken) {
    return NextResponse.json(
      {
        error: "HF_TOKEN belum di-set",
        details: "Isi HF_TOKEN=hf_... di .env.local lalu restart dev server",
        hint: "Buat token di huggingface.co/settings/tokens dengan scope Inference/Read",
      },
      { status: 500 }
    );
  }

  // Hugging Face Inference API
  const hfUrl = `https://api-inference.huggingface.co/models/${hfModel}`;

  try {
    const hfRes = await fetch(hfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          language,
        },
      }),
    });

    if (!hfRes.ok) {
      const t = await hfRes.text();
      // HF returns JSON error or binary error
      return NextResponse.json(
        {
          error: "Hugging Face inference gagal",
          details: `HF ${hfRes.status}: ${t.slice(0, 800)}`,
          hint: "Cek HF_TOKEN, model coqui/XTTS-v2 mungkin butuh speaker_wav. Untuk fairy-tale voice, host di Modal lebih stabil.",
        },
        { status: 502 }
      );
    }

    const contentType = hfRes.headers.get("content-type") || "";

    // HF can return audio/wav or audio/mpeg or JSON with audio
    if (contentType.includes("audio") || contentType.includes("octet-stream")) {
      const buf = Buffer.from(await hfRes.arrayBuffer());
      const base64 = buf.toString("base64");
      const mime = contentType.split(";")[0] || "audio/wav";
      const dataUrl = `data:${mime};base64,${base64}`;
      return NextResponse.json({ source: "huggingface", model: hfModel, audio: dataUrl, mime });
    }

    // If HF returns JSON with base64
    const data = await hfRes.json().catch(() => null);
    if (data && typeof data.audio === "string") {
      return NextResponse.json({ source: "huggingface", model: hfModel, audio: data.audio });
    }

    return NextResponse.json(
      { error: "Format audio dari HF tidak dikenali", details: JSON.stringify(data).slice(0, 600) },
      { status: 502 }
    );
  } catch (e: any) {
    const msg = e.message ?? String(e);
    // Sandbox DNS block for api-inference.huggingface.co -> give dev fallback so UI still testable
    const isDnsBlock = msg.includes("Could not resolve host") || msg.includes("fetch failed") || msg.includes("ENOTFOUND");
    if (isDnsBlock) {
      // Return mock audio strategy: tell frontend to use browser Web Speech as fallback, but also give mock wav header
      return NextResponse.json(
        {
          error: "Gagal menghubungi Hugging Face (sandbox block)",
          details: msg,
          hint: "STRATEGI: 1) Untuk dev, pakai tombol Generate audio sekarang akan fallback ke browser TTS sementara. 2) Untuk XTTS asli, host di Modal dan set MODAL_TTS_URL di .env.local. Lihat /tmp note di server.",
          fallback: true,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "Gagal menghubungi Hugging Face", details: msg }, { status: 502 });
  }
}
