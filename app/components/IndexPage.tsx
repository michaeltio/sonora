"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Play, Plus, ScanLine, Sparkles, Square, X } from "lucide-react";
import type { NarrationResult } from "@/lib/art.server";
import { makeThumbnail, prepareImage, saveHistoryEntry } from "@/lib/art-history";
import { saveUserExample } from "@/lib/user-examples";
import { useMixedPlayer } from "@/lib/use-mixed-player";

const isProduction = process.env.NODE_ENV === "production";
type Stage = "capture" | "ready" | "analyzing" | "done";

export default function IndexPage() {
  const mix = useMixedPlayer();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"mock" | "ai">("mock");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("capture");
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<NarrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedToExamples, setSavedToExamples] = useState(false);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setPickerOpen(false);
    setError(null);
    setResult(null);
    mix.stop();
    try {
      setImage(await prepareImage(file));
      setStage("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read image.");
    }
  }

  function reset() {
    mix.stop();
    setImage(null); setResult(null); setError(null); setStage("capture"); setSavedToExamples(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  async function handleGenerate() {
    if (!image) return;
    setStage("analyzing"); setError(null); mix.stop();
    try {
      let response: any;
      if (mode === "mock") {
        response = { ok: true, title: "Penangkapan Pangeran Diponegoro", kind: "Indonesian historical painting", origin: "Java 19th-c", narration: "Anda sedang melihat karya Raden Saleh berjudul Penangkapan Pangeran Diponegoro, sebuah lukisan penting dalam sejarah seni Indonesia. Di bagian tengah, Pangeran Diponegoro berdiri tegak dengan jubah putih, wajahnya menunjukkan keteguhan sekaligus kelelahan setelah menghadapi kekuasaan kolonial. Di sekelilingnya, para pejabat Belanda dan pengikutnya membentuk kerumunan yang terasa rapat dan menekan. Perhatikan sosok Jenderal De Kock yang duduk, berlawanan dengan posisi Diponegoro yang berdiri. Kontras ini menggambarkan perbedaan kuasa dan martabat. Warna biru gelap menciptakan suasana berat, sedangkan krem hangat memberi cahaya pada tokoh utama. Merah bata dan cokelat tanah menambah kesan tegang, historis, dan membumi. Raden Saleh tidak hanya melukiskan sebuah peristiwa, tetapi juga menyampaikan kritik tentang penangkapan, perlawanan, dan harga diri. Luangkan waktu untuk mengamati tatapan setiap tokoh, dan suasana politik yang membentuk Indonesia modern pada masa itu.", source: "mock" };
      } else {
        const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, mode: "ai" }) });
        response = await res.json().catch(() => ({ ok: false, error: "Respons AI tidak valid." }));
        if (!res.ok) response.ok = false;
      }
      if (!response.ok) { setError(response.error || "Generation failed"); setStage("ready"); return; }
      const r = response as NarrationResult;
      setResult(r); setStage("done");
      const thumbnail = await makeThumbnail(image).catch(() => "");
      saveHistoryEntry({ id: crypto.randomUUID(), title: r.title || "Unknown", kind: r.kind || "Artwork", origin: r.origin || "Unknown", narration: r.narration || "", thumbnail, createdAt: Date.now() });
      // Auto-pair BGM dari atribut suasana + siapkan TTS agar Play sekali klik langsung jalan.
      try {
        if (r.music?.url) mix.loadBgm(r.music.url);
        if (r.narration) await mix.generateTts(r.narration, "en");
      } catch { /* TTS/BGM opsional, Play tetap bisa dicoba manual */ }
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); setStage("ready"); }
  }

  async function handleAddToExamples() {
    if (!result) return;
    try {
      const thumbnail = image ? await makeThumbnail(image).catch(() => image || "") : "";
      saveUserExample({
        id: crypto.randomUUID(),
        title: result.title || "Unknown",
        kind: result.kind || "Artwork",
        origin: result.origin || "Unknown",
        narration: result.narration || "",
        thumbnail,
        audioDataUrl: mix.ttsUrl,
        musicLabel: result.music?.label,
        createdAt: Date.now(),
      });
      setSavedToExamples(true);
    } catch {
      setSavedToExamples(false);
    }
  }

  const canMix = !!mix.ttsUrl && !!mix.musicUrl;
  const isPlaying = mix.state === "playing";
  const isBusy = mix.state === "loading-tts" || mix.state === "loading-music" || mix.state === "exporting";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      {isProduction && <div className="mx-auto mb-5 w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">Production</div>}
      {stage !== "done" && <section className="text-center"><h1 className="font-display text-4xl font-semibold sm:text-5xl">Scan a work of art,<br /><span className="italic text-primary">hear its story.</span></h1><p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">Foto karya seni Indonesia → narasi + musik gamelan bercampur jadi satu audio.</p></section>}

      {stage === "capture" && <section className="mx-auto mt-10 max-w-5xl text-center">
        {!isProduction && <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-left shadow-sm"><p className="text-sm font-semibold">Developer generation mode</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode("mock")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === "mock" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>Mock — UI test</button><button type="button" onClick={() => setMode("ai")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === "ai" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>AI — Muse API</button></div><p className="mt-2 text-xs text-muted-foreground">Mock tidak memanggil API. Pilih AI untuk menguji Muse.</p></div>}
        <button type="button" onClick={() => setPickerOpen(true)} className="group mx-auto flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-[#B45309]/45 bg-[#EADCC8] px-6 py-14 text-center shadow-[0_8px_24px_rgba(93,46,31,0.08)] transition hover:border-[#B45309] hover:bg-[#E4D0B5] hover:shadow-lg"><span className="flex size-20 items-center justify-center rounded-2xl border-2 border-[#D4BFA6] bg-[#FFF8F0] text-[#B45309] shadow-[0_4px_12px_rgba(93,46,31,0.10)] transition group-hover:-translate-y-1 group-hover:border-[#B45309] group-hover:bg-[#EADCC8]"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg></span><span className="font-display text-3xl font-semibold">Upload an artwork</span><span className="text-sm text-muted-foreground">Choose camera or gallery from the next step</span></button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} /><input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </section>}

      {pickerOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target) setPickerOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby="picker-title" className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h2 id="picker-title" className="font-display text-2xl font-semibold">Choose a photo</h2><p className="mt-1 text-sm text-muted-foreground">How would you like to add your artwork?</p></div><button type="button" onClick={() => setPickerOpen(false)} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><X className="size-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => cameraRef.current?.click()} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary hover:bg-primary/5"><span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Camera className="size-5" /></span><span><strong className="block text-sm">Take a photo</strong><small className="text-xs text-muted-foreground">Open camera</small></span></button><button type="button" onClick={() => galleryRef.current?.click()} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary hover:bg-primary/5"><span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><ImagePlus className="size-5" /></span><span><strong className="block text-sm">Choose from gallery</strong><small className="text-xs text-muted-foreground">Select a photo</small></span></button></div></div></div>}

      {image && (stage === "ready" || stage === "analyzing") && <section className="mx-auto mt-10 max-w-5xl"><div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg"><div className="relative flex min-h-[220px] max-h-[620px] items-center justify-center overflow-hidden bg-[#EADCC8]"><img src={image} alt="Artwork" className="block max-h-[620px] w-full object-contain" /><button onClick={reset} aria-label="Choose another image" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-foreground/70 text-background"><X className="size-4" /></button></div><div className="p-5 sm:p-6">{stage === "ready" && <button onClick={handleGenerate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground"><Sparkles className="size-5" />Generate narration</button>}{stage === "analyzing" && <div className="flex flex-col items-center gap-3 py-4"><Loader2 className="size-7 animate-spin text-primary" /><p className="font-display text-xl italic">Reading the artwork…</p></div>}{error && <p className="mt-3 rounded-lg bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">{error}</p>}</div></div></section>}

      {stage === "done" && result && <section className="mx-auto mt-8 max-w-5xl space-y-5">
        <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
          <div className="relative flex min-h-[220px] max-h-[620px] items-center justify-center overflow-hidden bg-[#EADCC8]"><img src={image ?? undefined} alt={result.title} className="block max-h-[620px] w-full object-contain" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 to-transparent px-5 pb-4 pt-16"><p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/80">{result.kind} · {result.origin}</p><h1 className="font-display text-3xl font-semibold italic text-primary-foreground">{result.title}</h1></div><button onClick={reset} aria-label="Scan another artwork" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-foreground/70 text-background"><ScanLine className="size-4" /></button></div>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="rounded-2xl bg-secondary/60 p-5"><p className="whitespace-pre-line font-display text-lg leading-relaxed">{result.narration}</p></div>

            {/* === PLAY NARASI + BGM === */}
            <button
              onClick={() => isPlaying ? mix.stop() : mix.playMixed()}
              disabled={!canMix || isBusy}
              className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-4 font-semibold shadow-md transition disabled:opacity-50 ${isPlaying ? "bg-foreground text-background" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
            >
              {isBusy ? <><Loader2 className="size-5 animate-spin" />Preparing audio…</> : isPlaying ? <><Square className="size-5" />Stop</> : <><Play className="size-5" />Play narration</>}
            </button>
            {mix.error && <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">{mix.error}</p>}

            <button type="button" onClick={handleAddToExamples} disabled={savedToExamples} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-6 py-3.5 font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60"><Plus className="size-5" />{savedToExamples ? "Saved to Examples ✓" : "Add to Examples"}</button>
            <button type="button" onClick={reset} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-6 py-3.5 font-semibold text-primary transition hover:bg-primary/10"><ScanLine className="size-5" />Scan another artwork</button>
          </div>
        </article>
      </section>}
    </main>
  );
}
