"use client";

// --- utils to decode data: URLs / blob URLs into AudioBuffers ---

export async function fetchAudioBuffer(url: string, ctx: AudioContext): Promise<AudioBuffer> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return await ctx.decodeAudioData(buf.slice(0));
}

export async function dataUrlToAudioBuffer(dataUrl: string, ctx: AudioContext): Promise<AudioBuffer> {
  // data:audio/wav;base64,...
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return await ctx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
}

function decodeAny(url: string, ctx: AudioContext): Promise<AudioBuffer> {
  if (url.startsWith("data:")) return dataUrlToAudioBuffer(url, ctx);
  return fetchAudioBuffer(url, ctx);
}

// --- procedural gamelan synth (no API needed) ---
// Returns an AudioBuffer of given duration seconds
export function synthesizeGamelan(ctx: AudioContext, durationSec: number, preset: string = "gamelan-calm"): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const len = Math.floor(sampleRate * durationSec);
  const buf = ctx.createBuffer(2, len, sampleRate);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  // slendro-ish pentatonic ratios (approx)
  const base = 110; // A2
  const ratiosByPreset: Record<string, number[]> = {
    "gamelan-calm": [1, 1.19, 1.35, 1.62, 1.9],
    "gamelan-meditative": [1, 1.22, 1.41, 1.71, 2.02],
    "ambient-warm": [1, 1.25, 1.5, 1.75, 2],
  };
  const ratios = ratiosByPreset[preset] ?? ratiosByPreset["gamelan-calm"];

  // helper: add sine
  function addTone(freq: number, start: number, dur: number, gain: number, pan: number = 0) {
    const s = Math.floor(start * sampleRate);
    const e = Math.min(len, Math.floor((start + dur) * sampleRate));
    const twoPiF = 2 * Math.PI * freq;
    for (let i = s; i < e; i++) {
      const t = (i - s) / sampleRate;
      const env = Math.exp(-t * 1.8) * Math.sin(Math.PI * Math.min(1, t / 0.02)) ;
      // slight bell inharmonicity
      const v = Math.sin(twoPiF * t) * 0.7 + Math.sin(twoPiF * 2.01 * t) * 0.2 + Math.sin(twoPiF * 3.98 * t) * 0.1;
      const g = gain * env * 0.35;
      L[i] += g * (1 - pan) * v;
      R[i] += g * (1 + pan) * v;
    }
  }

  // sparse gong every 8s
  for (let g = 0; g < durationSec; g += 8) {
    addTone(55, g + 0.05, 3.5, 0.9, 0);
    addTone(110, g + 0.05, 2.0, 0.25, 0);
  }

  // bonang-like pattern every 2s
  const pattern = [0, 2, 4, 2, 3, 1];
  for (let bar = 0; bar < durationSec; bar += 2) {
    for (let k = 0; k < pattern.length; k++) {
      const deg = pattern[k];
      const f = base * ratios[deg % ratios.length] * (k % 2 === 0 ? 1 : 2);
      const t = bar + k * 0.32;
      if (t >= durationSec - 0.3) break;
      const pan = ((k % 3) - 1) * 0.3;
      addTone(f, t, 1.2, 0.55, pan);
    }
  }

  // soft suling long tones
  for (let s = 1.5; s < durationSec; s += 6) {
    const f = base * 3 * ratios[Math.floor(Math.random() * ratios.length)];
    addTone(f, s, 3.0, 0.28, Math.random() * 0.4 - 0.2);
  }

  // gentle shimmer pad (low)
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const pad = Math.sin(2 * Math.PI * 55 * t) * 0.02 * Math.sin(2 * Math.PI * 0.15 * t + 1) +
                Math.sin(2 * Math.PI * 82.5 * t) * 0.015;
    L[i] += pad;
    R[i] += pad;
  }

  // soft limiter
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0.95 ? 0.95 / peak : 1;
  if (g < 1) for (let i = 0; i < len; i++) { L[i] *= g; R[i] *= g; }
  return buf;
}

// Convert AudioBuffer to WAV blob URL for download
export function bufferToWavUrl(buffer: AudioBuffer): string {
  const numCh = buffer.numberOfChannels;
  const len = buffer.length;
  const sr = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  let off = 0;
  function wStr(s: string) { for (let i = 0; i < s.length; i++) dv.setUint8(off++, s.charCodeAt(i)); }
  function w32(v: number) { dv.setUint32(off, v, true); off += 4; }
  function w16(v: number) { dv.setUint16(off, v, true); off += 2; }
  wStr("RIFF"); w32(36 + dataSize); wStr("WAVE"); wStr("fmt "); w32(16); w16(1); w16(numCh); w32(sr); w32(sr * blockAlign); w16(blockAlign); w16(16);
  wStr("data"); w32(dataSize);
  for (let i = 0; i < len; i++) for (let ch = 0; ch < numCh; ch++) {
    let s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
    dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
  }
  return URL.createObjectURL(new Blob([ab], { type: "audio/wav" }));
}

// Mix TTS buffer + loopable music buffer into one buffer.
// Timeline: 1.6s music intro, then narration starts with music ducked,
// music loops underneath, 1.5s fade-out after narration ends.
export function mixBuffers(ctx: AudioContext, tts: AudioBuffer, music: AudioBuffer, ttsGain = 1, musicGain = 0.12): AudioBuffer {
  const sr = ctx.sampleRate;
  const introSec = 1.6;
  const fadeSec = 1.5;
  const introLen = Math.floor(introSec * sr);
  const fadeLen = Math.floor(fadeSec * sr);
  const outLen = introLen + tts.length + fadeLen;
  const out = ctx.createBuffer(2, outLen, sr);
  const outL = out.getChannelData(0), outR = out.getChannelData(1);

  // copy TTS (mono or stereo), starting after the intro
  for (let ch = 0; ch < 2; ch++) {
    const src = tts.getChannelData(Math.min(ch, tts.numberOfChannels - 1));
    const dst = ch === 0 ? outL : outR;
    for (let i = 0; i < tts.length; i++) dst[introLen + i] += src[i] * ttsGain;
  }
  // loop music underneath with intro / duck / fade envelope
  for (let ch = 0; ch < 2; ch++) {
    const src = music.getChannelData(Math.min(ch, music.numberOfChannels - 1));
    const dst = ch === 0 ? outL : outR;
    for (let i = 0; i < outLen; i++) {
      let env: number;
      if (i < introLen) {
        // intro: ramp up to full bed volume
        env = 1.6 * (i / introLen);
      } else if (i < introLen + tts.length) {
        // ducked bed while narration speaks
        env = 0.65;
      } else {
        // fade-out tail
        const f = (i - introLen - tts.length) / fadeLen;
        env = 0.65 * (1 - f);
      }
      dst[i] += src[i % src.length] * musicGain * env;
    }
  }
  // limiter
  let peak = 0; for (let i = 0; i < outLen; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
  const g = peak > 0.98 ? 0.98 / peak : 1;
  if (g < 1) for (let i = 0; i < outLen; i++) { outL[i]*=g; outR[i]*=g; }
  return out;
}

export { decodeAny };
