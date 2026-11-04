export const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const KOKORO_VOICE = "af_heart";
export const KOKORO_SAMPLE_RATE = 24000;

export function splitChunks(text: string, maxChars = 350): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["”)]?\s*|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    const piece = s.trim();
    if (!piece) continue;
    if ((current + " " + piece).trim().length > maxChars && current) {
      chunks.push(current.trim());
      current = piece;
    } else {
      current = (current + " " + piece).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

export function concatWithSilence(parts: Float32Array[], sampleRate: number): Float32Array {
  const pauseLen = Math.floor(sampleRate * 0.25);
  const total = parts.reduce((n, p) => n + p.length, 0) + pauseLen * Math.max(0, parts.length - 1);
  const out = new Float32Array(total);
  let offset = 0;
  parts.forEach((p, i) => {
    out.set(p, offset);
    offset += p.length;
    if (i < parts.length - 1) offset += pauseLen;
  });
  return out;
}

export function float32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
