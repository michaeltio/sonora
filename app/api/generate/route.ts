import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { selectBgmForArtwork } from "@/lib/select-bgm";

const Schema = z.object({
  mode: z.enum(["mock", "ai"]).default("mock"),
  image: z.string().startsWith("data:image/").max(10_000_000),
});

const MOCK_RESULT = {
  title: "Penangkapan Pangeran Diponegoro",
  kind: "Indonesian historical painting",
  origin: "Java 19th-c",
  narration:
    "Anda sedang melihat karya Raden Saleh berjudul Penangkapan Pangeran Diponegoro, sebuah lukisan penting dalam sejarah seni Indonesia. Di bagian tengah, Pangeran Diponegoro berdiri tegak dengan jubah putih, wajahnya menunjukkan keteguhan sekaligus kelelahan setelah menghadapi kekuasaan kolonial. Di sekelilingnya, para pejabat Belanda dan pengikutnya membentuk kerumunan yang terasa rapat dan menekan. Perhatikan sosok Jenderal De Kock yang duduk, berlawanan dengan posisi Diponegoro yang berdiri. Kontras ini menggambarkan perbedaan kuasa dan martabat. Warna biru gelap menciptakan suasana berat, sedangkan krem hangat memberi cahaya pada tokoh utama. Merah bata dan cokelat tanah menambah kesan tegang, historis, dan membumi. Raden Saleh tidak hanya melukiskan sebuah peristiwa, tetapi juga menyampaikan kritik tentang penangkapan, perlawanan, dan harga diri. Luangkan waktu untuk mengamati tatapan setiap tokoh, karena di sanalah konflik terasa paling kuat dan suasana politik yang membentuk Indonesia modern pada masa itu.",
  source: "mock" as const,
  note: "Mock mode — tidak memanggil Muse API.",
};

export async function POST(request: NextRequest) {
  try {
    const parsed = Schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Input gambar tidak valid atau terlalu besar." }, { status: 400 });
    }
    if (parsed.data.mode === "mock") {
      const music = selectBgmForArtwork({
        title: MOCK_RESULT.title,
        origin: MOCK_RESULT.origin,
        kind: MOCK_RESULT.kind,
        narration: MOCK_RESULT.narration,
        mood: "solemn, tense, historical",
      });
      return NextResponse.json({
        ok: true,
        ...MOCK_RESULT,
        music: {
          trackId: music.track.id,
          url: music.track.url,
          label: music.track.label,
          score: music.score,
          reason: music.reason,
          alternatives: music.alternatives.map((a) => ({ trackId: a.track.id, url: a.track.url, label: a.track.label, score: a.score })),
          atmosphere: music.atmosphere,
        },
      });
    }

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
      return NextResponse.json({ ok: false, error: data?.error || "Muse vision gagal.", details: data?.details }, { status: describeResponse.status });
    }

    const vision = data?.json;
    const narration: string = data?.audioScript?.plain || data?.caption || "";
    const music = selectBgmForArtwork({
      title: vision?.title,
      artist: vision?.artist,
      origin: vision?.origin,
      period: vision?.period,
      mood: vision?.mood,
      composition: vision?.composition,
      objects: vision?.objects,
      symbolic_elements: vision?.symbolic_elements,
      narration,
      kind: data?.json?.period,
    });

    return NextResponse.json({
      ok: true,
      title: vision?.title || "Unknown artwork",
      kind: vision?.period || "Indonesian artwork",
      origin: vision?.origin || "Indonesia",
      narration,
      source: "muse",
      vision,
      music: {
        trackId: music.track.id,
        url: music.track.url,
        label: music.track.label,
        score: music.score,
        reason: music.reason,
        alternatives: music.alternatives.map((a) => ({ trackId: a.track.id, url: a.track.url, label: a.track.label, score: a.score })),
        atmosphere: music.atmosphere,
      },
      audioScript: data?.audioScript,
      colorsDescribed: data?.colorsDescribed,
      tabletZones: data?.tabletZones,
      cues: data?.cues,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Request gagal." }, { status: 400 });
  }
}
