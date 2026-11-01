export interface UserExample {
  id: string;
  title: string;
  kind: string;
  origin: string;
  narration: string;
  /** Small cover image (thumbnail data URL or /public path). */
  thumbnail: string;
  /** Ready narration audio as data URL (TTS result). Null = play with on-device voice. */
  audioDataUrl: string | null;
  musicLabel?: string;
  createdAt: number;
}

const KEY = "sonora_examples";

export function loadUserExamples(): UserExample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(entries: UserExample[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

/** Save a user example. On quota errors, drop oldest entries and retry once. */
export function saveUserExample(entry: UserExample): UserExample[] {
  if (typeof window === "undefined") return [];
  let entries = [entry, ...loadUserExamples()].slice(0, 20);
  try {
    persist(entries);
  } catch {
    // localStorage full (audio data URLs are big) → keep only the 5 newest and retry once.
    entries = entries.slice(0, 5);
    try {
      persist(entries);
    } catch {
      // storage unavailable/blocked — return in-memory list only
    }
  }
  return entries;
}

export function deleteUserExample(id: string): UserExample[] {
  if (typeof window === "undefined") return [];
  const entries = loadUserExamples().filter((e) => e.id !== id);
  try {
    persist(entries);
  } catch {
    // ignore
  }
  return entries;
}
