"use client";

import { useEffect, useRef, useState } from "react";

export type PlayerState = "idle" | "loading" | "playing";
export interface NarrationPlayer { state: PlayerState; error: string | null; play: (text: string) => Promise<void>; stop: () => void; }

/** Local mock player for UI testing. It uses the browser speech engine and never calls /api/tts. */
export function useNarrationPlayer(): NarrationPlayer {
  const [state, setState] = useState<PlayerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  async function play(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("Browser audio tidak tersedia.");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      setState("loading");
      setError(null);
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 0.88;
      utterance.pitch = 1;
      utterance.onstart = () => setState("playing");
      utterance.onend = () => { setState("idle"); utteranceRef.current = null; };
      utterance.onerror = () => { setState("idle"); setError("Audio gagal diputar."); };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Playback failed");
    }
  }

  function stop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setState("idle");
    setError(null);
  }

  useEffect(() => () => stop(), []);
  return { state, error, play, stop };
}
