export type HistoryEntry = { id: string; title: string; kind: string; origin: string; narration: string; thumbnail: string; createdAt: number };
const KEY = "sonora_history";
export function loadHistory(): HistoryEntry[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function saveHistoryEntry(e: HistoryEntry) {
  if (typeof window === "undefined") return;
  const entries = [e, ...loadHistory()].slice(0, 30);
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Kuota penuh: buang thumbnail entri lama (thumbnail = bagian terbesar),
    // coba lagi; kalau masih gagal, simpan 10 terbaru tanpa thumbnail.
    try {
      const slim = entries.map((en, i) => (i < 10 ? en : { ...en, thumbnail: "" }));
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      try {
        localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 10).map((en) => ({ ...en, thumbnail: "" }))));
      } catch {
        // storage tidak tersedia — abaikan, jangan crash UI
      }
    }
  }
}
export function deleteHistoryEntry(id: string) { const updated = loadHistory().filter((x) => x.id !== id); if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(updated)); return updated; }
export function clearHistory() { if (typeof window !== "undefined") localStorage.removeItem(KEY); return []; }
export function prepareImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const source = new Image();
      source.onerror = () => reject(new Error("Unsupported image format."));
      source.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("This browser does not support image processing."));
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      source.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
export function makeThumbnail(dataUrl: string): Promise<string> {
  // Thumbnail kecil (maks 160px, JPEG 0.7) agar localStorage tidak penuh.
  // Jangan pernah menyimpan gambar full-size ke history.
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve("");
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 160;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve("");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}
