import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const VISION_PROMPT = `You are an expert Indonesian museum curator and accessibility narrator. Analyze the attached artwork for an English-speaking blind or low-vision listener.
Return ONLY valid JSON, with no markdown and no prose outside the JSON. Every text value must be written in clear, natural English.

First, perform an internal identification check. Decide whether the artwork can be reliably identified from visible evidence such as a readable label, signature, distinctive landmark, or highly specific recognizable composition. Do not identify a famous artist merely because the brushwork, colors, subject, or style feels similar. If the evidence is weak or ambiguous, set identity_status to "unknown". If there is a plausible but unverified possibility, set identity_status to "possible". Use "identified" only when the evidence is strong.

Then write the final audio-guide narration in the "narration" field with 120–150 words, aiming for approximately 140 words. The narration must be understandable when heard only once. Use short, natural sentences, usually 8–18 words each.

If identity_status is "identified", briefly introduce the verified title, artist, place, period, and relevant historical context, then describe the visible scene. Do not spend most of the narration on history.

If identity_status is "possible" or "unknown", do not present guesses as facts and do not invent history, provenance, symbolism, or an artist. Begin naturally with a sentence such as: "The title and artist cannot be confirmed from this image, so this description focuses on what can be seen." Then use the full narration for concrete visual description: the main subject, size, position, left and right relationships, foreground and background, posture, facial expression, gesture, material, texture, light, shadow, familiar colors, distance, movement, and emotional atmosphere.

Use concrete, imaginable language for a blind listener. Use phrases such as "on the left," "at the center," "behind the figure," and "near the lower edge." Explain colors with familiar English words such as brick red, deep blue, warm cream, golden yellow, moss green, earth brown, and ivory white. Describe how colors feel in the scene, never their technical values.

Do not use hex color codes anywhere in the narration. Do not say "Once upon a time." Do not list every object. Do not repeat the title unnecessarily. Do not use overly academic language or abstract metaphors. Do not invent details that cannot be seen. Never exceed 150 words. The narration should feel calm, human, emotionally engaging, and suitable for one listening.

Return exactly this JSON shape:
{
  "identity_status": "identified" | "possible" | "unknown",
  "identity_confidence": "high" | "medium" | "low",
  "identity_evidence": ["short visible reasons, or an empty array"],
  "title": "A verified title, a possible title, or Unknown",
  "artist": "A verified artist, a possible artist, or Unknown",
  "origin": "Verified Indonesian region or approximate period, or Unknown",
  "period": "Verified art historical period or century, or Unknown",
  "objects": ["the most important visible subjects, in viewing order"],
  "colors": ["dominant colors as #RRGGBB values for internal processing only"],
  "mood": "a concise emotional description in English",
  "composition": "a clear spatial description using left, right, center, foreground, or background in English",
  "symbolic_elements": ["recognizable symbols or attributes only if visibly supported"],
  "narration": "A 120–150 word English audio-guide narration following the identified or visual-only rules above"
}

Remember: hex values are for the JSON colors array only. They must never appear in narration.`;

const VisionJsonSchema = z.object({
  title: z.string().min(1), artist: z.string().min(1), origin: z.string().min(1), period: z.string().min(1),
  objects: z.array(z.string()).min(1), colors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).min(1), mood: z.string().min(1), composition: z.string().min(1), symbolic_elements: z.array(z.string()), identity_status: z.enum(["identified", "possible", "unknown"]).optional(), identity_confidence: z.enum(["high", "medium", "low"]).optional(), identity_evidence: z.array(z.string()).optional(), narration: z.string().min(1).max(1400).optional(),
});
const RequestSchema = z.object({ image: z.string().min(1).refine((v) => v.startsWith("data:image/"), "image must be data URL").refine((v) => v.length < 10_000_000, "image too large") });

const MOCK_POOL = [{ title: "Legong di Pura", artist: "I Gusti Nyoman Lempad", origin: "Bali", period: "Modern Indonesian 1950s", objects: ["seorang penari", "gerbang pura", "bunga kamboja", "sesajen"], colors: ["#B45309", "#FEF3C7", "#1E3A3A", "#DC2626"], mood: "hening dan sakral", composition: "tokoh utama berada di tengah, dengan gerbang pura di belakangnya", symbolic_elements: ["canang sari", "udeng"] }, { title: "Borobudur Relief Fragment", artist: "Unknown", origin: "Jawa", period: "Jawa Tengah abad ke-9", objects: ["relief batu", "stupa", "bunga teratai", "seorang biksu"], colors: ["#57534E", "#A8A29E", "#1C1917", "#D6C7B8"], mood: "hening dan meditatif", composition: "adegan memanjang dari kiri ke kanan seperti rangkaian cerita", symbolic_elements: ["roda dharma", "daun bodhi"] }];

function colorName(hex: string) {
  const known: Record<string, string> = { "#B45309": "earthy orange", "#FEF3C7": "soft cream", "#1E3A3A": "deep blue-green", "#DC2626": "bright red", "#57534E": "stone gray", "#A8A29E": "warm gray", "#1C1917": "charcoal black", "#D6C7B8": "stone cream" };
  if (known[hex.toUpperCase()]) return known[hex.toUpperCase()];
  const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  if (r > 180 && g < 100) return "warm red"; if (r > 170 && g > 130 && b < 100) return "golden yellow"; if (b > r && b > g) return "blue"; if (g > r && g > b) return "leaf green"; if (r > 190 && g > 170) return "ivory white"; return "soft brown and gray";
}

function buildCaption(json: z.infer<typeof VisionJsonSchema>) {
  const [main, second, ...background] = json.objects;
  const colors = json.colors.slice(0, 3).map(colorName);
  const openings = ["Let us pause and come closer to this work.", "Imagine standing directly in front of this artwork.", "This artwork invites us to slow down and look carefully.", "Before you is a scene filled with feeling."];
  const opening = openings[Math.floor(Math.random() * openings.length)];
  const composition = json.composition.charAt(0).toUpperCase() + json.composition.slice(1);
  const symbolic = json.symbolic_elements.length ? `Possible symbolic details include ${json.symbolic_elements.join(", ")}.` : "Its meaning is carried mainly through gesture, expression, and atmosphere.";
  const caption = json.narration || (json.identity_status === "unknown" || json.identity_status === "possible" ? `The title and artist cannot be confirmed from this image, so this description focuses on what can be seen. ${composition}. The main focus is ${main}. ${second ? `Nearby, you can notice ${second}.` : "Notice the central form that holds your attention."} ${background.length ? `In the background, there is ${background.join(" and ")}.` : "The background leaves space for the main subject."} Imagine the colors as light and temperature rather than technical codes: ${colors.join(", ")}. The overall mood is ${json.mood}. Let your attention travel through the figures, gestures, textures, and empty space. Together, these details create an emotional story without claiming a history that cannot be confirmed.` : `${opening} This is ${json.title}, by ${json.artist}, from ${json.origin}, dating to ${json.period}. ${composition}. The main focus is ${main}. ${second ? `Nearby, you can notice ${second}.` : "Notice the central form that holds your attention."} ${background.length ? `In the background, there is ${background.join(" and ")}.` : "The background leaves space for the main subject."} Imagine the colors as light and temperature: ${colors.join(", ")}. The overall mood is ${json.mood}. ${symbolic} Let your attention travel from the figures and their gestures to the surrounding space. These details connect the visible scene with the work's emotional and historical meaning.`);
  const tokens = ["<<gamelan_gong>>", "<<suling>>", "<<kendang>>"];
  const listeningPrompt = `Create a soft instrumental Indonesian-inspired museum soundscape. No vocals, no dominant melody, sparse rhythm, and plenty of space for spoken English narration. Mood: ${json.mood}.`;
  return { caption, tokens, listeningPrompt };
}

async function callMuseVision(imageDataUrl: string) {
  const apiKey = process.env.MUSE_API_KEY || process.env.FIREWORKS_API_KEY || process.env.BASETEN_API_KEY; let apiUrl = process.env.MUSE_API_URL || process.env.FIREWORKS_API_URL || ""; const model = process.env.MUSE_MODEL || "muse-wonder-1.0"; if (!apiKey || !apiUrl) return null; if (!apiUrl.startsWith("http")) apiUrl = `https://${apiUrl}`; const isResponsesApi = apiUrl.includes("/responses");
  const res = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(isResponsesApi ? { model, input: [{ role: "user", content: [{ type: "input_text", text: VISION_PROMPT }, { type: "input_image", image_url: imageDataUrl }] }], stream: false } : { model, messages: [{ role: "user", content: [{ type: "text", text: VISION_PROMPT }, { type: "image_url", image_url: { url: imageDataUrl } }] }], temperature: 0.3, max_tokens: 700 }) }); if (!res.ok) throw new Error(`Muse API ${res.status}: ${(await res.text()).slice(0, 800)}`); const data = await res.json(); let text = data.output_text || data.choices?.[0]?.message?.content || data.choices?.[0]?.text || ""; if (!text && Array.isArray(data.output)) text = data.output.flatMap((x: any) => x.content || []).map((x: any) => x.text || x.output_text || "").join(""); const match = text.match(/\{[\s\S]*\}/); if (!match) throw new Error("Model did not return JSON"); const parsed = VisionJsonSchema.safeParse(JSON.parse(match[0])); if (!parsed.success) throw new Error("Model JSON failed validation"); return parsed.data;
}

export async function POST(req: NextRequest) { try { const parsed = RequestSchema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: "Input tidak valid", details: parsed.error.issues }, { status: 400 }); let json: z.infer<typeof VisionJsonSchema> | null = await callMuseVision(parsed.data.image); let source: "muse" | "mock" = "muse"; let note: string | null = null; if (!json) { json = MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)]; source = "mock"; note = "No Muse credentials configured — using mock."; } const { caption, tokens, listeningPrompt } = buildCaption(json); return NextResponse.json({ source, note, json, caption, tokens, listeningPrompt }); } catch (e) { return NextResponse.json({ error: "Gagal memanggil Muse", details: e instanceof Error ? e.message : String(e) }, { status: 502 }); } }
