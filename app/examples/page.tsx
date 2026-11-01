import type { Metadata } from "next";
import ExamplesPageClient from "@/app/components/ExamplesPage";

export const metadata: Metadata = {
  title: "Examples — Sonora",
  description: "Curated Indonesian artworks with ready narration. Press play, no upload or AI request needed.",
};

export default function ExamplesPage() {
  return <ExamplesPageClient />;
}
