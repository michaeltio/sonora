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
    description: "A warm, calm default for works whose identity is uncertain.",
  },
  {
    id: "solemn-historical",
    file: "solemn-historical.wav",
    url: "/bgm/solemn-historical.wav",
    label: "Solemn Historical",
    vector: [0.5, 0.95, 0.5, 0.6, 0.4, 0.5, 0.2, 0.2],
    categories: ["painting", "sculpture"],
    cultures: ["java", "general"],
    description: "Solemn and tense for historical, colonial, and memorial paintings.",
  },
  {
    id: "warm-portrait",
    file: "warm-portrait.wav",
    url: "/bgm/warm-portrait.wav",
    label: "Warm Portrait",
    vector: [0.7, 0.3, 0.95, 0.15, 0.2, 0.3, 0.4, 0.4],
    categories: ["painting"],
    cultures: ["general"],
    description: "Intimate and personal for portraits and human faces.",
  },
  {
    id: "abstract-textural",
    file: "abstract-textural.wav",
    url: "/bgm/abstract-textural.wav",
    label: "Abstract Textural",
    vector: [0.5, 0.3, 0.3, 0.4, 0.2, 0.2, 0.4, 0.95],
    categories: ["painting", "sculpture"],
    cultures: ["contemporary", "general"],
    description: "Textural and modern for abstract and contemporary works.",
  },
  {
    id: "spacious-sculpture",
    file: "spacious-sculpture.wav",
    url: "/bgm/spacious-sculpture.wav",
    label: "Spacious Sculpture",
    vector: [0.7, 0.7, 0.4, 0.2, 0.6, 0.6, 0.2, 0.3],
    categories: ["sculpture"],
    cultures: ["java", "general"],
    description: "Spacious and monumental for stone statues, reliefs, and sculptures.",
  },
  {
    id: "textile-pattern",
    file: "textile-pattern.wav",
    url: "/bgm/textile-pattern.wav",
    label: "Textile Pattern",
    vector: [0.6, 0.2, 0.7, 0.1, 0.2, 0.7, 0.5, 0.4],
    categories: ["textile"],
    cultures: ["general", "sumatra", "java"],
    description: "Softly patterned for batik, tenun, songket, and ulos.",
  },
  {
    id: "javanese-bronze",
    file: "javanese-bronze.wav",
    url: "/bgm/javanese-bronze.wav",
    label: "Javanese Bronze",
    vector: [0.6, 0.8, 0.6, 0.3, 0.8, 0.5, 0.4, 0.2],
    categories: ["painting", "sculpture"],
    cultures: ["java"],
    description: "Soft Javanese bronze resonance for Javanese contexts.",
  },
  {
    id: "sundanese-bamboo",
    file: "sundanese-bamboo.wav",
    url: "/bgm/sundanese-bamboo.wav",
    label: "Sundanese Bamboo",
    vector: [0.8, 0.3, 0.7, 0.1, 0.3, 0.6, 0.5, 0.3],
    categories: ["painting", "textile"],
    cultures: ["sunda"],
    description: "Bamboo and gentle plucks for a light Sundanese atmosphere.",
  },
  {
    id: "eastern-wooden",
    file: "eastern-wooden.wav",
    url: "/bgm/eastern-wooden.wav",
    label: "Eastern Wooden",
    vector: [0.5, 0.4, 0.5, 0.2, 0.4, 0.95, 0.4, 0.3],
    categories: ["sculpture", "textile"],
    cultures: ["eastern", "papua", "maluku", "nusa-tenggara"],
    description: "Wood and earth for wooden sculptures and eastern Indonesian textiles.",
  },
];
