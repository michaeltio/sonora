export interface ExampleEntry {
  id: string;
  title: string;
  kind: string;
  origin: string;
  narration: string;
  /** Static image served from /public, e.g. "/examples/diponegoro.jpg" */
  image: string;
  /** Pre-generated narration audio served from /public, e.g. "/examples/diponegoro.mp3" */
  audio: string;
  musicLabel?: string;
}

/**
 * Static showcase entries (bundled files, zero API requests).
 *
 * Currently EMPTY by design — examples are added by the user from
 * finished generations via the "Add to Examples" button (stored on-device).
 *
 * To ship a built-in example, drop the files into public/examples/ and
 * append an entry here:
 *   public/examples/<id>.jpg  (artwork image)
 *   public/examples/<id>.mp3  (ready narration audio)
 */
export const EXAMPLES: ExampleEntry[] = [];
