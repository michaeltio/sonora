import type { Metadata } from "next";
import { promises as fs } from "fs";
import path from "path";
import KbTabs from "@/app/components/KbTabs";

export const metadata: Metadata = {
  title: "Sonora",
  description: "Browse the Sonora knowledge base and add new entries through the attribute form.",
};

export const instant = false;

async function getEntries() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "artworks.json"), "utf-8");
    const db = JSON.parse(raw);
    return Array.isArray(db.entries) ? db.entries : [];
  } catch {
    return [];
  }
}

export default async function KbPage() {
  const entries = await getEntries();
  return <KbTabs entries={entries} />;
}
