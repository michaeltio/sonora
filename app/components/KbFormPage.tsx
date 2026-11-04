"use client";

import { useMemo, useState } from "react";
import { FlaskConical, Loader2, Plus, Save } from "lucide-react";

const MUSIC_OPTIONS = [
  { id: "warm-reflective", label: "Warm Reflective — warm neutral (safe default)" },
  { id: "solemn-historical", label: "Solemn Historical — history / solemn / tense" },
  { id: "warm-portrait", label: "Warm Portrait — intimate portrait" },
  { id: "abstract-textural", label: "Abstract Textural — abstract / contemporary" },
  { id: "spacious-sculpture", label: "Spacious Sculpture — statues / stone reliefs" },
  { id: "textile-pattern", label: "Textile Pattern — batik / tenun / songket / ulos" },
  { id: "javanese-bronze", label: "Javanese Bronze — Javanese feel" },
  { id: "sundanese-bamboo", label: "Sundanese Bamboo — Sundanese feel" },
  { id: "eastern-wooden", label: "Eastern Wooden — wooden statues / eastern Indonesia" },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function lines(v: string) {
  return v.split("\n").map((s) => s.trim()).filter(Boolean);
}

const inputCls = "w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal";
const labelCls = "space-y-1 text-left text-sm font-semibold";
const helpCls = "text-xs font-normal text-muted-foreground";

export default function KbFormPage() {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [origin, setOrigin] = useState("");
  const [period, setPeriod] = useState("");
  const [category, setCategory] = useState("painting");
  const [summary, setSummary] = useState("");
  const [evidence, setEvidence] = useState("");
  const [sources, setSources] = useState("");
  const [objects, setObjects] = useState("");
  const [colors, setColors] = useState("");
  const [composition, setComposition] = useState("");
  const [mood, setMood] = useState("");
  const [symbolic, setSymbolic] = useState("");
  const [music, setMusic] = useState("warm-reflective");

  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entry = useMemo(() => ({
    id: id || slugify(`${artist}-${title}`) || "new-entry",
    title: title || "Unknown",
    artist: artist || "Unknown",
    year: year || "unknown",
    origin: origin || "Indonesia",
    period: period || "unknown",
    category,
    summary: summary || "(write a 2-3 sentence factual summary)",
    visual_cues: {
      objects: lines(objects),
      colors: lines(colors),
      composition: composition || "(describe positions: left/right/center/background)",
    },
    identity_evidence: lines(evidence),
    music_profile: music,
    sources: lines(sources),
  }), [id, title, artist, year, origin, period, category, summary, evidence, sources, objects, colors, composition, music]);

  async function handleTest() {
    setBusy("test"); setError(null); setTestResult(null);
    try {
      const res = await fetch("/api/kb/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objects: lines(objects), colors: lines(colors), mood,
          composition, symbolic_elements: lines(symbolic), title, artist,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Test ${res.status}`);
      setTestResult(`Result: ${data.verdict} ${Math.round(data.score * 100)}% → ${data.matchTitle || "(no match)"} | suggested music: ${data.suggestedMusicLabel}`);
      if (data.suggestedMusic) setMusic(data.suggestedMusic);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    setBusy("save"); setError(null); setSaveResult(null);
    try {
      const res = await fetch("/api/kb/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const det = Array.isArray(data?.details) ? data.details.map((d: any) => `${(d.path || []).join(".")}: ${d.message}`).join("; ") : "";
        throw new Error((data?.error || `Save ${res.status}`) + (det ? ` — ${det}` : ""));
      }
      setSaveResult(`Saved: ${data.id} (total ${data.totalEntries}). Self-test: ${data.selfTest.verdict} ${Math.round(data.selfTest.score * 100)}% → ${data.selfTest.matchedId}. ${data.note || ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-6">
        <div className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-2xl font-semibold">A. Artwork identity <span className="text-sm font-normal text-muted-foreground">(facts — must be correct)</span></h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>ID (slug, unique)<input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g.: raden-saleh-deer-hunt" className={inputCls} /></label>
            <label className={labelCls}>Category<select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}><option value="painting">painting</option><option value="sculpture">sculpture</option><option value="textile">textile</option></select></label>
            <label className={labelCls}>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g.: Deer Hunt" className={inputCls} /></label>
            <label className={labelCls}>Artist<input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="e.g.: Raden Saleh (or Unknown ...)" className={inputCls} /></label>
            <label className={labelCls}>Year<input value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g.: 1840s" className={inputCls} /></label>
            <label className={labelCls}>Origin<input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g.: Java (painted in Europe)" className={inputCls} /></label>
            <label className={`${labelCls} sm:col-span-2`}>Period<input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g.: Romanticism, 19th century" className={inputCls} /></label>
            <label className={`${labelCls} sm:col-span-2`}>Summary (2–3 FACTUAL sentences)<textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="e.g.: A large Romantic hunting scene from Raden Saleh's European years. Deer flee diagonally while hunters on horseback give chase." className={inputCls} /></label>
            <label className={`${labelCls} sm:col-span-2`}>Identity evidence (1 line = 1 piece of evidence)<textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={3} placeholder={"e.g.:\nlarge-scale hunt composition\nRomantic style\nRaden Saleh's known hunt series"} className={`${inputCls} font-mono text-xs`} /></label>
            <label className={`${labelCls} sm:col-span-2`}>Sources (1 line = 1 URL)<textarea value={sources} onChange={(e) => setSources(e.target.value)} rows={2} placeholder="e.g.: https://en.wikipedia.org/wiki/Raden_Saleh" className={`${inputCls} font-mono text-xs`} /></label>
          </div>
        </div>

        <div className="rounded-3xl border-2 border-dashed border-primary/40 bg-card p-5">
          <h2 className="font-display text-2xl font-semibold">B. Visual cues <span className="text-sm font-normal text-muted-foreground">(used by searchKB — the more specific, the better)</span></h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>Objects — 1 line = 1 object <span className="text-xs font-bold text-primary">[weight 50% — MOST IMPORTANT]</span><textarea value={objects} onChange={(e) => setObjects(e.target.value)} rows={5} placeholder={"e.g.:\ndeer\nstag\nhunters on horseback\nhunting dogs\nforest\ntrees"} className={`${inputCls} font-mono text-xs`} /><span className={helpCls}>Be specific ("hunters on horseback"), not generic ("people").</span></label>
            <label className={labelCls}>Colors — 1 line = 1 English color <span className="text-xs font-bold text-primary">[weight 20%]</span><textarea value={colors} onChange={(e) => setColors(e.target.value)} rows={5} placeholder={"e.g.:\nearth brown\ndeep green\nwarm cream\ndark shadow"} className={`${inputCls} font-mono text-xs`} /><span className={helpCls}>Common names: brick red, deep blue, warm cream, golden yellow, moss green, earth brown, ivory white…</span></label>
            <label className={`${labelCls} sm:col-span-2`}>Composition — 1 sentence on positions <span className="text-xs font-bold text-primary">[weight 15%]</span><input value={composition} onChange={(e) => setComposition(e.target.value)} placeholder="e.g.: diagonal chase across the scene, animals in motion" className={inputCls} /><span className={helpCls}>Use words: left, right, center, foreground, background.</span></label>
            <label className={labelCls}>Mood — short phrase<textarea value={mood} onChange={(e) => setMood(e.target.value)} rows={2} placeholder="e.g.: dynamic and tense" className={inputCls} /></label>
            <label className={labelCls}>Symbolic elements — optional, 1 line = 1 item<textarea value={symbolic} onChange={(e) => setSymbolic(e.target.value)} rows={2} placeholder={"e.g.:\ncross\ncrown"} className={`${inputCls} font-mono text-xs`} /></label>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-2xl font-semibold">C. Music</h2>
          <label className={`${labelCls} mt-3 block`}>Music profile<select value={music} onChange={(e) => setMusic(e.target.value)} className={inputCls}>{MUSIC_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select><span className={helpCls}>The Test button below automatically suggests a profile based on fit.</span></label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={handleTest} disabled={busy !== null} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-6 py-3.5 font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50">
            {busy === "test" ? <Loader2 className="size-5 animate-spin" /> : <FlaskConical className="size-5" />} Test fit
          </button>
          <button onClick={handleSave} disabled={busy !== null} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground disabled:opacity-50">
            {busy === "save" ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />} Save to KB
          </button>
        </div>

        {testResult && <p className="rounded-lg bg-secondary/60 px-4 py-2.5 text-center text-sm font-medium">{testResult}</p>}
        {error && <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">{error}</p>}
        {saveResult && <p className="rounded-lg bg-emerald-500/10 px-4 py-2.5 text-center text-sm font-medium text-emerald-700">{saveResult}</p>}

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><Plus className="size-4 text-primary" /> Preview entry JSON (to be saved)</p>
          <pre className="max-h-72 overflow-auto rounded-xl bg-foreground p-3 text-xs leading-5 text-background">{JSON.stringify({
            id: id || "(auto from title+artist)", title, artist, year, origin, period, category,
            summary, visual_cues: { objects: objects.split("\n").map((s) => s.trim()).filter(Boolean), colors: colors.split("\n").map((s) => s.trim()).filter(Boolean), composition },
            identity_evidence: evidence.split("\n").map((s) => s.trim()).filter(Boolean),
            music_profile: music, sources: sources.split("\n").map((s) => s.trim()).filter(Boolean),
          }, null, 2)}</pre>
        </div>
      </div>
  );
}
