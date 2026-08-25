"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import Navbar from "@/components/Navbar";

type Grade = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

const GRADE_META: Record<Grade, { label: string; color: string }> = {
  COMMON: { label: "COMMON", color: "var(--grade-common)" },
  RARE: { label: "RARE", color: "var(--grade-rare)" },
  EPIC: { label: "EPIC", color: "var(--grade-epic)" },
  LEGENDARY: { label: "LEGENDARY", color: "var(--grade-legendary)" },
};

const GRADE_ORDER: Grade[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

type CatalogDesign = {
  id: number;
  name: string;
  craft_cost_lt: number;
  thumbnail_url: string | null;
  available_sizes: string[];
  craft_ready: boolean;
};

type CatalogProduct = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  designs: CatalogDesign[];
};

type CatalogSeason = {
  code: string;
  name: string;
  odds: Record<Grade, number>;
  start_at: string | null;
  end_at: string | null;
};

type RecentPull = {
  grade: Grade;
  product: string;
  created_at: string;
};

type CatalogResponse = {
  success: boolean;
  drop_open: boolean;
  season: CatalogSeason | null;
  catalog: CatalogProduct[];
  recent_pulls?: RecentPull[];
};

function useCountdown(endAt: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endAt) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [endAt]);

  if (!endAt) {
    return null;
  }

  const remainingMs = new Date(endAt).getTime() - now;

  if (remainingMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

function timeAgo(isoDate: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function PublicHome() {
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [dropOpen, setDropOpen] = useState(false);
  const [season, setSeason] = useState<CatalogSeason | null>(null);
  const [recentPulls, setRecentPulls] = useState<RecentPull[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        const result = (await response.json()) as CatalogResponse;

        if (cancelled || !response.ok || !result.success) {
          return;
        }

        setDropOpen(result.drop_open);
        setSeason(result.season ?? null);
        setCatalog(result.catalog ?? []);
        setRecentPulls(result.recent_pulls ?? []);
      } catch {
        // Guests can still browse the marketing page if the catalog fails to load.
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const countdown = useCountdown(season?.end_at ?? null);

  const catalogDesigns = catalog
    .flatMap((product) => product.designs.map((design) => ({ product, design })))
    .slice(0, 8);

  const tickerEntries = useMemo(() => {
    if (recentPulls.length === 0) {
      return [];
    }
    // Duplicate the list so the CSS marquee can loop seamlessly.
    return [...recentPulls, ...recentPulls];
  }, [recentPulls]);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--foreground)] relative overflow-hidden">
      <Navbar />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-360px] h-[900px] w-[1100px] -translate-x-1/2 rounded-full bg-[var(--grade-rare)]/[0.08] blur-[190px]" />
        <div className="absolute bottom-[-360px] left-[-260px] h-[760px] w-[760px] rounded-full bg-[var(--grade-epic)]/[0.08] blur-[190px]" />
        <div className="absolute bottom-[-360px] right-[-260px] h-[760px] w-[760px] rounded-full bg-[var(--grade-legendary)]/[0.05] blur-[190px]" />
      </div>

      {/* ============================================================
          LIVE PULL TICKER — sourced from real recent Craft events,
          no player identity exposed.
      ============================================================ */}
      {tickerEntries.length > 0 && (
        <div className="relative z-10 overflow-hidden border-b border-[var(--border)] bg-black/40 py-2">
          <div className="ticker-track flex w-max items-center gap-8">
            {tickerEntries.map((pull, index) => (
              <span
                key={`${pull.created_at}-${index}`}
                className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] tracking-[0.14em]"
              >
                <span style={{ color: GRADE_META[pull.grade].color }} className="font-black">
                  ●
                </span>
                <span className="text-white">SOMEONE JUST PULLED</span>
                <span className="font-black" style={{ color: GRADE_META[pull.grade].color }}>
                  {pull.grade}
                </span>
                <span className="text-[var(--muted-dim)]">— {pull.product}</span>
                <span className="text-[var(--muted-dim)]">· {timeAgo(pull.created_at)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-[1360px] px-5 pb-16 pt-12 sm:px-6 lg:px-7 lg:pt-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <div>
            <p className="font-mono text-[9px] tracking-[0.34em] text-[var(--grade-rare)]">
              LOOTFORM // DIGITAL LOOT SYSTEM
            </p>

            <h1 className="font-display mt-5 max-w-[820px] text-[54px] font-black leading-[0.92] sm:text-[72px] lg:text-[86px]">
              OPEN THE BOX.
              <br />
              <span className="text-[var(--grade-rare)]">WEAR</span> THE DROP.
            </h1>

            <p className="mt-7 max-w-[650px] text-sm leading-7 text-[var(--muted)] sm:text-base">
              A LOOTFORM box is a real piece of apparel and a real in-game item at the same time —
              no streetwear brand and no gacha game gives you both. Craft a design, reveal your
              grade live, and the same item shows up on your body and in your player collection.
            </p>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="rounded-xl bg-[var(--grade-rare)] px-8 py-4 text-sm font-black tracking-[0.04em] text-black transition hover:brightness-110"
              >
                OPEN THE BOX NOW
              </button>
            </div>

            {countdown && !countdown.expired && (
              <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-[var(--border)] bg-black/25 px-4 py-3">
                <span className="font-mono text-[8px] tracking-[0.22em] text-[var(--muted-dim)]">
                  {season?.name ?? "THIS DROP"} CLOSES IN
                </span>
                <span className="font-mono text-sm font-black text-[var(--grade-legendary)]">
                  {String(countdown.days).padStart(2, "0")}D{" "}
                  {String(countdown.hours).padStart(2, "0")}H{" "}
                  {String(countdown.minutes).padStart(2, "0")}M{" "}
                  {String(countdown.seconds).padStart(2, "0")}S
                </span>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[9px] tracking-[0.2em] text-[var(--muted-dim)]">
              <span>PHYSICAL PRODUCT</span>
              <span>UNIQUE ITEM ID</span>
              <span>GRADE SYSTEM</span>
              <span>PLAYER COLLECTION</span>
            </div>
          </div>

          <div className="relative">
            <div className="loot-box-float relative mx-auto h-[280px] w-[280px] sm:h-[320px] sm:w-[320px]">
              <div className="absolute inset-0 rounded-[32px] bg-[var(--grade-rare)]/25 blur-[60px]" />
              <div
                className="hud-frame hud-glow relative flex h-full w-full flex-col items-center justify-center gap-3 rounded-[24px] bg-gradient-to-br from-[var(--surface-raised)] to-black/60"
                style={{ "--grade-color": "var(--grade-rare)" } as CSSProperties}
              >
                <span className="text-6xl">🎁</span>
                <p className="font-mono text-[9px] tracking-[0.24em] text-[var(--grade-rare)]">
                  {season?.name ?? "SEASON DROP"}
                </p>
                <p className="font-display text-lg font-black">MYSTERY BOX</p>
              </div>

              {GRADE_ORDER.map((grade, index) => {
                const meta = GRADE_META[grade];
                const odds = season?.odds?.[grade];
                const positions = [
                  { top: "-8%", left: "-14%" },
                  { top: "-8%", right: "-14%" },
                  { bottom: "-8%", left: "-14%" },
                  { bottom: "-8%", right: "-14%" },
                ];

                return (
                  <div
                    key={grade}
                    className="absolute rounded-full border bg-black/80 px-3 py-1.5 backdrop-blur-xl"
                    style={{
                      borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)`,
                      ...positions[index],
                    }}
                  >
                    <p
                      className="text-center font-mono text-[8px] font-black tracking-[0.12em]"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </p>
                    <p className="text-center font-mono text-[9px] font-black text-white">
                      {typeof odds === "number" ? `${odds}%` : "—"}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="mt-10 text-center font-mono text-[8px] tracking-[0.2em] text-[var(--muted-dim)]">
              DROP RATES ARE SHOWN OPENLY — WHAT YOU SEE IS WHAT THE SERVER ROLLS
            </p>
          </div>
        </section>

        {/* ============================================================
            CATALOG PREVIEW
        ============================================================ */}
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[9px] tracking-[0.28em] text-[var(--grade-rare)]">
                {season ? `SEASON // ${season.name}` : "PRODUCT CATALOG"}
              </p>
              <h2 className="font-display mt-2 text-2xl font-black sm:text-3xl">
                BROWSE THIS DROP
              </h2>
            </div>
            <p className="max-w-[420px] text-xs text-[var(--muted-dim)]">
              Preview what&apos;s craftable this season. Create a player to open the box, reveal a
              grade and start your collection.
            </p>
          </div>

          {catalogLoading ? (
            <p className="mt-6 text-sm text-[var(--muted-dim)]">Loading catalog…</p>
          ) : !dropOpen || catalogDesigns.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-black/20 p-8 text-center text-sm text-[var(--muted-dim)]">
              No drop is live right now — check back soon.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {catalogDesigns.map(({ product, design }) => (
                <button
                  key={design.id}
                  type="button"
                  onClick={() => router.push("/login")}
                  className={`hud-frame relative overflow-hidden p-3 text-left transition hover:brightness-110 ${
                    design.craft_ready ? "" : "opacity-70"
                  }`}
                  style={{ "--grade-color": "var(--grade-rare)" } as CSSProperties}
                >
                  {!design.craft_ready && (
                    <span className="absolute right-2 top-2 z-10 rounded-full border border-[var(--border-strong)] bg-black/70 px-2 py-1 font-mono text-[7px] tracking-[0.16em] text-[var(--muted-dim)]">
                      COMING SOON
                    </span>
                  )}

                  <div className="flex h-[120px] items-center justify-center overflow-hidden rounded-lg bg-black/25">
                    {design.thumbnail_url ? (
                      <img
                        src={design.thumbnail_url}
                        alt={design.name}
                        className={`h-full w-full object-contain ${design.craft_ready ? "" : "grayscale"}`}
                        loading="lazy"
                      />
                    ) : (
                      <span className="font-mono text-[8px] tracking-[0.2em] text-[var(--muted-dim)]">
                        NO PREVIEW
                      </span>
                    )}
                  </div>

                  <p className="mt-3 truncate font-mono text-[8px] tracking-[0.18em] text-[var(--muted-dim)]">
                    {product.category}
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-white">{design.name}</p>
                  <p className="mt-1 text-xs font-black text-[var(--grade-rare)]">
                    {design.craft_cost_lt.toLocaleString()} LT
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ============================================================
            HOW IT WORKS — real order → reveal → wear/play flow
        ============================================================ */}
        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["01", "ORDER", "Pick a design, spend LT, and lock in your Craft — this is a real purchase of a real physical item."],
            ["02", "REVEAL ONLINE", "The grade is rolled by the server the instant you Craft. No waiting for shipping to find out what you got."],
            ["03", "WEAR IT / PLAY IT", "The same item is now in your player collection and on its way to your door — equip it in-game and wear it in real life."],
          ].map(([index, title, description]) => (
            <article key={index} className="hud-frame p-6" style={{ "--grade-color": "var(--grade-rare)" } as CSSProperties}>
              <p className="font-mono text-[9px] tracking-[0.24em] text-[var(--grade-rare)]">{index}</p>
              <h2 className="font-display mt-4 text-xl font-black">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </section>
      </div>

      <style jsx>{`
        @keyframes lootformTicker {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        .ticker-track {
          animation: lootformTicker 28s linear infinite;
          padding-left: 1.5rem;
        }

        @keyframes lootformFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-14px);
          }
        }

        .loot-box-float {
          animation: lootformFloat 4.5s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
