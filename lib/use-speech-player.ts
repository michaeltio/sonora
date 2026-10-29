"use client";
import { useEffect, useRef, useState } from "react";
export type PlayerState = "idle" | "loading" | "playing";
export interface NarrationPlayer { state: PlayerState; error: string | null; play: (text: string) => Promise<void>; stop: () => void; }
export function useNarrationPlayer(): NarrationPlayer {
  const [state, setState] = useState<PlayerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { if(typeof window!=="undefined" && !audioRef.current){audioRef.current=new Audio();audioRef.current.onended=()=>{setState("idle");setError(null)};audioRef.current.onerror=()=>{setState("idle");setError("Failed to play audio.")}} }, []);
  async function play(text: string) {
    try { setState("loading"); setError(null); const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ text, language: "en" }) }); if(!res.ok){const b=await res.json().catch(()=>null);throw new Error(b?.error||"TTS request failed.")} const data=await res.json(); const url=data.audio; if(!url)throw new Error("No audio returned."); const audio=audioRef.current||new Audio(); audio.src=url; await audio.play(); setState("playing"); } catch(err) { setState("idle"); setError(err instanceof Error ? err.message : "Playback failed") }
  }
  function stop() { if(audioRef.current){audioRef.current.pause();audioRef.current.src="";audioRef.current.load()} setState("idle"); setError(null); }
  useEffect(()=>{return()=>stop()},[]);
  return { state, error, play, stop };
}
