// Pure functions (no browser APIs) so they can run in API routes and in the client.
// Pipeline: vision/narration text -> atmosphere attributes -> cosine similarity -> best BGM track.

import { BGM_DIMENSIONS, BGM_TRACKS, type BgmTrack } from "./bgm-tracks";

export interface AtmosphereAttributes {
  vector: number[];
  labels: Record<(typeof BGM_DIMENSIONS)[number], number>;
  category: "painting" | "sculpture" | "textile" | "unknown";
  cultureCues: string[];
  mood: string;
}

export interface BgmMatch {
  track: BgmTrack;
  score: number;
  reason: string;
  alternatives: Array<{ track: BgmTrack; score: number }>;
  atmosphere: AtmosphereAttributes;
}

const KEYWORDS: Array<{ dim: number; words: string[] }> = [
  { dim: 0, words: ["calm", "peaceful", "quiet", "serene", "meditat", "still", "tranquil", "hening", "tenang", "damai", "lembut"] },
  { dim: 1, words: ["solemn", "dignified", "sacred", "reverent", "monumental", "memorial", "khidmat", "sakral", "agung", "sejarah", "colonial", "war", "perang", "diponegoro", "arrest", "penangkapan"] },
  { dim: 2, words: ["warm", "intimate", "personal", "human", "tender", "hangat", "personal", "manusia", "wajah", "face", "portrait", "potret", "mata", "eye", "smile", "senyum"] },
  { dim: 3, words: ["tense", "tension", "dramatic", "conflict", "power", "tegang", "konflik", "kuasa", "menekan", "crowd", "soldier", "officer", "pejabat", "belanda", "dutch"] },
  { dim: 4, words: ["sacred", "ritual", "temple", "candi", "pura", "borobudur", "arca", "buddha", "goddess", "dewa", "sesajen", "offering", "upacara"] },
  { dim: 5, words: ["earth", "wood", "stone", "weav", "thread", "fabric", "kayu", "batu", "tanah", "tenun", "batik", "kain", "songket", "ulos", "ikat", "ukir", "carv", "relief", "motif", "pola"] },
  { dim: 6, words: ["vibrant", "lively", "colorful", "festive", "dance", "meriah", "ramai", "tari", "warna-warni", "celebrat"] },
  { dim: 7, words: ["abstract", "modern", "contemporary", "experimental", "abstrak", "modern", "kontemporer", "unknown", "tidak dikenal", "cannot be confirmed"] },
];

const CULTURE_KEYWORDS: Array<{ culture: string; words: string[] }> = [
  { culture: "java", words: ["java", "jawa", "borobudur", "prambanan", "yogyakarta", "solo", "keraton", "raden", "diponegoro", "de kock"] },
  { culture: "sunda", words: ["sunda", "bandung", "angklung", "kecapi", "jawabarat", "west java"] },
  { culture: "bali", words: ["bali", "legong", "barong", "pura", "denpasar", "ubud"] },
  { culture: "sumatra", words: ["sumatra", "sumatera", "ulos", "songket", "batak", "minang", "palembang", "gondang"] },
  { culture: "eastern", words: ["papua", "asmat", "maluku", "tifa", "nusa tenggara", "sumba", "ikat", "sasando", "timor"] },
];

function countHits(text: string, words: string[]): number {
  let hits = 0;
  for (const w of words) {
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const m = text.match(re);
    if (m) hits += Math.min(m.length, 4);
  }
  return hits;
}

export function extractAtmosphere(input: {
  title?: string;
  artist?: string;
  origin?: string;
  period?: string;
  mood?: string;
  composition?: string;
  objects?: string[];
  symbolic_elements?: string[];
  narration?: string;
  kind?: string;
}): AtmosphereAttributes {
  const hay = [input.title, input.artist, input.origin, input.period, input.mood, input.composition, input.narration, input.kind, ...(input.objects || []), ...(input.symbolic_elements || [])]
    .filter(Boolean)
    .join(" \n ");

  const vector = KEYWORDS.map(({ words }, i) => {
    const hits = countHits(hay, words);
    // Base level + keyword hits, clamped to [0,1]. Mood field gets double weight.
    const moodHits = countHits(input.mood || "", words) * 2;
    return Math.min(1, 0.22 + (hits + moodHits) * 0.18 + (i === 0 || i === 2 ? 0.08 : 0));
  });

  const cultureCues = CULTURE_KEYWORDS.filter((c) => countHits(hay, c.words) > 0).map((c) => c.culture);

  const lower = hay.toLowerCase();
  let category: AtmosphereAttributes["category"] = "unknown";
  const sculptureHit = /(statue|sculpt|arca|relief|carv|stone figure|patung|ukir|candi|temple)/.test(lower);
  const textileHit = /(textile|fabric|batik|songket|ulos|ikat|tenun|weav|cloth|kain|motif|pattern)/.test(lower);
  if (textileHit && !sculptureHit) category = "textile";
  else if (sculptureHit) category = "sculpture";
  else if (/(paint|portrait|lukis|canvas|affandi|raden saleh)/.test(lower)) category = "painting";
  else if (lower.length > 0) category = "painting";

  const labels = Object.fromEntries(BGM_DIMENSIONS.map((k, i) => [k, Math.round(vector[i] * 100) / 100])) as AtmosphereAttributes["labels"];

  return { vector, labels, category, cultureCues, mood: input.mood || "" };
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function matchBgm(atmosphere: AtmosphereAttributes): BgmMatch {
  const scored = BGM_TRACKS.map((track) => {
    let score = cosine(atmosphere.vector, track.vector);
    // Category affinity bonus.
    if (track.categories.includes(atmosphere.category as "painting")) score += 0.08;
    // Cultural cue bonus (strong signal when present).
    const overlap = track.cultures.filter((c) => atmosphere.cultureCues.includes(c)).length;
    if (overlap > 0) score += 0.1 + 0.04 * overlap;
    // Unknown identity falls back to neutral warm tracks.
    if (atmosphere.category === "unknown" && (track.id === "warm-reflective" || track.id === "abstract-textural")) score += 0.03;
    return { track, score: Math.round(score * 1000) / 1000 };
  }).sort((a, b) => b.score - a.score);

  const [best, ...rest] = scored;
  const topDims = BGM_DIMENSIONS.map((d, i) => ({ d, v: atmosphere.vector[i] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 3)
    .map((x) => x.d)
    .join(", ");
  const reason =
    `Suasana dominan: ${topDims}` +
    (atmosphere.cultureCues.length ? `; isyarat budaya: ${atmosphere.cultureCues.join(", ")}` : "") +
    (atmosphere.category !== "unknown" ? `; kategori: ${atmosphere.category}` : "");

  return {
    track: best.track,
    score: best.score,
    reason,
    alternatives: rest.slice(0, 2),
    atmosphere,
  };
}

export function selectBgmForArtwork(input: Parameters<typeof extractAtmosphere>[0]): BgmMatch {
  return matchBgm(extractAtmosphere(input));
}
