import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const VISION_PROMPT = `You are a museum-AI curator. Given the image attached, return exactly the following JSON.
Do not add any prose outside the JSON.

{
  "title": "Working title of the artwork (or 'Unknown')",
  "artist": "Artist name or 'Unknown'",
  "origin": "Indonesian region or island (e.g. 'Java 19th-c', 'Bali contemporary', 'Sulawesi traditional')",
  "period": "Art historical period / century (e.g. 'Wayang Sukawarna 17th-c', 'Modern Indonesian 1970s')",
  "objects": ["list", "of", "key", "visual", "objects", "in", "the", "scene"],
  "colors": ["dominant", "color", "palette", "as", "hex", "codes"],
  "mood": "One word summarising the emotional feel (e.g. 'serene', 'vigilant', 'melankolis')",
  "composition": "Brief phrase describing how elements are arranged",
  "symbolic_elements": ["any", "recognizable", "symbols", "or", "attributes"]
}`;

const VisionJsonSchema = z.object({
  title: z.string().min(1, "title required"),
  artist: z.string().min(1, "artist required"),
  origin: z.string().min(1, "origin required"),
  period: z.string().min(1, "period required"),
  objects: z.array(z.string()).min(1, "objects must have at least 1"),
  colors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "each color must be #RRGGBB")).min(1),
  mood: z.string().min(1),
  composition: z.string().min(1),
  symbolic_elements: z.array(z.string()),
});

const RequestSchema = z.object({
  image: z
    .string()
    .min(1, "image is required")
    .refine((v) => v.startsWith("data:image/"), "image must be data:image/...;base64")
    .refine((v) => v.length < 10_000_000, "image too large (max ~7MB base64)"),
});

const MOCK_POOL = [
  {
    title: "Legong di Pura",
    artist: "I Gusti Nyoman Lempad",
    origin: "Bali contemporary",
    period: "Modern Indonesian 1950s",
    objects: ["dancer", "temple gate", "frangipani", "offering"],
    colors: ["#B45309", "#FEF3C7", "#1E3A3A", "#DC2626"],
    mood: "serene",
    composition: "central figure with symmetrical offerings",
    symbolic_elements: ["canang sari", "udeng"],
  },
  {
    title: "Borobudur Relief Fragment",
    artist: "Unknown",
    origin: "Java 9th-c",
    period: "Central Javanese Classical",
    objects: ["relief", "stupa", "lotus", "monk"],
    colors: ["#57534E", "#A8A29E", "#1C1917", "#D6C7B8"],
    mood: "meditative",
    composition: "horizontal narrative frieze",
    symbolic_elements: ["dharma wheel", "bodhi leaf"],
  },
];

function buildCaption(json: z.infer<typeof VisionJsonSchema>) {
  const caption = `Once upon a time in ${json.origin}, a work titled "${json.title}" by ${json.artist} comes to life. The scene shows ${json.objects.join(", ")}, arranged in ${json.composition.toLowerCase()}. Its palette of ${json.colors.join(", ")} glows with a ${json.mood} feeling, whispering stories of ${json.symbolic_elements.join(" and ") || "silent symbols"}. Step closer and you can almost hear the air hum around the ${json.objects[0]}. Listen carefully, for the artwork is about to tell its own tale.`;
  const tokens = ["<<gamelan_gong>>", "<<suling>>", "<<kendang>>"];
  const listeningPrompt = `Generate a gentle gamelan-based soundscape in slendro scale with soft suling, keeping rhythm sparse to leave room for an English fairy-tale narration in a warm, calm voice. Mood: ${json.mood}.`;
  return { caption, tokens, listeningPrompt };
}

async function callMuseVision(imageDataUrl: string) {
  let apiKey = process.env.MUSE_API_KEY || process.env.FIREWORKS_API_KEY || process.env.BASETEN_API_KEY;
  let apiUrl = process.env.MUSE_API_URL || process.env.FIREWORKS_API_URL || "";
  const model = process.env.MUSE_MODEL || "muse-wonder-1.0";
  if (!apiKey || !apiUrl) return null;
  if (!apiUrl.startsWith("http")) apiUrl = "https://" + apiUrl;
  const isResponsesApi = apiUrl.includes("/responses");

  let res: Response;
  if (isResponsesApi) {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: [{ type: "input_text", text: VISION_PROMPT }, { type: "input_image", image_url: imageDataUrl }] }],
        stream: false,
      }),
    });
  } else {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: [{ type: "text", text: VISION_PROMPT }, { type: "image_url", image_url: { url: imageDataUrl } }] }],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Muse API ${res.status}: ${t.slice(0, 800)}`);
  }
  const data = await res.json();
  let text = "";
  if (isResponsesApi) {
    if (typeof data.output_text === "string") text = data.output_text;
    else {
      const out = data.output ?? data.response ?? [];
      if (Array.isArray(out)) {
        for (const item of out) {
          const c = item.content ?? item.outputs ?? [];
          for (const p of Array.isArray(c) ? c : [c]) {
            if (typeof p.text === "string") text += p.text;
            if (typeof p.output_text === "string") text += p.output_text;
          }
          if (typeof item.text === "string") text += item.text;
        }
      }
      if (!text) text = JSON.stringify(data);
    }
  } else {
    text = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model did not return JSON: " + text.slice(0, 800));
  const parsed = JSON.parse(match[0]);
  const validated = VisionJsonSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("Model JSON failed zod validation: " + validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") + " | raw: " + JSON.stringify(parsed).slice(0, 400));
  }
  return validated.data;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON valid.", details: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Input tidak valid",
        details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 400 }
    );
  }

  const { image } = parsed.data;

  let json: z.infer<typeof VisionJsonSchema> | null = null;
  let source: "muse" | "mock" = "mock";
  let note: string | null = null;

  try {
    const museJson = await callMuseVision(image);
    if (museJson) {
      json = museJson;
      source = "muse";
    }
  } catch (e: any) {
    // Muse error -> fallback to mock but expose zod-safe error
    return NextResponse.json(
      {
        error: "Gagal memanggil Muse",
        details: e.message ?? String(e),
        hint: "Cek MUSE_API_URL / MUSE_API_KEY / MUSE_MODEL di .env.local dan pastikan model support vision (input_image). Server akan fallback ke mock jika key tidak ada, tapi kalau key ada dan error, ini yang kamu lihat.",
      },
      { status: 502 }
    );
  }

  if (!json) {
    const mock = MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)];
    const validated = VisionJsonSchema.safeParse(mock);
    if (!validated.success) {
      return NextResponse.json({ error: "Mock data invalid", details: validated.error.issues }, { status: 500 });
    }
    json = validated.data;
    note = "No Muse credentials configured — using mock. Set MUSE_API_URL and MUSE_API_KEY in .env.local";
  }

  const { caption, tokens, listeningPrompt } = buildCaption(json);
  return NextResponse.json({ source, note, json, caption, tokens, listeningPrompt });
}
