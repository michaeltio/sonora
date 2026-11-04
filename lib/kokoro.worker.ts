import { KokoroTTS } from "kokoro-js";
import {
  KOKORO_MODEL_ID,
  KOKORO_SAMPLE_RATE,
  KOKORO_VOICE,
  concatWithSilence,
  splitChunks,
} from "./kokoro-utils";

type Engine = {
  generate: (
    text: string,
    opts?: { voice?: string }
  ) => Promise<{ audio: Float32Array; sampling_rate: number }>;
};

type InMessage = { id: number; text: string };
type OutMessage =
  | { id: number; type: "progress"; message: string }
  | { id: number; type: "done"; samples: Float32Array; sampleRate: number }
  | { id: number; type: "error"; message: string };

let engine: Engine | null = null;
let loading: Promise<Engine> | null = null;

function post(message: OutMessage, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(message, transfer ?? []);
}

async function getEngine(id: number): Promise<Engine> {
  if (!engine) {
    if (!loading) {
      loading = (async () => {
        const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
          dtype: "q8",
          device: "wasm",
          progress_callback: (p: { status?: string; file?: string; progress?: number }) => {
            if (p?.status === "progress" && p?.file) {
              post({
                id,
                type: "progress",
                message: `Loading offline voice: ${p.file} ${Math.round(p.progress ?? 0)}%`,
              });
            } else if (p?.status === "initiate" && p?.file) {
              post({ id, type: "progress", message: `Loading offline voice: ${p.file}` });
            }
          },
        });
        return tts as unknown as Engine;
      })();
    }
    engine = await loading;
    loading = null;
  }
  return engine;
}

async function run(msg: InMessage) {
  const { id, text } = msg;
  try {
    const tts = await getEngine(id);
    const chunks = splitChunks(text);
    const parts: Float32Array[] = [];
    for (let i = 0; i < chunks.length; i++) {
      post({ id, type: "progress", message: `Voicing offline (${i + 1}/${chunks.length})…` });
      const out = await tts.generate(chunks[i], { voice: KOKORO_VOICE });
      if (!out?.audio?.length) throw new Error("empty offline audio");
      parts.push(out.audio);
    }
    const merged = concatWithSilence(parts, KOKORO_SAMPLE_RATE);
    post({ id, type: "done", samples: merged, sampleRate: KOKORO_SAMPLE_RATE }, [merged.buffer]);
  } catch (e) {
    post({ id, type: "error", message: e instanceof Error ? e.message : String(e) });
  }
}

self.onmessage = (e: MessageEvent<InMessage>) => {
  void run(e.data);
};
