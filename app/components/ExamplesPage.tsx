"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Loader2, Pause, Play, Trash2, X } from "lucide-react";
import { EXAMPLES } from "@/lib/examples";
import { deleteUserExample, loadUserExamples, type UserExample } from "@/lib/user-examples";
import { isProduction } from "@/lib/app-env";

type Card = {
  key: string;
  userId?: string;
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
  const [userExamples, setUserExamples] = useState<UserExample[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [drawerCard, setDrawerCard] = useState<Card | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // "generated" = audio dibuat on-demand via /api/tts saat Play ditekan.
  // "browser" = server TTS mati, pakai suara on-device.
  const [audioNote, setAudioNote] = useState<Record<string, "generated" | "browser">>({});

  const cards: Card[] = [
    ...userExamples.map((e) => ({
      key: `user-${e.id}`,
      userId: e.id,
      title: e.title,
      kind: e.kind,
      origin: e.origin,
      narration: e.narration,
      image: e.thumbnail,
      audio: e.audioDataUrl,
      musicLabel: e.musicLabel,
    })),
    ...EXAMPLES.map((e) => ({
      key: `static-${e.id}`,
      title: e.title,
      kind: e.kind,
      origin: e.origin,
      narration: e.narration,
      image: e.image,
      audio: e.audio as string | null,
      musicLabel: e.musicLabel,
    })),
  ];

  useEffect(() => {
    setUserExamples(loadUserExamples());
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

  function handleDelete(userId: string) {
    if (playingId === `user-${userId}`) stopAll();
    if (drawerCard?.userId === userId) closeDrawer();
    setUserExamples(deleteUserExample(userId));
  }

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
      </section>

      {cards.length === 0 ? (
        <section className="mx-auto mt-10 max-w-xl rounded-3xl border-2 border-dashed border-border px-6 py-14 text-center">
          <p className="font-display text-2xl italic text-muted-foreground">No examples yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Generate a narration on the Scan page, then press “Add to Examples” to save it here.
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
                {!isProduction && card.userId && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(card.userId!); }} aria-label={`Remove ${card.title}`} className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-foreground/70 text-background transition hover:bg-foreground">
                    <Trash2 className="size-4" />
                  </button>
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
                  {audioNote[drawerCard.key] === "generated" && <p className="text-center text-[11px] text-muted-foreground">Audio is generated on play (requires the TTS server).</p>}
                  {audioNote[drawerCard.key] === "browser" && <p className="text-center text-[11px] text-muted-foreground">TTS server is offline — playing with on-device voice.</p>}
                  {!isProduction && drawerCard.userId && (
                    <button type="button" onClick={() => handleDelete(drawerCard.userId!)} className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:border-destructive hover:text-destructive">
                      <Trash2 className="size-4" />Remove this example
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
