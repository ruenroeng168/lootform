"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

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
  equip_slot: string;
  season: string;
  description: string | null;
  designs: CatalogDesign[];
  craft_ready: boolean;
  ready_design_count: number;
  total_design_count: number;
};

type CatalogSeason = {
  code: string;
  name: string;
  odds: Record<Grade, number>;
};

type CatalogResponse = {
  success: boolean;
  drop_open: boolean;
  season: CatalogSeason | null;
  catalog: CatalogProduct[];
};

export default function CatalogPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [season, setSeason] = useState<CatalogSeason | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage("");

      try {
        const [{ data: userData }, response] = await Promise.all([
          supabase.auth.getUser(),
          fetch("/api/catalog", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        setIsAuthenticated(Boolean(userData.user));

        const result = (await response.json()) as CatalogResponse;

        if (!response.ok || !result.success) {
          throw new Error("Unable to load catalog");
        }

        setDropOpen(result.drop_open);
        setSeason(result.season ?? null);
        setCatalog(result.catalog ?? []);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load catalog"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function goCraft() {
    router.push(isAuthenticated ? "/craft" : "/login");
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--foreground)] relative overflow-hidden">
      <Navbar />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-360px] h-[900px] w-[1100px] -translate-x-1/2 rounded-full bg-[var(--grade-rare)]/[0.08] blur-[190px]" />
        <div className="absolute bottom-[-360px] right-[-260px] h-[760px] w-[760px] rounded-full bg-[var(--grade-epic)]/[0.06] blur-[190px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1360px] px-5 pb-16 pt-10 sm:px-6 lg:px-7">
        <section className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-[9px] tracking-[0.3em] text-[var(--grade-rare)]">
              {season ? `SEASON // ${season.name}` : "LOOTFORM CATALOG"}
            </p>
            <h1 className="font-display mt-2 text-4xl font-black sm:text-5xl">
              FULL CATALOG
            </h1>
            <p className="mt-3 max-w-[560px] text-sm text-[var(--muted)]">
              Every product and design available to Craft this drop. Grades are rolled
              live by the server at the odds shown below — nothing is pre-decided.
            </p>
          </div>

          <button
            type="button"
            onClick={goCraft}
            className="rounded-xl bg-[var(--grade-rare)] px-6 py-3.5 text-sm font-black text-black transition hover:brightness-110"
          >
            {isAuthenticated ? "GO CRAFT" : "SIGN IN TO CRAFT"}
          </button>
        </section>

        {season && (
          <section className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {GRADE_ORDER.map((grade) => {
              const meta = GRADE_META[grade];
              return (
                <div
                  key={grade}
                  className="rounded-xl border bg-black/30 px-4 py-3 text-center"
                  style={{ borderColor: `color-mix(in srgb, ${meta.color} 30%, transparent)` }}
                >
                  <p className="font-mono text-[7px] tracking-[0.16em] text-[var(--muted-dim)]">
                    {meta.label}
                  </p>
                  <p className="mt-1 text-xl font-black" style={{ color: meta.color }}>
                    {season.odds[grade]}%
                  </p>
                </div>
              );
            })}
          </section>
        )}

        {errorMessage && (
          <div className="mt-8 rounded-xl border border-red-400/30 bg-red-400/[0.07] p-5 text-red-400">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <p className="mt-10 text-sm text-[var(--muted-dim)]">Loading catalog…</p>
        ) : !dropOpen || catalog.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-[var(--border)] bg-black/20 p-12 text-center text-sm text-[var(--muted-dim)]">
            No drop is live right now — check back soon.
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {catalog.map((product) => (
              <section key={product.id}>
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3">
                  <div>
                    <p className="font-mono text-[8px] tracking-[0.2em] text-[var(--muted-dim)]">
                      {product.category} · {product.equip_slot}
                    </p>
                    <h2 className="font-display mt-1 text-2xl font-black">
                      {product.name}
                    </h2>
                    {product.description && (
                      <p className="mt-1 max-w-[520px] text-xs text-[var(--muted)]">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] font-black text-[var(--muted-dim)]">
                    {product.ready_design_count}/{product.total_design_count} READY
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {product.designs.map((design) => (
                    <button
                      key={design.id}
                      type="button"
                      onClick={goCraft}
                      className={`hud-frame relative overflow-hidden p-3 text-left transition hover:brightness-110 ${
                        design.craft_ready ? "" : "opacity-70"
                      }`}
                    >
                      {!design.craft_ready && (
                        <span className="absolute right-2 top-2 z-10 rounded-full border border-[var(--border-strong)] bg-black/70 px-2 py-1 font-mono text-[7px] tracking-[0.16em] text-[var(--muted-dim)]">
                          COMING SOON
                        </span>
                      )}

                      <div className="flex h-[130px] items-center justify-center overflow-hidden rounded-lg bg-black/25">
                        {design.thumbnail_url ? (
                          <img
                            src={design.thumbnail_url}
                            alt={design.name}
                            className={`h-full w-full object-contain ${
                              design.craft_ready ? "" : "grayscale"
                            }`}
                            loading="lazy"
                          />
                        ) : (
                          <span className="font-mono text-[8px] tracking-[0.2em] text-[var(--muted-dim)]">
                            NO PREVIEW
                          </span>
                        )}
                      </div>

                      <p className="mt-3 truncate text-sm font-black text-white">
                        {design.name}
                      </p>

                      <p className="mt-1 text-xs font-black text-[var(--grade-rare)]">
                        {design.craft_cost_lt.toLocaleString()} LT
                      </p>

                      {design.available_sizes.length > 0 && (
                        <p className="mt-1 truncate font-mono text-[7px] tracking-[0.12em] text-[var(--muted-dim)]">
                          SIZES: {design.available_sizes.join(" / ")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
