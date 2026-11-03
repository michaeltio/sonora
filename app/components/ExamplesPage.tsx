"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, Loader2, Pause, Play, Presentation, X } from "lucide-react";
import { EXAMPLES } from "@/lib/examples";

type Card = {
  key: string;
  title: string;
  kind: string;
  origin: string;
  narration: string;
  image: string;
  audio: string | null;
  musicLabel?: string;
};

/** First few words of the narration for the card face. Full text lives in the drawer. */
function excerpt(text: string, words = 16): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= words) return text.trim();
  return parts.slice(0, words).join(" ") + "…";
}

export default function ExamplesPageClient() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [drawerCard, setDrawerCard] = useState<Card | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // "generated" = audio dibuat on-demand via /api/tts saat Play ditekan.
  // "browser" = server TTS mati, pakai suara on-device.
  const [audioNote, setAudioNote] = useState<Record<string, "generated" | "browser">>({});

  // ---- Presentation mode (PowerPoint-like fullscreen slideshow) ----
  const [presenting, setPresenting] = useState(false);
  const [slide, setSlide] = useState(0);
  const [autoNarrate, setAutoNarrate] = useState(true);
  const [presentPlaying, setPresentPlaying] = useState(false);
  const [showCaption, setShowCaption] = useState(true);
  const presentBoxRef = useRef<HTMLDivElement | null>(null);
  const presentAudioRef = useRef<HTMLAudioElement | null>(null);
  const touchXRef = useRef<number | null>(null);
  // Refs mirror state for the audio "ended" handler (cards is rebuilt every render).
  const cardsRef = useRef<Card[]>([]);
  const slideRef = useRef(0);
  const autoNarrateRef = useRef(true);

  // Static showcase only — bundled files in public/examples, same for every visitor.
  const cards: Card[] = EXAMPLES.map((e) => ({
      key: `static-${e.id}`,
      title: e.title,
      kind: e.kind,
      origin: e.origin,
      narration: e.narration,
      image: e.image,
      audio: e.audio as string | null,
      musicLabel: e.musicLabel,
    }));
  cardsRef.current = cards;
  slideRef.current = slide;
  autoNarrateRef.current = autoNarrate;
  const safeSlide = cards.length === 0 ? 0 : Math.min(slide, cards.length - 1);
  const slideCard = cards[safeSlide];

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onEnded = () => setPlayingId(null);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", onEnded);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // Lock body scroll + Escape to close while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  function openDrawer(card: Card) {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setDrawerCard(card);
    // Next frame so the slide-in transition actually animates.
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerOpen(true)));
  }

  function closeDrawer() {
    setDrawerOpen(false);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setDrawerCard(null), 320);
  }

  function stopAll() {
    audioRef.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlayingId(null);
    setLoadingId(null);
  }

  function speakWithBrowser(key: string, narration: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(narration);
    u.lang = "en-US";
    u.rate = 0.95;
    u.onend = () => setPlayingId(null);
    u.onerror = () => setPlayingId(null);
    setPlayingId(key);
    setLoadingId(null);
    window.speechSynthesis.speak(u);
  }

  async function playGenerated(card: Card) {
    // Audio tidak tersimpan (file terlalu besar untuk localStorage) —
    // buat saat diputar via /api/tts. Butuh server TTS menyala.
    setLoadingId(card.key);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: card.narration, language: "en" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.audio) throw new Error(data?.error || "TTS failed");
      const audio = audioRef.current;
      if (!audio) throw new Error("no audio element");
      audio.src = data.audio as string;
      await audio.play();
      setPlayingId(card.key);
      setLoadingId(null);
      setAudioNote((m) => ({ ...m, [card.key]: "generated" }));
    } catch {
      setAudioNote((m) => ({ ...m, [card.key]: "browser" }));
      speakWithBrowser(card.key, card.narration);
    }
  }

  async function handlePlay(card: Card) {
    if (playingId === card.key) {
      stopAll();
      return;
    }
    stopAll();
    // 1) Audio siap (file statis / klip kecil tersimpan) → langsung putar, tanpa request.
    const audio = audioRef.current;
    if (card.audio && audio) {
      setLoadingId(card.key);
      audio.src = card.audio;
      try {
        await audio.play();
        setPlayingId(card.key);
        setLoadingId(null);
        return;
      } catch {
        // file rusak/hilang → lanjut ke generate on-demand di bawah
      }
    }
    // 2) Tidak ada audio tersimpan → generate on-demand, fallback suara browser.
    await playGenerated(card);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onError = () => {
      if (loadingId) {
        const card = cards.find((c) => c.key === loadingId);
        if (card) playGenerated(card);
        else {
          setPlayingId(null);
          setLoadingId(null);
        }
      }
    };
    audio.addEventListener("error", onError);
    return () => audio.removeEventListener("error", onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingId]);

  // ---------- Presentation mode ----------
  function openPresent(index: number) {
    if (cards.length === 0) return;
    stopAll();
    closeDrawer();
    const clamped = Math.max(0, Math.min(index, cards.length - 1));
    setSlide(clamped);
    setPresenting(true);
  }

  function closePresent() {
    setPresenting(false);
    presentAudioRef.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPresentPlaying(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function goSlide(next: number) {
    const total = cardsRef.current.length;
    if (total === 0) return;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSlide(((next % total) + total) % total);
  }

  /** Browser-voice fallback inside presentation; advances when auto-narasi is on. */
  function presentSpeak(narration: string) {
    if (!("speechSynthesis" in window)) {
      setPresentPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(narration);
    u.lang = "en-US";
    u.rate = 0.95;
    u.onend = () => {
      if (autoNarrateRef.current && slideRef.current < cardsRef.current.length - 1) {
        setSlide(slideRef.current + 1);
      } else {
        setPresentPlaying(false);
      }
    };
    u.onerror = () => setPresentPlaying(false);
    setPresentPlaying(true);
    window.speechSynthesis.speak(u);
  }

  async function playPresentAudio(index: number) {
    const card = cardsRef.current[index];
    const audio = presentAudioRef.current;
    if (!card || !audio) return;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    audio.pause();
    if (card.audio) {
      try {
        audio.src = card.audio;
        await audio.play();
        return;
      } catch {
        // fall through to on-demand TTS below
      }
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: card.narration, language: "en" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.audio) throw new Error(data?.error || "TTS failed");
      audio.src = data.audio as string;
      await audio.play();
    } catch {
      presentSpeak(card.narration);
    }
  }

  function togglePresentAudio() {
    const audio = presentAudioRef.current;
    const card = cardsRef.current[slideRef.current];
    if (!audio || !card) return;
    if (!audio.paused) {
      audio.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setPresentPlaying(false);
      return;
    }
    if (audio.src && audio.currentSrc) {
      audio.play().catch(() => playPresentAudio(slideRef.current));
    } else {
      playPresentAudio(slideRef.current);
    }
  }

  // Setup/teardown presentation: body lock, keyboard, fullscreen, dedicated audio.
  useEffect(() => {
    if (!presenting) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const audio = new Audio();
    presentAudioRef.current = audio;
    const onPlay = () => setPresentPlaying(true);
    const onPause = () => setPresentPlaying(false);
    const onEnded = () => {
      setPresentPlaying(false);
      if (autoNarrateRef.current && slideRef.current < cardsRef.current.length - 1) {
        setSlide(slideRef.current + 1);
      }
    };
    const onError = () => {
      const card = cardsRef.current[slideRef.current];
      if (card && !card.audio) playPresentAudio(slideRef.current);
      else if (card) presentSpeak(card.narration);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePresent();
      else if (e.key === "ArrowRight") goSlide(slideRef.current + 1);
      else if (e.key === "ArrowLeft") goSlide(slideRef.current - 1);
      else if (e.key === " ") {
        e.preventDefault();
        togglePresentAudio();
      }
    };
    window.addEventListener("keydown", onKey);
    presentBoxRef.current?.requestFullscreen?.().catch(() => {});
    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      window.removeEventListener("keydown", onKey);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      document.body.style.overflow = prev;
      presentAudioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenting]);

  // Auto-narasi: play narration every time the slide changes (or toggled on).
  useEffect(() => {
    if (!presenting || !autoNarrate) return;
    if (slide >= cardsRef.current.length) return;
    playPresentAudio(slide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenting, slide, autoNarrate]);

  function renderPlayButton(card: Card, big = false) {
    const isPlaying = playingId === card.key;
    const isLoading = loadingId === card.key;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handlePlay(card);
        }}
        disabled={isLoading}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 ${big ? "py-4 text-base" : "py-3 text-sm"} font-bold shadow-sm transition disabled:opacity-60 ${isPlaying ? "bg-foreground text-background" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
      >
        {isLoading ? (
          <><Loader2 className="size-4 animate-spin" />Loading…</>
        ) : isPlaying ? (
          <><Pause className="size-4" />Stop</>
        ) : (
          <><Play className="size-4" />Play</>
        )}
      </button>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      <section className="text-center">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          Saved stories, <span className="italic text-primary">ready to replay.</span>
        </h1>
        {cards.length > 0 && (
          <button
            type="button"
            onClick={() => openPresent(0)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-bold text-background shadow-sm transition hover:opacity-90"
          >
            <Presentation className="size-4" />Present
          </button>
        )}
      </section>

      {cards.length === 0 ? (
        <section className="mx-auto mt-10 max-w-xl rounded-3xl border-2 border-dashed border-border px-6 py-14 text-center">
          <p className="font-display text-2xl italic text-muted-foreground">No examples yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            The static showcase is empty — add entries to the bundled examples to fill it.
          </p>
        </section>
      ) : (
        <section className="mt-10 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.key}
              role="button"
              tabIndex={0}
              aria-label={`View details of ${card.title}`}
              onClick={() => openDrawer(card)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDrawer(card);
                }
              }}
              className="flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {/* Fixed 4:3 stage — artwork keeps its own aspect ratio via object-contain. */}
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[#EADCC8]">
                {card.image ? (
                  <img src={card.image} alt={card.title} className="block h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="line-clamp-2 min-h-14 font-display text-xl font-semibold italic leading-snug">{card.title}</h2>
                <p className="line-clamp-3 text-sm italic leading-relaxed text-muted-foreground">{excerpt(card.narration)}</p>
                <div className="mt-auto pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDrawer(card);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                  >
                    <Eye className="size-4" />Details
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* ---- Right slide-in drawer ---- */}
      {drawerCard && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Details of ${drawerCard.title}`}>
          <div
            className={`absolute inset-0 bg-foreground/40 transition-opacity duration-300 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
            onClick={closeDrawer}
          />
          <aside className={`absolute inset-y-0 right-0 flex w-full max-w-4xl flex-col bg-card shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
            <button type="button" onClick={closeDrawer} aria-label="Close details" className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-foreground/70 text-background transition hover:bg-foreground">
              <X className="size-4" />
            </button>
            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[#EADCC8] sm:aspect-auto sm:min-h-full sm:w-[45%]">
                {drawerCard.image ? (
                  <img src={drawerCard.image} alt={drawerCard.title} className="absolute inset-0 block h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full min-h-48 items-center justify-center text-xs text-muted-foreground">No image</span>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
                  <h2 className="font-display text-3xl font-semibold italic leading-tight">{drawerCard.title}</h2>
                  <p className="whitespace-pre-line font-display text-base leading-relaxed">{drawerCard.narration}</p>
                </div>

                <div className="shrink-0 space-y-2 border-t border-border p-4">
                  {renderPlayButton(drawerCard, true)}
                  <button
                    type="button"
                    onClick={() => {
                      const idx = cards.findIndex((c) => c.key === drawerCard.key);
                      openPresent(idx >= 0 ? idx : 0);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold transition hover:border-primary hover:text-primary"
                  >
                    <Presentation className="size-4" />Present from here
                  </button>
                  {audioNote[drawerCard.key] === "generated" && <p className="text-center text-[11px] text-muted-foreground">Audio is generated on play (requires the TTS server).</p>}
                  {audioNote[drawerCard.key] === "browser" && <p className="text-center text-[11px] text-muted-foreground">TTS server is offline — playing with on-device voice.</p>}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ---- Presentation mode (PowerPoint-like) ---- */}
      {presenting && slideCard && (
        <div
          ref={presentBoxRef}
          className="fixed inset-0 z-[60] flex flex-col bg-[#1F140E] text-white"
          role="dialog"
          aria-modal="true"
          aria-label={`Presenting ${slideCard.title}`}
          onTouchStart={(e) => { touchXRef.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchXRef.current === null) return;
            const dx = e.changedTouches[0].clientX - touchXRef.current;
            touchXRef.current = null;
            if (dx < -60) goSlide(slideRef.current + 1);
            else if (dx > 60) goSlide(slideRef.current - 1);
          }}
        >
          {/* Top bar */}
          <div className="flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tabular-nums">
              {safeSlide + 1} / {cards.length}
            </span>
            <p className="min-w-0 flex-1 truncate font-display text-sm italic text-white/80 sm:text-base">
              {slideCard.title}
            </p>
            <button
              type="button"
              onClick={() => setAutoNarrate((v) => !v)}
              aria-pressed={autoNarrate}
              title="Putar narasi otomatis tiap slide"
              className={`hidden rounded-full px-3 py-1.5 text-xs font-bold transition sm:block ${autoNarrate ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
            >
              Auto-narasi {autoNarrate ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={() => setShowCaption((v) => !v)}
              aria-pressed={showCaption}
              title="Tampilkan/sembunyikan teks narasi"
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${showCaption ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
            >
              Teks {showCaption ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={closePresent}
              aria-label="Exit presentation"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Progress */}
          <div className="h-1 shrink-0 bg-white/10">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${((safeSlide + 1) / cards.length) * 100}%` }}
            />
          </div>

          {/* Slide body — full-bleed artwork, caption floats on top */}
          <div className="relative min-h-0 flex-1 bg-[#1F140E]">
            {slideCard.image ? (
              <img
                key={slideCard.key}
                src={slideCard.image}
                alt={slideCard.title}
                className="absolute inset-0 h-full w-full object-contain p-1 sm:p-3"
                draggable={false}
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-sm text-white/50">No image</span>
            )}
            {/* Prev / next zones (desktop) */}
            <button
              type="button"
              onClick={() => goSlide(safeSlide - 1)}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/25 sm:flex"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => goSlide(safeSlide + 1)}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/25 sm:flex"
            >
              <ChevronRight className="size-5" />
            </button>
            {showCaption ? (
              <div className="absolute inset-x-0 bottom-0 z-10 max-h-[46%] overflow-y-auto bg-gradient-to-t from-[#1F140E] via-[#1F140E]/85 to-transparent px-5 pb-4 pt-12 sm:px-10 sm:pb-5">
                <div className="mx-auto max-w-4xl">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                      {slideCard.kind} · {slideCard.origin}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCaption(false)}
                      aria-label="Hide caption"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/25"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-semibold italic leading-tight sm:text-4xl">
                    {slideCard.title}
                  </h2>
                  {slideCard.musicLabel && (
                    <p className="mt-1 text-xs italic text-white/50">BGM pairing: {slideCard.musicLabel}</p>
                  )}
                  <p className="mt-2 whitespace-pre-line font-display text-sm leading-relaxed text-white/85 sm:text-lg">
                    {slideCard.narration}
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCaption(true)}
                className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white/80 backdrop-blur transition hover:bg-white/25"
              >
                <ChevronUp className="size-4" />Tampilkan teks
              </button>
            )}
          </div>

          {/* Bottom controls */}
          <div className="flex shrink-0 items-center justify-center gap-3 px-4 py-4 sm:gap-4">
            <button
              type="button"
              onClick={() => goSlide(safeSlide - 1)}
              aria-label="Previous slide"
              className="flex size-12 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/25 active:scale-95"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={togglePresentAudio}
              aria-label={presentPlaying ? "Pause narration" : "Play narration"}
              className="flex size-14 items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:bg-white/85 active:scale-95"
            >
              {presentPlaying ? <Pause className="size-6" /> : <Play className="size-6" />}
            </button>
            <button
              type="button"
              onClick={() => goSlide(safeSlide + 1)}
              aria-label="Next slide"
              className="flex size-12 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/25 active:scale-95"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
          <div className="flex shrink-0 items-center justify-center gap-2 pb-4">
            {cards.map((c, i) => (
              <button
                key={c.key}
                type="button"
                onClick={() => goSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === safeSlide ? "w-8 bg-white" : "w-2 bg-white/30 hover:bg-white/60"}`}
              />
            ))}
          </div>
          <p className="hidden shrink-0 pb-3 text-center text-[11px] text-white/40 sm:block">
            ← → pindah slide · Spasi putar/jeda · ESC keluar
          </p>
        </div>
      )}
    </main>
  );
}
