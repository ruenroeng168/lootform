"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import Navbar from "@/components/Navbar";

const HeroBoxModel3D = dynamic(() => import("@/components/HeroBoxModel3D"), {
  ssr: false,
});

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
  hero_image_url: string | null;
  hero_model_url: string | null;
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
        <div className="ticker-fade relative z-10 overflow-hidden border-b border-[var(--border)] bg-black/40 py-2">
          <div className="ticker-track flex w-max items-center gap-8">
            {tickerEntries.map((pull, index) => (
              <span
                key={`${pull.created_at}-${index}`}
                className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] tracking-[0.14em]"
              >
                <span style={{ color: GRADE_META[pull.grade].color }} className="font-black">
                  ●
                </span>
                <span className="text-white">เพิ่งมีคนเปิดได้</span>
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
        <section className="grid items-start gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <div>
            <p className="font-mono text-[9px] tracking-[0.34em] text-[var(--grade-rare)]">
              LOOTFORM // ร้านเสื้อผ้าสตรีทแวร์ + เกมสะสมไอเทม
            </p>

            <h1 className="font-display mt-5 max-w-[720px] text-[40px] font-black leading-[1.25] sm:text-[54px] lg:text-[64px]">
              เปิดกล่องเดียว
              <br />
              ได้<span className="text-[var(--grade-rare)]">เสื้อจริง</span>
              <br />
              <span className="text-[var(--grade-rare)]">+</span> ไอเทมเกม
            </h1>

            <p className="mt-7 max-w-[650px] text-sm leading-7 text-[var(--muted)] sm:text-base">
              LOOTFORM คือแบรนด์สตรีทแวร์ที่ทุกกล่องคือของจริง 2 อย่างพร้อมกัน — เสื้อผ้าตัวจริงที่จัดส่งถึงบ้านคุณ
              และไอเทมในเกมที่ใช้เล่นได้จริงในบัญชีของคุณ ไม่มีแบรนด์เสื้อไหนหรือเกมกาชาไหนให้คุณได้ทั้งสองอย่างพร้อมกัน
              เลือกดีไซน์ Craft แล้วดูเกรดถูกเผยสด ๆ ไอเทมชิ้นเดียวกันจะโผล่ทั้งบนตัวคุณและในคอลเลกชันผู้เล่น
            </p>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="rounded-xl bg-[var(--grade-rare)] px-8 py-4 text-sm font-black tracking-[0.04em] text-black shadow-[0_8px_30px_-8px_var(--grade-rare)] transition hover:brightness-110 hover:shadow-[0_10px_40px_-6px_var(--grade-rare)]"
              >
                เปิดกล่องเลย
              </button>

              <p className="mt-3 text-xs text-[var(--muted-dim)]">
                สมัครฟรี · มีผู้เล่นอยู่แล้ว?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="font-bold text-[var(--grade-rare)] hover:underline"
                >
                  เข้าสู่ระบบ
                </button>
              </p>
            </div>

            {countdown && !countdown.expired && (
              <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-[var(--border)] bg-black/25 px-4 py-3">
                <span className="font-mono text-[8px] tracking-[0.22em] text-[var(--muted-dim)]">
                  {season?.name ?? "ซีซั่นนี้"} ปิดรับใน
                </span>
                <span className="font-mono text-sm font-black text-[var(--grade-legendary)]">
                  {String(countdown.days).padStart(2, "0")}D{" "}
                  {String(countdown.hours).padStart(2, "0")}H{" "}
                  {String(countdown.minutes).padStart(2, "0")}M{" "}
                  {String(countdown.seconds).padStart(2, "0")}S
                </span>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-2">
              {[
                ["🔒", "บัญชีปลอดภัย"],
                ["🎲", "อัตราสุ่มเปิดเผยจริง"],
                ["📦", "จัดส่งของจริงถึงบ้าน"],
                ["🏷️", "มีเลขไอเทมเฉพาะตัว"],
              ].map(([icon, label]) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-black/30 px-3 py-1.5 font-mono text-[9px] tracking-[0.14em] text-[var(--muted)]"
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="loot-box-float relative mx-auto h-[280px] w-[280px] sm:h-[320px] sm:w-[320px]">
              <div className="absolute inset-0 rounded-[32px] bg-[var(--grade-rare)]/25 blur-[60px]" />
              <div
                className="hud-frame hud-glow relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-br from-[var(--surface-raised)] to-black/60"
                style={{ "--grade-color": "var(--grade-rare)" } as CSSProperties}
              >
                {season?.hero_model_url ? (
                  <HeroBoxModel3D
                    modelUrl={season.hero_model_url}
                    fallback={<HeroBoxPlaceholder seasonName={season?.name} />}
                  />
                ) : season?.hero_image_url ? (
                  <img
                    src={season.hero_image_url}
                    alt="Season hero"
                    className="h-full w-full object-contain p-6"
                  />
                ) : (
                  <HeroBoxPlaceholder seasonName={season?.name} />
                )}
              </div>

              {GRADE_ORDER.map((grade, index) => {
                const meta = GRADE_META[grade];
                const odds = season?.odds?.[grade];
                const positions = [
                  { top: "-4%", left: "-4%" },
                  { top: "-4%", right: "-4%" },
                  { bottom: "-4%", left: "-4%" },
                  { bottom: "-4%", right: "-4%" },
                ];
                // Rarer grades read visually bigger, brighter and more
                // alive — reinforces the value gradient at a glance
                // instead of 4 identical badges that only differ by color.
                const paddingClass = ["px-3 py-1.5", "px-3.5 py-2", "px-4 py-2.5", "px-5 py-3"][index];
                const labelSizeClass = ["text-[8px]", "text-[9px]", "text-[10px]", "text-[11px]"][index];
                const pctSizeClass = ["text-[11px]", "text-[12px]", "text-[15px]", "text-[18px]"][index];
                const borderWidthClass = ["border", "border", "border-[1.5px]", "border-2"][index];
                const glowPx = [6, 12, 22, 36][index];
                const glowAlpha = [30, 40, 55, 70][index];
                const isPulsing = index >= 2;

                return (
                  <div
                    key={grade}
                    className={`badge-in absolute rounded-full ${borderWidthClass} bg-black/85 ${paddingClass} backdrop-blur-xl ${
                      isPulsing ? "badge-pulse" : ""
                    }`}
                    style={{
                      borderColor: `color-mix(in srgb, ${meta.color} ${45 + index * 8}%, transparent)`,
                      boxShadow: `0 0 ${glowPx}px color-mix(in srgb, ${meta.color} ${glowAlpha}%, transparent)`,
                      animationDelay: `${index * 0.15}s`,
                      ...positions[index],
                    }}
                  >
                    <p
                      className={`text-center font-mono ${labelSizeClass} font-black tracking-[0.14em]`}
                      style={{
                        color: meta.color,
                        textShadow:
                          index >= 2
                            ? `0 0 10px color-mix(in srgb, ${meta.color} 80%, transparent)`
                            : undefined,
                      }}
                    >
                      {meta.label}
                    </p>
                    <p className={`text-center font-mono ${pctSizeClass} font-black text-white`}>
                      {typeof odds === "number" ? `${odds}%` : "—"}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="mt-10 text-center font-mono text-[8px] tracking-[0.2em] text-[var(--muted-dim)]">
              อัตราสุ่มเปิดเผยตรงไปตรงมา — สิ่งที่คุณเห็นคือสิ่งที่เซิร์ฟเวอร์สุ่มจริง
            </p>
          </div>
        </section>

        {/* ============================================================
            WHAT IS LOOTFORM — plain-language explainer for a first-time
            visitor: this is a clothing store where every item doubles
            as a playable game item. Placed right after the hero so
            nobody has to guess what the site sells.
        ============================================================ */}
        <section className="mt-14 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <article
            className="hud-frame p-6 text-center sm:text-left"
            style={{ "--grade-color": "var(--grade-rare)" } as CSSProperties}
          >
            <span className="text-3xl" aria-hidden="true">
              👕
            </span>
            <h3 className="font-display mt-3 text-lg font-black">เสื้อผ้าตัวจริง</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              สตรีทแวร์คุณภาพจริง จัดส่งถึงบ้านคุณ ไม่ใช่แค่ของในหน้าจอ
            </p>
          </article>

          <div className="text-center text-2xl font-black text-[var(--muted-dim)]">+</div>

          <article
            className="hud-frame p-6 text-center sm:text-left"
            style={{ "--grade-color": "var(--grade-epic)" } as CSSProperties}
          >
            <span className="text-3xl" aria-hidden="true">
              🎮
            </span>
            <h3 className="font-display mt-3 text-lg font-black">ไอเทมในเกม</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              เสื้อตัวเดียวกันนี้เล่นได้จริงในเกมของ LOOTFORM มีเกรด มีค่าพลัง มีเลขประจำตัวเฉพาะตัว
            </p>
          </article>
        </section>

        {/* ============================================================
            CATALOG PREVIEW
        ============================================================ */}
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[9px] tracking-[0.28em] text-[var(--grade-rare)]">
                {season ? `SEASON // ${season.name}` : "แคตตาล็อกสินค้า"}
              </p>
              <h2 className="font-display mt-2 text-2xl font-black sm:text-3xl">
                สินค้าที่เปิด Craft อยู่ตอนนี้
              </h2>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <p className="max-w-[420px] text-xs text-[var(--muted-dim)]">
                ตัวอย่างสิ่งที่ Craft ได้ในซีซั่นนี้ สร้างผู้เล่นเพื่อเปิดกล่อง เผยเกรด และเริ่มคอลเลกชันของคุณ
              </p>
              <button
                type="button"
                onClick={() => router.push("/catalog")}
                className="font-mono text-[9px] font-black tracking-[0.16em] text-[var(--grade-rare)] hover:underline"
              >
                ดูแคตตาล็อกทั้งหมด →
              </button>
            </div>
          </div>

          {catalogLoading ? (
            <p className="mt-6 text-sm text-[var(--muted-dim)]">กำลังโหลดแคตตาล็อก…</p>
          ) : !dropOpen || catalogDesigns.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-black/20 p-8 text-center text-sm text-[var(--muted-dim)]">
              ตอนนี้ยังไม่มีดรอปที่เปิดอยู่ — กลับมาเช็คอีกครั้งเร็ว ๆ นี้
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
                      เร็ว ๆ นี้
                    </span>
                  )}

                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-black/25">
                    {design.thumbnail_url ? (
                      <img
                        src={design.thumbnail_url}
                        alt={design.name}
                        className={`h-full w-full object-cover ${design.craft_ready ? "" : "grayscale"}`}
                        loading="lazy"
                      />
                    ) : (
                      <span className="font-mono text-[8px] tracking-[0.2em] text-[var(--muted-dim)]">
                        ยังไม่มีรูป
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
        <section className="mt-16">
          <p className="font-mono text-[9px] tracking-[0.28em] text-[var(--grade-rare)]">
            วิธีการเล่น
          </p>
          <h2 className="font-display mt-2 text-2xl font-black sm:text-3xl">
            จากสั่งซื้อ ถึงใส่จริง เล่นจริง
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["01", "สั่งซื้อ", "เลือกดีไซน์ ใช้ LT และล็อก Craft ของคุณ — นี่คือการซื้อของจริง ชิ้นงานจริง ไม่ใช่ของเสมือน"],
            ["02", "เผยเกรดสด ๆ", "เกรดถูกสุ่มโดยเซิร์ฟเวอร์ทันทีที่คุณ Craft ไม่ต้องรอของมาส่งถึงจะรู้ว่าได้อะไร"],
            ["03", "ใส่จริง / เล่นจริง", "ไอเทมชิ้นเดียวกันอยู่ในคอลเลกชันผู้เล่นของคุณทันที และกำลังเดินทางมาส่งถึงบ้าน — สวมใส่จริงพร้อมใช้เล่นในเกม"],
          ].map(([index, title, description]) => (
            <article key={index} className="hud-frame p-6" style={{ "--grade-color": "var(--grade-rare)" } as CSSProperties}>
              <p className="font-mono text-[9px] tracking-[0.24em] text-[var(--grade-rare)]">{index}</p>
              <h2 className="font-display mt-4 text-xl font-black">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
            </article>
          ))}
          </div>
        </section>

        {/* ============================================================
            FAQ / TRUST — answers the questions a first-time guest has
            before they'll hand over LT. Keeps claims to what the badges
            above already promise (secure account, server odds, unique
            ID, real shipping) — no invented shipping times or refund
            policy numbers.
        ============================================================ */}
        <section className="mt-16">
          <p className="font-mono text-[9px] tracking-[0.28em] text-[var(--grade-rare)]">
            ก่อนเปิดกล่อง
          </p>
          <h2 className="font-display mt-2 text-2xl font-black sm:text-3xl">
            คำถามที่พบบ่อย
          </h2>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {[
              [
                "Grade ถูกสุ่มยังไง เชื่อถือได้แค่ไหน?",
                "เกรดถูกสุ่มโดยเซิร์ฟเวอร์ทันทีที่คุณกด Craft ไม่ใช่สุ่มฝั่งเบราว์เซอร์ และอัตรา Drop ของแต่ละ Season ถูกแสดงไว้อย่างเปิดเผยที่ด้านบนของหน้านี้ — สิ่งที่คุณเห็นคือสิ่งที่เซิร์ฟเวอร์ทอยจริง",
              ],
              [
                "บัญชีและข้อมูลของฉันปลอดภัยไหม?",
                "ระบบบัญชีใช้การยืนยันตัวตนแบบเดียวกับที่เว็บระดับมาตรฐานใช้ (Supabase Auth) รองรับทั้งอีเมล/รหัสผ่านและการล็อกอินผ่าน Google เรายึดหลักไม่ให้ฝั่งเบราว์เซอร์แก้ไขค่ากระเป๋าเงิน เกรด หรือความเป็นเจ้าของไอเทมได้โดยตรง ทุกอย่างตรวจสอบฝั่งเซิร์ฟเวอร์เสมอ",
              ],
              [
                "ไอเทมที่ได้มีเลขประจำตัวจริงไหม ซ้ำกับคนอื่นได้ไหม?",
                "ไอเทมทุกชิ้นที่ Craft สำเร็จจะได้รับ Serial Number เฉพาะตัว ผูกกับบัญชีของคุณ ไม่มีวันซ้ำกับไอเทมชิ้นอื่น และใช้เลขเดียวกันทั้งในระบบเกมและของจริงที่จัดส่ง",
              ],
              [
                "ของจริงจะได้รับยังไง?",
                "เมื่อ Craft สำเร็จ ไอเทมจะปรากฏในคอลเลกชันของคุณทันที และทีมงานจะจัดส่งของจริงตามที่อยู่ที่ลงทะเบียนไว้ในบัญชี — รายละเอียดรอบการจัดส่งและนโยบายการคืนสินค้าจะแจ้งในหน้าบัญชีของคุณ",
              ],
            ].map(([question, answer]) => (
              <article
                key={question}
                className="hud-frame p-5"
                style={{ "--grade-color": "var(--grade-rare)" } as CSSProperties}
              >
                <h3 className="text-sm font-black text-white">{question}</h3>
                <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{answer}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ============================================================
            CLOSING CTA — repeat the ask for anyone who scrolled this far
        ============================================================ */}
        <section className="hud-frame relative mt-16 overflow-hidden p-8 text-center sm:p-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(60% 100% at 50% 0%, var(--grade-rare) 0%, transparent 70%)",
            }}
          />

          <div className="relative">
            <p className="font-mono text-[9px] tracking-[0.28em] text-[var(--grade-rare)]">
              พร้อมหรือยัง
            </p>
            <h2 className="font-display mt-3 text-2xl font-black sm:text-4xl">
              สร้างผู้เล่นของคุณ แล้ว Craft กล่องแรก
            </h2>
            <p className="mx-auto mt-3 max-w-[520px] text-sm text-[var(--muted)]">
              สมัครฟรี อัตราสุ่มโดยเซิร์ฟเวอร์ และของจริงจะถูกจัดส่งทันทีที่คุณ Craft
            </p>

            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-7 rounded-xl bg-[var(--grade-rare)] px-10 py-4 text-sm font-black tracking-[0.04em] text-black transition hover:brightness-110"
            >
              เปิดกล่องเลย
            </button>
          </div>
        </section>
      </div>

      <style jsx>{`
        .ticker-fade {
          mask-image: linear-gradient(
            90deg,
            transparent 0,
            black 48px,
            black calc(100% - 48px),
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            90deg,
            transparent 0,
            black 48px,
            black calc(100% - 48px),
            transparent 100%
          );
        }

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

        @keyframes lootformBadgeIn {
          from {
            opacity: 0;
            transform: scale(0.6);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes lootformBadgePulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }

        .badge-in {
          animation: lootformBadgeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        .badge-pulse {
          animation:
            lootformBadgeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards,
            lootformBadgePulse 2.4s ease-in-out 0.6s infinite;
        }
      `}</style>
    </main>
  );
}

function HeroBoxPlaceholder({ seasonName }: { seasonName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <span className="text-6xl">🎁</span>
      <p className="font-mono text-[9px] tracking-[0.24em] text-[var(--grade-rare)]">
        {seasonName ?? "SEASON DROP"}
      </p>
      <p className="font-display text-lg font-black">กล่องปริศนา</p>
    </div>
  );
}
