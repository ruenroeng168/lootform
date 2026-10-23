import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { STORE } from "@/lib/store-config";

export const metadata: Metadata = {
  title: {
    default: `${STORE.name} | ${STORE.tagline} ${STORE.city}`,
    template: `%s | ${STORE.name}`,
  },
  description: `${STORE.name} ร้านลูกชิ้นและอาหารปรุงสุก จังหวัด${STORE.city} เปิด ${STORE.openTime}–${STORE.closeTime} น.`,
  // Pre-launch preview: keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c2410c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-4">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
