"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import Navbar from "@/components/Navbar";

const gradeCards = [
  { grade: "COMMON", rate: "BASE DROP", color: "var(--grade-common)" },
  { grade: "RARE", rate: "UNCOMMON FIND", color: "var(--grade-rare)" },
  { grade: "EPIC", rate: "HIGH VALUE", color: "var(--grade-epic)" },
  { grade: "LEGENDARY", rate: "ULTRA RARE", color: "var(--grade-legendary)" },
];

export default function PublicHome() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--foreground)] relative overflow-hidden">
      <Navbar />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-360px] h-[900px] w-[1100px] -translate-x-1/2 rounded-full bg-[var(--grade-rare)]/[0.08] blur-[190px]" />
        <div className="absolute bottom-[-360px] left-[-260px] h-[760px] w-[760px] rounded-full bg-[var(--grade-epic)]/[0.08] blur-[190px]" />
        <div className="absolute bottom-[-360px] right-[-260px] h-[760px] w-[760px] rounded-full bg-[var(--grade-legendary)]/[0.05] blur-[190px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1360px] px-5 pb-16 pt-12 sm:px-6 lg:px-7 lg:pt-20">
        <section className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <div>
            <p className="font-mono text-[9px] tracking-[0.34em] text-[var(--grade-rare)]">
              LOOTFORM // DIGITAL LOOT SYSTEM
            </p>

            <h1 className="font-display mt-5 max-w-[820px] text-[54px] font-black leading-[0.92] sm:text-[72px] lg:text-[92px]">
              CRAFT.
              <br />
              <span className="text-[var(--grade-rare)]">COLLECT.</span>
              <br />
              LEVEL UP.
            </h1>

            <p className="mt-7 max-w-[650px] text-sm leading-7 text-[var(--muted)] sm:text-base">
              LOOTFORM turns physical apparel into a collectible game system. Craft a design,
              reveal its grade, build your collection, equip your character, and grow your player identity.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="rounded-xl bg-[var(--grade-rare)] px-6 py-3.5 text-sm font-black text-black transition hover:brightness-110"
              >
                ENTER LOOTFORM
              </button>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="rounded-xl border border-[var(--border-strong)] bg-white/[0.02] px-6 py-3.5 text-sm font-bold text-white transition hover:border-[var(--grade-rare)] hover:bg-[var(--grade-rare)]/[0.05]"
              >
                CREATE PLAYER
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[9px] tracking-[0.2em] text-[var(--muted-dim)]">
              <span>PHYSICAL PRODUCT</span>
              <span>UNIQUE ITEM ID</span>
              <span>GRADE SYSTEM</span>
              <span>PLAYER COLLECTION</span>
            </div>
          </div>

          <div className="relative">
            <div className="hud-frame overflow-hidden p-5 sm:p-7" style={{ "--grade-color": "var(--grade-rare)" } as CSSProperties}>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <p className="font-mono text-[8px] tracking-[0.28em] text-[var(--muted-dim)]">
                    CRAFT RESULT PREVIEW
                  </p>
                  <p className="mt-2 text-xl font-black">SEASON DROP</p>
                </div>
                <span className="rounded-full border border-[var(--grade-rare)]/30 bg-[var(--grade-rare)]/[0.06] px-3 py-1.5 font-mono text-[8px] tracking-[0.2em] text-[var(--grade-rare)]">
                  READY
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {gradeCards.map((card) => (
                  <div
                    key={card.grade}
                    className="rounded-xl border bg-black/20 p-4"
                    style={{ borderColor: `color-mix(in srgb, ${card.color} 28%, transparent)` }}
                  >
                    <div className="h-1 w-10 rounded-full" style={{ background: card.color }} />
                    <p className="mt-5 text-sm font-black" style={{ color: card.color }}>
                      {card.grade}
                    </p>
                    <p className="mt-1 font-mono text-[8px] tracking-[0.16em] text-[var(--muted-dim)]">
                      {card.rate}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-[var(--border)] bg-black/25 p-5">
                <p className="font-mono text-[8px] tracking-[0.25em] text-[var(--muted-dim)]">
                  PLAYER LOOP
                </p>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] font-black sm:text-xs">
                  <span>CRAFT</span>
                  <span className="text-[var(--muted-dim)]">→</span>
                  <span>OWN</span>
                  <span className="text-[var(--grade-rare)]">LEVEL</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["01", "CRAFT YOUR DROP", "Choose a product and design, spend LT, then reveal the server-generated grade."],
            ["02", "BUILD COLLECTION", "Every crafted item receives its own identity and becomes part of your player collection."],
            ["03", "EQUIP & PROGRESS", "Use your loadout, grow LV/EXP, increase Collection Score and climb Global Rank."],
          ].map(([index, title, description]) => (
            <article key={index} className="hud-frame p-6" style={{ "--grade-color": "var(--grade-rare)" } as CSSProperties}>
              <p className="font-mono text-[9px] tracking-[0.24em] text-[var(--grade-rare)]">{index}</p>
              <h2 className="font-display mt-4 text-xl font-black">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
