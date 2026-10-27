"use client";

import { useState, useRef } from "react";

type VisionJson = {
  title: string;
  artist: string;
  origin: string;
  period: string;
  objects: string[];
  colors: string[];
  mood: string;
  composition: string;
  symbolic_elements: string[];
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 active:scale-95 transition dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [json, setJson] = useState<VisionJson | null>(null);
  const [caption, setCaption] = useState<string>("");
  const [tokens, setTokens] = useState<string[]>([]);
  const [listeningPrompt, setListeningPrompt] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<{ title: string; details?: string; hint?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [devTtsText, setDevTtsText] = useState<string>("Once upon a time in Bali, a Legong dancer moves gracefully inside a temple gate...");
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      setError({ title: "File terlalu besar", details: `${(f.size / 1024 / 1024).toFixed(1)}MB > 8MB` });
      return;
    }
    const url = URL.createObjectURL(f);
    setPreview(url);
    setFileObj(f);
    setJson(null);
    setCaption("");
    setTokens([]);
    setListeningPrompt("");
    setSource("");
    setNote("");
    setError(null);
    setAudio(null);
    setTtsError(null);
  };

  const generate = async () => {
    if (!fileObj) return;
    setBusy(true);
    setNote("");
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(fileObj);
      const res = await fetch("/api/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = Array.isArray(data.details) ? data.details.join("\n") : data.details || "";
        const hint = data.hint || "";
        throw { title: data.error || `Error ${res.status}`, details, hint };
      }
      setJson(data.json);
      setCaption(data.caption);
      setTokens(data.tokens);
      setListeningPrompt(data.listeningPrompt);
      setSource(data.source);
      setNote(data.note || "");
      // isi dev TTS text otomatis saat caption baru datang, tapi jangan timpa kalau user sudah edit manual
      if (data.caption) setDevTtsText(data.caption);
    } catch (e: any) {
      if (e?.title) setError(e);
      else if (e instanceof TypeError) setError({ title: "Gagal konek ke server", details: e.message, hint: "Pastikan dev server jalan di port 3000" });
      else setError({ title: e.message || "Gagal menghubungi Muse", details: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const generateAudio = async () => {
    const text = devTtsText.trim() || caption.trim();
    if (!text) {
      setTtsError("Isi teks dulu di textarea dev");
      return;
    }
    setTtsBusy(true);
    setTtsError(null);
    setAudio(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fallback) {
          // fallback: use browser Web Speech API so dev can still hear fairy-tale intonation without HF
          if ("speechSynthesis" in window) {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = "en-US";
            u.rate = 0.9;
            u.pitch = 1.1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
            setTtsError("HF diblock sandbox — pakai browser TTS fallback sementara. Suara akan terdengar langsung. Untuk XTTS asli host di Modal.");
            return;
          }
          throw new Error(data.hint || data.details);
        }
        throw new Error(data.details || data.error || `Error ${res.status}`);
      }
      setAudio(data.audio);
    } catch (e: any) {
      setTtsError(e.message || String(e));
    } finally {
      setTtsBusy(false);
    }
  };

  const clearDevTts = () => {
    setDevTtsText("");
    setAudio(null);
    setTtsError(null);
  };

  const jsonText = json ? JSON.stringify(json, null, 2) : "";
  const captionWithTokens = caption ? `${caption}\n\n${tokens.join(" ")}` : "";
  const allText = json
    ? `VISION JSON:\n${jsonText}\n\nCAPTION:\n${caption}\n\nTOKENS:\n${tokens.join(" ")}\n\nLISTENING PROMPT:\n${listeningPrompt}`
    : "";

  return (
    <div className="min-h-screen bg-[#FCFCF9] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-600 grid place-items-center text-white text-sm font-bold">S</div>
            <div>
              <p className="text-sm font-semibold leading-none">Sonora</p>
              <p className="text-xs text-zinc-500">Indonesian Art Soundscape — step 1 + 2</p>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {source === "muse" ? "LIVE • Muse" : source === "mock" ? "DEV • Mock" : "DEV"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error.title}</p>
            {error.details && <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-2 text-xs leading-5 text-red-700 dark:bg-zinc-900 dark:text-red-300">{error.details}</pre>}
            {error.hint && <p className="mt-2 text-xs leading-5 text-red-700 dark:text-red-300">{error.hint}</p>}
            <button type="button" onClick={() => setError(null)} className="mt-2 text-xs font-medium text-red-800 underline dark:text-red-200">Tutup</button>
          </div>
        )}
        {note && !error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            {note} <span className="font-mono">MUSE_API_URL</span> + <span className="font-mono">MUSE_API_KEY</span> di .env untuk koneksi Muse nyata.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">1. Upload artwork</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Pilih foto lukisan, patung, atau objek Indonesia. Akan dikirim ke Muse untuk deskripsi.</p>

            <input
              ref={fileRef}
              id="art-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                onFile(e.target.files?.[0] ?? null);
                // allow picking same file again
                e.currentTarget.value = "";
              }}
            />

            <div className="mt-4 overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950">
              {preview ? (
                <img src={preview} alt="preview" className="h-[280px] w-full object-cover" />
              ) : (
                <div className="grid place-items-center px-6 py-16 text-center">
                  <p className="text-sm text-zinc-500">Belum ada gambar</p>
                  <p className="text-xs text-zinc-400">PNG / JPG max 8MB</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label
                htmlFor="art-upload"
                className="grid cursor-pointer place-items-center rounded-full border border-zinc-900 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-white dark:bg-zinc-900 dark:text-white"
              >
                Pilih foto
              </label>
              <button
                type="button"
                onClick={generate}
                disabled={!fileObj || busy}
                className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-40 dark:bg-white dark:text-zinc-900"
              >
                {busy ? "Menghubungi Muse…" : "Generate"}
              </button>
            </div>

            <p className="mt-3 text-xs leading-4 text-zinc-500">
              Tombol Pilih foto pasti membuka dialog file. Tombol Generate baru aktif setelah foto dipilih dan akan POST ke <span className="font-mono">/api/describe</span>.
            </p>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">2. Vision JSON (dari Muse)</h3>
                <CopyButton text={jsonText} label="Copy JSON" />
              </div>
              {!json ? (
                <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-400 dark:bg-zinc-950">Upload dan Generate untuk lihat JSON Muse</p>
              ) : (
                <pre className="mt-3 max-h-[320px] overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-5 text-zinc-100">{jsonText}</pre>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">3. Caption dongeng Inggris + tokens</h3>
                <CopyButton text={captionWithTokens} label="Copy caption" />
              </div>
              {!caption ? (
                <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-400 dark:bg-zinc-950">Caption akan muncul di sini</p>
              ) : (
                <>
                  <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 dark:bg-amber-950/30">{caption}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tokens.map((t) => (
                      <code key={t} className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-white dark:bg-white dark:text-zinc-900">
                        {t}
                      </code>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">4. Listening prompt → music</h3>
                <CopyButton text={listeningPrompt} label="Copy prompt" />
              </div>
              {!listeningPrompt ? (
                <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-400 dark:bg-zinc-950">Prompt akan muncul di sini</p>
              ) : (
                <p className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-950">{listeningPrompt}</p>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">5. TTS — coqui/XTTS-v2 via Hugging Face</h3>
                <div className="flex gap-2">
                  <CopyButton text={audio || ""} label="Copy audio URL" />
                  <CopyButton text={devTtsText} label="Copy text" />
                </div>
              </div>
              <p className="mt-2 text-xs leading-4 text-zinc-500">Dev mode: test TTS tanpa upload foto. Edit teks di bawah lalu Generate. Tidak pakai token Muse.</p>
              <textarea
                value={devTtsText}
                onChange={(e) => setDevTtsText(e.target.value)}
                placeholder="Tulis teks Inggris untuk test TTS dongeng..."
                rows={4}
                className="mt-3 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={generateAudio}
                  disabled={ttsBusy || !devTtsText.trim()}
                  className="rounded-full bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-40"
                >
                  {ttsBusy ? "Generating audio…" : "Generate audio"}
                </button>
                <button type="button" onClick={clearDevTts} className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  Clear
                </button>
              </div>
              {ttsError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700 dark:bg-red-950/30 dark:text-red-300">{ttsError}</p>}
              {audio && (
                <div className="mt-3">
                  <audio controls src={audio} className="w-full" />
                  <p className="mt-2 text-xs text-zinc-500">Audio dari HF_TOKEN / Modal. Untuk fairy-tale pro, tambah speaker_wav di /api/tts.</p>
                </div>
              )}
              {!devTtsText.trim() && !ttsError && !audio && <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-3 text-center text-xs text-zinc-400 dark:bg-zinc-950">Isi teks dulu, lalu Generate audio. Tidak perlu upload foto.</p>}
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200">Copy semua untuk testing TTS</p>
                <CopyButton text={allText} label="Copy all" />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
