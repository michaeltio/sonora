"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ListMusic, Search } from "lucide-react";
import KbFormPage from "@/app/components/KbFormPage";

interface KbEntry {
  id: string;
  title: string;
  artist: string;
  year?: string;
  origin?: string;
  period?: string;
  category: string;
  summary: string;
  visual_cues: { objects: string[]; colors: string[]; composition: string };
  identity_evidence?: string[];
  music_profile?: string;
  sources?: string[];
}

function EntryCard({ entry }: { entry: KbEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-secondary/40"
      >
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          {entry.category}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-semibold">{entry.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {entry.artist} · {entry.id}
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-4 py-4 text-sm">
          <p className="leading-relaxed">{entry.summary}</p>
          <div>
            <p className="font-semibold">Visual cues</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {(entry.visual_cues?.objects || []).map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
            <p className="mt-1 text-muted-foreground">
              Colors: {(entry.visual_cues?.colors || []).join(", ") || "-"}
            </p>
            <p className="mt-1 text-muted-foreground">Composition: {entry.visual_cues?.composition || "-"}</p>
          </div>
          {(entry.identity_evidence?.length || 0) > 0 && (
            <div>
              <p className="font-semibold">Identity evidence</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {entry.identity_evidence!.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ListMusic className="size-3.5" />
            Music: {entry.music_profile || "-"}
            {entry.period ? ` · ${entry.period}` : ""}
            {entry.origin ? ` · ${entry.origin}` : ""}
          </p>
          {(entry.sources?.length || 0) > 0 && (
            <div className="space-y-0.5">
              {entry.sources!.map((s, i) => (
                <a key={i} href={s} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">
                  {s}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function KbTabs({ entries }: { entries: KbEntry[] }) {
  const [tab, setTab] = useState<"list" | "add">("list");
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return entries.filter((e) => {
      if (filterCat !== "all" && e.category !== filterCat) return false;
      if (!q) return true;
      const hay = [e.id, e.title, e.artist, e.origin, e.period, e.summary, ...(e.visual_cues?.objects || [])]
        .join(" ")
        .toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [entries, query, filterCat]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) c[e.category] = (c[e.category] || 0) + 1;
    return c;
  }, [entries]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      <section className="text-center">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          Knowledge Base,<br />
          <span className="italic text-primary">fill in its memory.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          {entries.length} entries registered. Browse them in the List tab, add new ones in the Add tab.
        </p>
      </section>

      <div className="mx-auto mt-8 flex w-fit gap-1 rounded-2xl border border-[#D4BFA6] bg-[#FFF8F0]/80 p-1 shadow-sm">
        {(["list", "add"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={
              tab === t
                ? "rounded-xl bg-[#B45309] px-5 py-2 text-sm font-semibold text-[#FFF8F0] shadow-sm"
                : "rounded-xl px-5 py-2 text-sm font-semibold text-[#5D2E1F] transition hover:bg-[#EADCC8]"
            }
          >
            {t === "list" ? `List (${entries.length})` : "Add"}
          </button>
        ))}
      </div>

      {tab === "list" ? (
        <section className="mx-auto mt-6 max-w-3xl">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, artist, object, color…"
                className="w-full rounded-xl border bg-card py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="rounded-xl border bg-card px-3 py-2.5 text-sm font-semibold"
            >
              <option value="all">All ({counts.all || 0})</option>
              <option value="painting">Painting ({counts.painting || 0})</option>
              <option value="sculpture">Sculpture ({counts.sculpture || 0})</option>
              <option value="textile">Textile ({counts.textile || 0})</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              No entries match. Try different keywords — or add one in the Add tab.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {filtered.map((e) => (
                <EntryCard key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <KbFormPage />
      )}
    </main>
  );
}
