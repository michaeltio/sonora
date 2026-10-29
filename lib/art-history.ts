export type HistoryEntry = { id: string; title: string; kind: string; origin: string; narration: string; thumbnail: string; createdAt: number };
const KEY = "sonora_history";
export function loadHistory(): HistoryEntry[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function saveHistoryEntry(e: HistoryEntry) { if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify([e, ...loadHistory()].slice(0, 100))); }
export function deleteHistoryEntry(id: string) { const updated = loadHistory().filter((x) => x.id !== id); if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(updated)); return updated; }
export function clearHistory() { if (typeof window !== "undefined") localStorage.removeItem(KEY); return []; }
export function prepareImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca gambar."));
    reader.onload = () => {
      const source = new Image();
      source.onerror = () => reject(new Error("Format gambar tidak didukung."));
      source.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Browser tidak mendukung pemrosesan gambar."));
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      source.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
export function makeThumbnail(dataUrl: string): Promise<string> { return Promise.resolve(dataUrl); }
