"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Image as ImageIcon, Loader2, Music2, Pause, Play, Trash2 } from "lucide-react";
import { EXAMPLES, type ExampleEntry } from "@/lib/examples";
import { deleteUserExample, loadUserExamples, type UserExample } from "@/lib/user-examples";

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

function downloadText(title: string, kind: string, origin: string, narration: string, id: string) {
  const blob = new Blob([`${title}\n${kind} · ${origin}\n\n${narration}\n`], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${id}-narration.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExamplesPageClient() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userExamples, setUserExamples] = useState<UserExample[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voiceFallback, setVoiceFallback] = useState<Record<string, boolean>>({});

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

  async function handlePlay(card: Card) {
    if (playingId === card.key) {
      stopAll();
      return;
    }
    stopAll();
    if (!card.audio) {
      setVoiceFallback((m) => ({ ...m, [card.key]: true }));
      speakWithBrowser(card.key, card.narration);
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      speakWithBrowser(card.key, card.narration);
      return;
    }
    setLoadingId(card.key);
    audio.src = card.audio;
    try {
      await audio.play();
      setPlayingId(card.key);
      setLoadingId(null);
    } catch {
      setVoiceFallback((m) => ({ ...m, [card.key]: true }));
      speakWithBrowser(card.key, card.narration);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onError = () => {
      if (loadingId) {
        const card = cards.find((c) => c.key === loadingId);
        setVoiceFallback((m) => ({ ...m, [loadingId]: true }));
        if (card) speakWithBrowser(card.key, card.narration);
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
    setUserExamples(deleteUserExample(userId));
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      <section className="text-center">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          Examples, <span className="italic text-primary">ready to play.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Finished generations you saved. Press play — no upload, no AI request needed.
        </p>
      </section>

      {cards.length === 0 ? (
        <section className="mx-auto mt-10 max-w-xl rounded-3xl border-2 border-dashed border-border px-6 py-14 text-center">
          <p className="font-display text-2xl italic text-muted-foreground">No examples yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Generate a narration on the Scan page, then press “Add to Examples” to save it here.
          </p>
        </section>
      ) : (
        <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const isPlaying = playingId === card.key;
            const isLoading = loadingId === card.key;
            const isExpanded = expandedId === card.key;
            return (
              <article key={card.key} className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:shadow-md">
                <div className="relative flex min-h-[200px] items-center justify-center overflow-hidden bg-[#EADCC8]">
                  {card.image ? (
                    <img src={card.image} alt={card.title} className="block max-h-[260px] w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <span className="text-xs text-muted-foreground">No image</span>
                  )}
                  {card.userId && (
                    <button type="button" onClick={() => handleDelete(card.userId!)} aria-label={`Remove ${card.title}`} className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-foreground/70 text-background transition hover:bg-foreground">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{card.kind} · {card.origin}</p>
                    <h2 className="mt-1 font-display text-2xl font-semibold italic leading-tight">{card.title}</h2>
                    {card.musicLabel && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Music2 className="size-3.5" />{card.musicLabel}</p>}
                  </div>
                  <p className={isExpanded ? "whitespace-pre-line text-sm leading-relaxed" : "line-clamp-3 whitespace-pre-line text-sm italic leading-relaxed text-muted-foreground"}>
                    {card.narration}
                  </p>
                  <button type="button" onClick={() => setExpandedId(isExpanded ? null : card.key)} className="self-start text-xs font-semibold text-primary hover:underline">
                    {isExpanded ? "Show less" : "Read full narration"}
                  </button>
                  <div className="mt-auto space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handlePlay(card)}
                      disabled={isLoading}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition disabled:opacity-60 ${isPlaying ? "bg-foreground text-background" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                    >
                      {isLoading ? <><Loader2 className="size-4 animate-spin" />Loading…</> : isPlaying ? <><Pause className="size-4" />Stop</> : <><Play className="size-4" />Play</>}
                    </button>
                    {voiceFallback[card.key] && <p className="text-center text-[11px] text-muted-foreground">Ready audio not saved — playing with on-device voice.</p>}
                    <div className="grid grid-cols-3 gap-2">
                      {card.image && !card.image.startsWith("data:") ? (
                        <a href={card.image} download className="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition hover:border-primary" title="Download image">
                          <ImageIcon className="size-3.5" />Image
                        </a>
                      ) : (
                        <a href={card.image} download={`${card.title}.jpg`} className="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition hover:border-primary" title="Download image">
                          <ImageIcon className="size-3.5" />Image
                        </a>
                      )}
                      <button type="button" onClick={() => downloadText(card.title, card.kind, card.origin, card.narration, card.key)} className="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition hover:border-primary" title="Download narration text">
                        <FileText className="size-3.5" />Text
                      </button>
                      {card.audio ? (
                        <a href={card.audio} download={`${card.title}.mp3`} className="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition hover:border-primary" title="Download narration audio">
                          <Download className="size-3.5" />Audio
                        </a>
                      ) : (
                        <span className="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold opacity-40" title="No ready audio saved">
                          <Download className="size-3.5" />Audio
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
