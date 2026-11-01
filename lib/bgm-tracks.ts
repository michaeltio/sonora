// BGM catalog: 30s loops in public/bgm. Each track has a mood feature vector
// plus category / cultural affinity used for similarity matching.
// Vector dims: [calm, solemn, warm, tense, sacred, earthy, vibrant, contemporary]

export type BgmTrackId =
  | "warm-reflective"
  | "solemn-historical"
  | "warm-portrait"
  | "abstract-textural"
  | "spacious-sculpture"
  | "textile-pattern"
  | "javanese-bronze"
  | "sundanese-bamboo"
  | "eastern-wooden";

export interface BgmTrack {
  id: BgmTrackId;
  file: string;
  url: string;
  label: string;
  vector: number[];
  categories: Array<"painting" | "sculpture" | "textile">;
  cultures: string[];
  description: string;
}

export const BGM_DIMENSIONS = [
  "calm",
  "solemn",
  "warm",
  "tense",
  "sacred",
  "earthy",
  "vibrant",
  "contemporary",
] as const;

export const BGM_TRACKS: BgmTrack[] = [
  {
    id: "warm-reflective",
    file: "warm-reflective.wav",
    url: "/bgm/warm-reflective.wav",
    label: "Warm Reflective",
    vector: [0.8, 0.4, 0.9, 0.1, 0.3, 0.4, 0.2, 0.5],
    categories: ["painting", "sculpture", "textile"],
    cultures: ["general", "contemporary"],
    description: "Default hangat dan tenang untuk karya yang identitasnya tidak pasti.",
  },
  {
    id: "solemn-historical",
    file: "solemn-historical.wav",
    url: "/bgm/solemn-historical.wav",
    label: "Solemn Historical",
    vector: [0.5, 0.95, 0.5, 0.6, 0.4, 0.5, 0.2, 0.2],
    categories: ["painting", "sculpture"],
    cultures: ["java", "general"],
    description: "Khidmat dan tegang untuk lukisan sejarah, kolonial, dan memorial.",
  },
  {
    id: "warm-portrait",
    file: "warm-portrait.wav",
    url: "/bgm/warm-portrait.wav",
    label: "Warm Portrait",
    vector: [0.7, 0.3, 0.95, 0.15, 0.2, 0.3, 0.4, 0.4],
    categories: ["painting"],
    cultures: ["general"],
    description: "Intim dan personal untuk potret dan wajah manusia.",
  },
  {
    id: "abstract-textural",
    file: "abstract-textural.wav",
    url: "/bgm/abstract-textural.wav",
    label: "Abstract Textural",
    vector: [0.5, 0.3, 0.3, 0.4, 0.2, 0.2, 0.4, 0.95],
    categories: ["painting", "sculpture"],
    cultures: ["contemporary", "general"],
    description: "Tekstural dan modern untuk karya abstrak dan kontemporer.",
  },
  {
    id: "spacious-sculpture",
    file: "spacious-sculpture.wav",
    url: "/bgm/spacious-sculpture.wav",
    label: "Spacious Sculpture",
    vector: [0.7, 0.7, 0.4, 0.2, 0.6, 0.6, 0.2, 0.3],
    categories: ["sculpture"],
    cultures: ["java", "general"],
    description: "Luas dan monumental untuk arca batu, relief, dan patung.",
  },
  {
    id: "textile-pattern",
    file: "textile-pattern.wav",
    url: "/bgm/textile-pattern.wav",
    label: "Textile Pattern",
    vector: [0.6, 0.2, 0.7, 0.1, 0.2, 0.7, 0.5, 0.4],
    categories: ["textile"],
    cultures: ["general", "sumatra", "java"],
    description: "Berpola lembut untuk batik, tenun, songket, dan ulos.",
  },
  {
    id: "javanese-bronze",
    file: "javanese-bronze.wav",
    url: "/bgm/javanese-bronze.wav",
    label: "Javanese Bronze",
    vector: [0.6, 0.8, 0.6, 0.3, 0.8, 0.5, 0.4, 0.2],
    categories: ["painting", "sculpture"],
    cultures: ["java"],
    description: "Resonansi perunggu Jawa yang halus untuk konteks Jawa.",
  },
  {
    id: "sundanese-bamboo",
    file: "sundanese-bamboo.wav",
    url: "/bgm/sundanese-bamboo.wav",
    label: "Sundanese Bamboo",
    vector: [0.8, 0.3, 0.7, 0.1, 0.3, 0.6, 0.5, 0.3],
    categories: ["painting", "textile"],
    cultures: ["sunda"],
    description: "Bambu dan petikan lembut untuk suasana Sunda yang ringan.",
  },
  {
    id: "eastern-wooden",
    file: "eastern-wooden.wav",
    url: "/bgm/eastern-wooden.wav",
    label: "Eastern Wooden",
    vector: [0.5, 0.4, 0.5, 0.2, 0.4, 0.95, 0.4, 0.3],
    categories: ["sculpture", "textile"],
    cultures: ["eastern", "papua", "maluku", "nusa-tenggara"],
    description: "Kayu dan tanah untuk patung kayu dan kain timur Indonesia.",
  },
];
