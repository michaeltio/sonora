"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RotateCcw, ScanLine, Sparkles, Square, Upload, Volume2, X } from "lucide-react";
import type { NarrationResult } from "@/lib/art.server";
import { makeThumbnail, prepareImage, saveHistoryEntry } from "@/lib/art-history";
import { useNarrationPlayer } from "@/lib/use-speech-player";

const isProduction = process.env.NODE_ENV === "production";

type Stage = "capture" | "ready" | "analyzing" | "done";

export default function IndexPage() {
  const player = useNarrationPlayer();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"mock" | "ai">("mock");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("capture");
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<NarrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setPickerOpen(false);
    setError(null);
    setResult(null);
    player.stop();
    try {
      setImage(await prepareImage(file));
      setStage("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read image.");
    }
  }

  function reset() {
    player.stop(); setImage(null); setResult(null); setError(null); setStage("capture");
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  async function handleGenerate() {
    if (!image) return;
    setStage("analyzing"); setError(null); player.stop();
    try {
      let response: any;
      if (mode === "mock") {
        response = { ok: true, title: "Penangkapan Pangeran Diponegoro", kind: "Indonesian historical painting", origin: "Java 19th-c", narration: "Anda sedang melihat karya Raden Saleh, Penangkapan Pangeran Diponegoro. Di tengah adegan, Diponegoro berdiri dengan jubah putih, sementara para pejabat kolonial mengelilinginya. Warna biru gelap, krem hangat, dan merah bata membangun suasana yang khidmat, tegang, dan penuh keberanian.", source: "mock" };
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
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); setStage("ready"); }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      {isProduction && <div className="mx-auto mb-5 w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">Production</div>}
      {stage !== "done" && <section className="text-center"><h1 className="font-display text-4xl font-semibold sm:text-5xl">Scan a work of art,<br /><span className="italic text-primary">hear its story.</span></h1><p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">Take a photo of an Indonesian artwork and hear its story like a museum audio guide.</p></section>}

      {stage === "capture" && <section className="mx-auto mt-10 max-w-xl text-center">
        {!isProduction && <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-left shadow-sm"><p className="text-sm font-semibold">Developer generation mode</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode("mock")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === "mock" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>Mock — UI test</button><button type="button" onClick={() => setMode("ai")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === "ai" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>AI — Muse API</button></div><p className="mt-2 text-xs text-muted-foreground">Mock tidak memanggil API. Pilih AI untuk menguji Muse.</p></div>}
        <button type="button" onClick={() => setPickerOpen(true)} className="group mx-auto flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-[#B45309]/45 bg-[#EADCC8] px-6 py-14 text-center shadow-[0_8px_24px_rgba(93,46,31,0.08)] transition hover:border-[#B45309] hover:bg-[#E4D0B5] hover:shadow-lg"><span className="flex size-20 items-center justify-center rounded-2xl border-2 border-[#D4BFA6] bg-[#FFF8F0] text-[#B45309] shadow-[0_4px_12px_rgba(93,46,31,0.10)] transition group-hover:-translate-y-1 group-hover:border-[#B45309] group-hover:bg-[#EADCC8]"><Upload className="size-10" strokeWidth={1.75} /></span><span className="font-display text-3xl font-semibold">Upload an artwork</span><span className="text-sm text-muted-foreground">Choose camera or gallery from the next step</span></button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} /><input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </section>}

      {pickerOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target) setPickerOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby="picker-title" className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h2 id="picker-title" className="font-display text-2xl font-semibold">Choose a photo</h2><p className="mt-1 text-sm text-muted-foreground">How would you like to add your artwork?</p></div><button type="button" onClick={() => setPickerOpen(false)} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><X className="size-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => cameraRef.current?.click()} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary hover:bg-primary/5"><span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Camera className="size-5" /></span><span><strong className="block text-sm">Take a photo</strong><small className="text-xs text-muted-foreground">Open camera</small></span></button><button type="button" onClick={() => galleryRef.current?.click()} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary hover:bg-primary/5"><span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><ImagePlus className="size-5" /></span><span><strong className="block text-sm">Choose from gallery</strong><small className="text-xs text-muted-foreground">Select a photo</small></span></button></div></div></div>}

      {image && (stage === "ready" || stage === "analyzing") && <section className="mx-auto mt-10 max-w-2xl"><div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg"><div className="relative"><img src={image} alt="Artwork" className="max-h-[420px] w-full object-cover" /><button onClick={reset} aria-label="Choose another image" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-foreground/70 text-background"><X className="size-4" /></button></div><div className="p-5 sm:p-6">{stage === "ready" && <button onClick={handleGenerate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground"><Sparkles className="size-5" />Generate narration</button>}{stage === "analyzing" && <div className="flex flex-col items-center gap-3 py-4"><Loader2 className="size-7 animate-spin text-primary" /><p className="font-display text-xl italic">Reading the artwork…</p></div>}{error && <p className="mt-3 rounded-lg bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">{error}</p>}</div></div></section>}

      {stage === "done" && result && <section className="mx-auto mt-8 max-w-2xl"><article className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg"><div className="relative"><img src={image ?? undefined} alt={result.title} className="max-h-[380px] w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 to-transparent px-5 pb-4 pt-16"><p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/80">{result.kind} · {result.origin}</p><h1 className="font-display text-3xl font-semibold italic text-primary-foreground">{result.title}</h1></div><button onClick={reset} aria-label="Scan another artwork" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-foreground/70 text-background"><ScanLine className="size-4" /></button></div><div className="space-y-4 p-5 sm:p-6"><div className="rounded-2xl bg-secondary/60 p-5"><p className="whitespace-pre-line font-display text-lg leading-relaxed">{result.narration}</p></div><button onClick={() => player.state === "idle" ? player.play(result.narration) : player.stop()} disabled={player.state === "loading"} className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground">{player.state === "loading" ? <><Loader2 className="size-5 animate-spin" />Preparing audio…</> : player.state === "playing" ? <><Square className="size-5" />Stop</> : <><Volume2 className="size-5" />Play the story</>}</button>{player.error && <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-center text-sm text-destructive">{player.error}</p>}<button type="button" onClick={reset} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-6 py-3.5 font-semibold text-primary transition hover:bg-primary/10"><ScanLine className="size-5" />Scan another artwork</button></div></article></section>}
    </main>
  );
}
