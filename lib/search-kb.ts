// searchKB — retriever sederhana untuk knowledge base Sonora.
//
// BUKAN fitur LLM/Muse: fungsi TypeScript biasa yang berjalan di server.
// Input: vision JSON dari Muse. Output: entry KB + skor + verdict.
// Tidak ada API call, tidak ada biaya, selesai dalam milidetik.

import artworksDb from "@/data/artworks.json";

export interface KBVisualCues {
  objects: string[];
  colors: string[];
  composition: string;
}

export interface KBEntry {
  id: string;
  title: string;
  artist: string;
  year?: string;
  origin?: string;
  period?: string;
  category: "painting" | "sculpture" | "textile";
  summary: string;
  visual_cues: KBVisualCues;
  identity_evidence: string[];
  music_profile?: string;
  sources: string[];
}

export type KBVerdict = "identified" | "possible" | "unknown";

export interface KBMatch {
  entry: KBEntry | null;
  score: number;
  verdict: KBVerdict;
}

export interface VisionForSearch {
  objects?: string[];
  colors?: string[];
  mood?: string;
  composition?: string;
  symbolic_elements?: string[];
  title?: string;
  artist?: string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "and", "or", "with", "from",
  "yang", "dan", "dari", "di", "ke", "dengan", "untuk", "pada", "adalah",
]);

// Indonesian → English aliases: safety net so matching still works
// even if the vision model leaks Indonesian words despite the English-only prompt.
const ID_ALIASES: Record<string, string> = {
  lukisan: "painting", patung: "statue", arca: "statue", candi: "temple",
  perwira: "officer", prajurit: "soldier", tentara: "soldier",
  berlutut: "kneeling", duduk: "seated sitting", berdiri: "standing",
  jubah: "robe", kain: "cloth", pakaian: "clothing", topi: "hat",
  mahkota: "crown", pedang: "sword", tombak: "spear", perisai: "shield",
  bunga: "flower", pohon: "tree", gunung: "mountain", laut: "sea",
  langit: "sky", sungai: "river", rumah: "house", pintu: "door",
  jendela: "window", kereta: "carriage", kuda: "horse", perahu: "boat",
  wajah: "face", mata: "eye", tangan: "hand", kepala: "head",
  merah: "red", biru: "blue", putih: "white", hitam: "black",
  kuning: "yellow", hijau: "green", "coklat": "brown", cokelat: "brown",
  emas: "gold", terang: "bright", gelap: "dark",
  tua: "old", muda: "young", besar: "large", kecil: "small",
  tengah: "center middle", kiri: "left", kanan: "right",
  atas: "top", bawah: "bottom", depan: "front foreground",
  belakang: "behind background", dekat: "near", jauh: "far",
  sedih: "sad", senang: "happy", marah: "angry", takut: "afraid",
  khidmat: "solemn", tegang: "tense", tenang: "calm", meriah: "festive",
  laki: "man male", perempuan: "woman female", anak: "child", orang: "man person",
  tubuh: "body", rambut: "hair", janggut: "beard", kumis: "mustache",
  hidung: "nose", mulut: "mouth", telinga: "ear", leher: "neck",
  bahu: "shoulder", lengan: "arm", kaki: "leg foot", jari: "finger",
  darah: "blood", air: "water", api: "fire", asap: "smoke",
  batu: "stone", kayu: "wood", kertas: "paper",
  dinding: "wall", lantai: "floor", atap: "roof", tiang: "pillar column",
  tangga: "stairs steps", cermin: "mirror", meja: "table", kursi: "chair",
  pisau: "knife", senapan: "rifle gun", meriam: "cannon", bendera: "flag",
  drum: "drum", seruling: "flute", gong: "gong", gamelan: "gamelan",
  tari: "dance", nyanyi: "sing", upacara: "ceremony ritual", doa: "prayer",
  kuburan: "grave", mayat: "corpse", hantu: "ghost",
  raja: "king", ratu: "queen", pangeran: "prince", putri: "princess",
  panglima: "commander", jenderal: "general", presiden: "president",
  istana: "palace", desa: "village", kota: "city", jalan: "road street",
  jembatan: "bridge", pasar: "market", sawah: "rice field", hutan: "forest",
  pantai: "beach", ombak: "wave", kapal: "ship", awan: "cloud",
  hujan: "rain", matahari: "sun", bulan: "moon", bintang: "star",
  pagi: "morning", malam: "night", senja: "dusk",
  memegang: "holding", melihat: "looking seeing", berjalan: "walking",
  berlari: "running", menangis: "crying", tertawa: "laughing",
  berdoa: "praying", berperang: "fighting", menari: "dancing",
};

function stemEn(w: string): string {
  if (w.length <= 4) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (/(sses|shes|ches|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !/(ss|us|is|as|os)$/.test(w)) return w.slice(0, -1);
  return w;
}

// English synonym expansion so vision-model wording variants still match
// curated KB phrases (e.g. "mounted soldiers" vs "soldiers on horseback").
const EN_SYNONYMS: Record<string, string> = {
  mounted: "mounted horseback",
  ridden: "ridden horseback ride",
  seated: "seated sit",
  kneeling: "kneel kneeling",
  bowing: "bow",
  standing: "stand",
  facing: "face",
  turning: "turn",
  filling: "fill",
  wearing: "wear",
  holding: "hold",
  sitting: "sit",
  looming: "loom",
  gathering: "gather",
  draped: "drape",
  framed: "frame",
  weathered: "weather",
  swirling: "swirl",
  flowing: "flow",
  curling: "curl",
  elderly: "old elderly",
  older: "old older",
  veranda: "veranda porch",
  porch: "porch veranda",
  columned: "columned column pillar",
  column: "column pillar",
  distant: "distant far",
  plain: "plain simple",
  crowd: "crowd group people",
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .flatMap((w) => (ID_ALIASES[w] || w).split(" "))
    .flatMap((w) => (EN_SYNONYMS[w] || w).split(" "))
    .map(stemEn)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function phraseSim(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

function listScore(queryPhrases: string[], entryPhrases: string[]): number {
  if (queryPhrases.length === 0 || entryPhrases.length === 0) return 0;
  let total = 0;
  for (const q of queryPhrases) {
    let best = 0;
    for (const e of entryPhrases) best = Math.max(best, phraseSim(q, e));
    total += best;
  }
  return total / queryPhrases.length;
}

const HEX_NAMES: Record<string, string> = {
  "#B45309": "earthy orange", "#FEF3C7": "soft cream", "#1E3A3A": "deep blue-green",
  "#DC2626": "bright red", "#57534E": "stone gray", "#A8A29E": "warm gray",
  "#1C1917": "charcoal black", "#D6C7B8": "stone cream", "#2B3A5A": "deep blue",
  "#F2EBDC": "warm cream", "#8B3A3A": "brick red", "#6B5B42": "earth brown",
  "#D6BE9B": "beige", "#BE2A18": "brick red", "#EAC44D": "golden yellow",
  "#2E6B66": "deep green", "#6B4423": "earth brown",
};

function hexToName(hex: string): string {
  const upper = hex.toUpperCase();
  if (HEX_NAMES[upper]) return HEX_NAMES[upper];
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return hex;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (r > 180 && g < 110) return "warm red";
  if (r > 170 && g > 130 && b < 110) return "golden yellow";
  if (b > r && b > g) return "deep blue";
  if (g > r && g > b) return "leaf green";
  if (r > 190 && g > 170) return "ivory white";
  return "soft brown and gray";
}

function inferCategory(v: VisionForSearch): "painting" | "sculpture" | "textile" | "unknown" {
  const hay = [...(v.objects || []), ...(v.symbolic_elements || []), v.composition || "", v.title || ""]
    .join(" ")
    .toLowerCase();
  // Note: "temple"/"candi" alone is a place, not a medium — a painting OF a temple
  // is still a painting. Sculpture needs object words (statue, relief, carving...).
  const sculpture = /(statue|sculpt|arca|relief|carv|stone figure|patung|ukir|bronze|effigy)/.test(hay);
  const textile = /(textile|fabric|batik|songket|ulos|ikat|tenun|weav|cloth|kain|motif|pattern|thread)/.test(hay);
  if (textile && !sculpture) return "textile";
  if (sculpture) return "sculpture";
  if (hay.length > 0) return "painting";
  return "unknown";
}

export const KB_IDENTIFIED_THRESHOLD = 0.75;
export const KB_POSSIBLE_THRESHOLD = 0.45;

const ENTRIES = artworksDb.entries as KBEntry[];

export function searchKB(vision: VisionForSearch): KBMatch {
  const queryColors = (vision.colors || []).map((c) =>
    c.startsWith("#") ? hexToName(c) : c
  );
  const queryContext = [vision.mood || "", ...(vision.symbolic_elements || [])].join(" ");
  const category = inferCategory(vision);

  let best: KBEntry | null = null;
  let bestScore = 0;

  for (const entry of ENTRIES) {
    const obj = listScore(vision.objects || [], entry.visual_cues.objects);
    const col = listScore(queryColors, entry.visual_cues.colors);
    const comp = phraseSim(vision.composition || "", entry.visual_cues.composition);
    const ctx = phraseSim(
      queryContext,
      [entry.summary, entry.title, entry.artist].join(" ")
    );
    let score = 0.5 * obj + 0.2 * col + 0.15 * comp + 0.15 * ctx;
    if (category !== "unknown" && category === entry.category) score += 0.08;
    score = Math.min(1, score);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  bestScore = Math.round(bestScore * 1000) / 1000;
  if (!best || bestScore < KB_POSSIBLE_THRESHOLD) {
    return { entry: null, score: bestScore, verdict: "unknown" };
  }
  if (bestScore >= KB_IDENTIFIED_THRESHOLD) {
    return { entry: best, score: bestScore, verdict: "identified" };
  }
  return { entry: best, score: bestScore, verdict: "possible" };
}

export function kbEntries(): KBEntry[] {
  return ENTRIES;
}
