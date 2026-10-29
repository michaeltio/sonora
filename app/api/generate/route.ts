import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const Schema = z.object({ mode: z.enum(["mock", "ai"]).default("mock"), image: z.string().min(1).max(10_000_000) });

const MOCK_RESULT = {
  title: "Penangkapan Pangeran Diponegoro",
  kind: "Indonesian historical painting",
  origin: "Java 19th-c",
  narration:
    "Anda sedang melihat karya Raden Saleh, Penangkapan Pangeran Diponegoro. Di tengah adegan, Diponegoro berdiri dengan jubah putih, sementara para pejabat kolonial mengelilinginya. Warna biru gelap, krem hangat, dan merah bata membangun suasana yang khidmat, tegang, dan penuh keberanian. Perhatikan bagaimana posisi tokoh-tokohnya membentuk percakapan visual tentang kekuasaan dan perlawanan.",
  source: "mock" as const,
  note: "Mock mode — tidak memanggil Muse API.",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Input gambar tidak valid." }, { status: 400 });

    if (parsed.data.mode === "mock") return NextResponse.json({ ok: true, ...MOCK_RESULT });

    const apiKey = process.env.MUSE_API_KEY || process.env.FIREWORKS_API_KEY || process.env.BASETEN_API_KEY;
    const apiUrl = process.env.MUSE_API_URL || process.env.FIREWORKS_API_URL || "";
    if (!apiKey || !apiUrl) return NextResponse.json({ ok: false, error: "MUSE_API_KEY dan MUSE_API_URL belum dikonfigurasi." }, { status: 503 });

    const response = await fetch(apiUrl.startsWith("http") ? apiUrl : `https://${apiUrl}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.MUSE_MODEL || "muse-wonder-1.0",
        messages: [{ role: "user", content: [{ type: "text", text: "Describe this Indonesian artwork. Return JSON with title, kind, origin, narration." }, { type: "image_url", image_url: { url: parsed.data.image } }] }],
        temperature: 0.3,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || `Muse API ${response.status}` }, { status: 502 });
    const text = data?.choices?.[0]?.message?.content || data?.output_text || "";
    const match = text.match(/\{[\s\S]*\}/);
    const json = match ? JSON.parse(match[0]) : null;
    if (!json) return NextResponse.json({ ok: false, error: "Muse tidak mengembalikan JSON yang valid." }, { status: 502 });
    return NextResponse.json({ ok: true, title: json.title || "Unknown artwork", kind: json.kind || "Indonesian artwork", origin: json.origin || "Indonesia", narration: json.narration || "", source: "muse" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Request gagal." }, { status: 400 });
  }
}
