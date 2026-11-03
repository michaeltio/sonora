"use client";

import { useMemo, useState } from "react";
import { FlaskConical, Loader2, Plus, Save } from "lucide-react";

const MUSIC_OPTIONS = [
  { id: "warm-reflective", label: "Warm Reflective — netral hangat (default aman)" },
  { id: "solemn-historical", label: "Solemn Historical — sejarah / khidmat / tegang" },
  { id: "warm-portrait", label: "Warm Portrait — potret intim" },
  { id: "abstract-textural", label: "Abstract Textural — abstrak / kontemporer" },
  { id: "spacious-sculpture", label: "Spacious Sculpture — patung / arca / relief batu" },
  { id: "textile-pattern", label: "Textile Pattern — batik / tenun / songket / ulos" },
  { id: "javanese-bronze", label: "Javanese Bronze — nuansa Jawa" },
  { id: "sundanese-bamboo", label: "Sundanese Bamboo — nuansa Sunda" },
  { id: "eastern-wooden", label: "Eastern Wooden — patung kayu / timur Indonesia" },
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
  // ---- A. Identitas (fakta, kamu isi) ----
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
  // ---- B. Visual cues (dipakai searchKB) ----
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
    id: id || slugify(`${artist}-${title}`) || "entry-baru",
    title: title || "Unknown",
    artist: artist || "Unknown",
    year: year || "unknown",
    origin: origin || "Indonesia",
    period: period || "unknown",
    category,
    summary: summary || "(isi ringkasan 2-3 kalimat berfakta)",
    visual_cues: {
      objects: lines(objects),
      colors: lines(colors),
      composition: composition || "(isi deskripsi posisi: kiri/kanan/tengah/latar)",
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
      setTestResult(`Hasil: ${data.verdict} ${Math.round(data.score * 100)}% → ${data.matchTitle || "(tidak cocok)"} | saran musik: ${data.suggestedMusicLabel}`);
      if (data.suggestedMusic) setMusic(data.suggestedMusic);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test gagal.");
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
      setSaveResult(`Tersimpan: ${data.id} (total ${data.totalEntries}). Self-test: ${data.selfTest.verdict} ${Math.round(data.selfTest.score * 100)}% → ${data.selfTest.matchedId}. ${data.note || ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save gagal.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-6">
        <div className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-2xl font-semibold">A. Identitas karya <span className="text-sm font-normal text-muted-foreground">(fakta — wajib benar)</span></h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>ID (slug, unik)<input value={id} onChange={(e) => setId(e.target.value)} placeholder="cth: raden-saleh-perburuan-rusa" className={inputCls} /></label>
            <label className={labelCls}>Kategori<select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}><option value="painting">painting</option><option value="sculpture">sculpture</option><option value="textile">textile</option></select></label>
            <label className={labelCls}>Judul<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="cth: Perburuan Rusa (Deer Hunt)" className={inputCls} /></label>
            <label className={labelCls}>Seniman<input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="cth: Raden Saleh (atau Unknown ...)" className={inputCls} /></label>
            <label className={labelCls}>Tahun<input value={year} onChange={(e) => setYear(e.target.value)} placeholder="cth: 1840s" className={inputCls} /></label>
            <label className={labelCls}>Asal<input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="cth: Java (painted in Europe)" className={inputCls} /></label>
            <label className={`${labelCls} sm:col-span-2`}>Periode<input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="cth: Romanticism, 19th century" className={inputCls} /></label>
            <label className={`${labelCls} sm:col-span-2`}>Summary (2–3 kalimat FAKTA)<textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="cth: A large Romantic hunting scene from Raden Saleh's European years. Deer flee diagonally while hunters on horseback give chase." className={inputCls} /></label>
            <label className={`${labelCls} sm:col-span-2`}>Identity evidence (1 baris = 1 bukti)<textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={3} placeholder={"cth:\nlarge-scale hunt composition\nRomantic style\nRaden Saleh's known hunt series"} className={`${inputCls} font-mono text-xs`} /></label>
            <label className={`${labelCls} sm:col-span-2`}>Sources (1 baris = 1 URL)<textarea value={sources} onChange={(e) => setSources(e.target.value)} rows={2} placeholder="cth: https://en.wikipedia.org/wiki/Raden_Saleh" className={`${inputCls} font-mono text-xs`} /></label>
          </div>
        </div>

        <div className="rounded-3xl border-2 border-dashed border-primary/40 bg-card p-5">
          <h2 className="font-display text-2xl font-semibold">B. Visual cues <span className="text-sm font-normal text-muted-foreground">(dipakai searchKB — makin spesifik makin bagus)</span></h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>Objects — 1 baris = 1 objek <span className="text-xs font-bold text-primary">[bobot 50% — PALING PENTING]</span><textarea value={objects} onChange={(e) => setObjects(e.target.value)} rows={5} placeholder={"cth:\ndeer\nstag\nhunters on horseback\nhunting dogs\nforest\ntrees"} className={`${inputCls} font-mono text-xs`} /><span className={helpCls}>Spesifik ("hunters on horseback"), bukan generik ("people").</span></label>
            <label className={labelCls}>Colors — 1 baris = 1 warna Inggris <span className="text-xs font-bold text-primary">[bobot 20%]</span><textarea value={colors} onChange={(e) => setColors(e.target.value)} rows={5} placeholder={"cth:\nearth brown\ndeep green\nwarm cream\ndark shadow"} className={`${inputCls} font-mono text-xs`} /><span className={helpCls}>Nama biasa: brick red, deep blue, warm cream, golden yellow, moss green, earth brown, ivory white…</span></label>
            <label className={`${labelCls} sm:col-span-2`}>Composition — 1 kalimat posisi <span className="text-xs font-bold text-primary">[bobot 15%]</span><input value={composition} onChange={(e) => setComposition(e.target.value)} placeholder="cth: diagonal chase across the scene, animals in motion" className={inputCls} /><span className={helpCls}>Pakai kata: left, right, center, foreground, background.</span></label>
            <label className={labelCls}>Mood — frasa pendek<textarea value={mood} onChange={(e) => setMood(e.target.value)} rows={2} placeholder="cth: dynamic and tense" className={inputCls} /></label>
            <label className={labelCls}>Symbolic elements — opsional, 1 baris = 1 item<textarea value={symbolic} onChange={(e) => setSymbolic(e.target.value)} rows={2} placeholder={"cth:\ncross\ncrown"} className={`${inputCls} font-mono text-xs`} /></label>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-2xl font-semibold">C. Musik</h2>
          <label className={`${labelCls} mt-3 block`}>Music profile<select value={music} onChange={(e) => setMusic(e.target.value)} className={inputCls}>{MUSIC_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select><span className={helpCls}>Tombol Test di bawah otomatis menyarankan profil berdasarkan kecocokan.</span></label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={handleTest} disabled={busy !== null} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-6 py-3.5 font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50">
            {busy === "test" ? <Loader2 className="size-5 animate-spin" /> : <FlaskConical className="size-5" />} Test kecocokan
          </button>
          <button onClick={handleSave} disabled={busy !== null} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground disabled:opacity-50">
            {busy === "save" ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />} Simpan ke KB
          </button>
        </div>

        {testResult && <p className="rounded-lg bg-secondary/60 px-4 py-2.5 text-center text-sm font-medium">{testResult}</p>}
        {error && <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">{error}</p>}
        {saveResult && <p className="rounded-lg bg-emerald-500/10 px-4 py-2.5 text-center text-sm font-medium text-emerald-700">{saveResult}</p>}

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><Plus className="size-4 text-primary" /> Preview entry JSON (yang akan disimpan)</p>
          <pre className="max-h-72 overflow-auto rounded-xl bg-foreground p-3 text-xs leading-5 text-background">{JSON.stringify({
            id: id || "(otomatis dari judul+seniman)", title, artist, year, origin, period, category,
            summary, visual_cues: { objects: objects.split("\n").map((s) => s.trim()).filter(Boolean), colors: colors.split("\n").map((s) => s.trim()).filter(Boolean), composition },
            identity_evidence: evidence.split("\n").map((s) => s.trim()).filter(Boolean),
            music_profile: music, sources: sources.split("\n").map((s) => s.trim()).filter(Boolean),
          }, null, 2)}</pre>
        </div>
      </div>
  );
}
