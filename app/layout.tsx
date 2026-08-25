import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/*
  LOOTFORM TYPE SYSTEM

  Display — Chakra Petch
    Angular, technical letterforms. Carries the "digital loot"
    identity in headers, titles, and grade labels. Native Thai
    support means it never silently falls back to a system font
    when Thai copy appears next to English.

  Body — IBM Plex Sans Thai
    Clean and dense-legible for stat blocks, inventory grids,
    and long-form copy in both languages.

  Data / Mono — IBM Plex Mono
    Reserved for serials, item codes, LT balances, and
    percentages — anything that reads as a system output
    rather than authored copy.
*/

const chakraPetch = Chakra_Petch({
  variable: "--font-display",
  subsets: ["latin", "thai"],
  weight: ["500", "600", "700"],
});

const plexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-body",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "LOOTFORM — Digital Loot, Physical Form",
  description:
    "Craft graded streetwear. Every drop is server-rolled — Common, Rare, Epic, Legendary — then shipped to your door.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${chakraPetch.variable} ${plexSansThai.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--foreground)] font-body">
        {children}
      </body>
    </html>
  );
}
