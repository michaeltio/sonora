export interface UserExample {
  id: string;
  title: string;
  kind: string;
  origin: string;
  narration: string;
  thumbnail: string;
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

export function saveUserExample(entry: UserExample): UserExample[] {
  if (typeof window === "undefined") return [];
  let entries = [entry, ...loadUserExamples()].slice(0, 20);
  try {
    persist(entries);
  } catch {
    entries = entries.slice(0, 5);
    try {
      persist(entries);
    } catch {
      entries = entries.map((en, i) => (i === 0 ? en : { ...en, audioDataUrl: null }));
      try {
        persist(entries);
      } catch {
        entries = [{ ...entry, audioDataUrl: null }];
        try {
          persist(entries);
        } catch {
        }
      }
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
  }
  return entries;
}
