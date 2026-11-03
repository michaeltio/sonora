import type { Metadata } from "next";
import Navbar from "@/app/components/Navbar";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sonora",
  description: "Scan an artwork and hear its story like a museum audio guide.",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/logo.svg",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} style={{ backgroundColor: "#F5EDE0", color: "#5D2E1F" }}>
      <body className="min-h-full flex flex-col" style={{ backgroundColor: "#F5EDE0", color: "#5D2E1F" }}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
