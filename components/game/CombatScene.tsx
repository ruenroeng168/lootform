"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import LootformHeroSprite, {
  type HeroGrade,
} from "@/components/game/LootformHeroSprite";

// =========================================================
// TYPES
// =========================================================

export type BattleRound = {
  round: number;

  heroDamage: number;

  monsterDamage: number;

  heroHpAfter: number;

  monsterHpAfter: number;
};

type MonsterTier =
  | "SCOUT"
  | "GUARD"
  | "ELITE";

type CombatSceneProps = {
  heroGrade: HeroGrade;

  heroStartHp: number;
  heroMaxHp: number;
  heroAtk: number;
  heroDef: number;

  monsterName: string;
  monsterTier: MonsterTier;

  monsterMaxHp: number;
  monsterAtk: number;
  monsterDef: number;

  rounds: BattleRound[];

  won: boolean;

  onComplete:
    () => void;
};

type BattleAction =
  | {
      type:
        "HERO_ATTACK";

      round: number;

      damage: number;

      monsterHp:
        number;

      heroHp:
        number;
    }
  | {
      type:
        "MONSTER_ATTACK";

      round: number;

      damage: number;

      monsterHp:
        number;

      heroHp:
        number;
    };

// =========================================================
// COMPONENT
// =========================================================

export default function CombatScene({
  heroGrade,

  heroStartHp,
  heroMaxHp,
  heroAtk,
  heroDef,

  monsterName,
  monsterTier,

  monsterMaxHp,
  monsterAtk,
  monsterDef,

  rounds,

  won,

  onComplete,
}: CombatSceneProps) {
  const [
    heroHp,
    setHeroHp,
  ] =
    useState(
      heroStartHp
    );

  const [
    monsterHp,
    setMonsterHp,
  ] =
    useState(
      monsterMaxHp
    );

  const [
    actionIndex,
    setActionIndex,
  ] =
    useState(
      -1
    );

  const [
    currentRound,
    setCurrentRound,
  ] =
    useState(
      0
    );

  const [
    attacker,
    setAttacker,
  ] =
    useState<
      "HERO"
      | "MONSTER"
      | null
    >(
      null
    );

  const [
    heroDamageText,
    setHeroDamageText,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    monsterDamageText,
    setMonsterDamageText,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    finished,
    setFinished,
  ] =
    useState(
      false
    );

  // =====================================================
  // MONSTER VISUAL
  // =====================================================

  const monsterVisual =
    monsterTier ===
    "ELITE"
      ? "👹"
      : monsterTier ===
        "GUARD"
      ? "👾"
      : "👾";

  // =====================================================
  // CREATE BATTLE TIMELINE
  // =====================================================

  const actions =
    useMemo<
      BattleAction[]
    >(
      () => {
        const result:
          BattleAction[] = [];

        let heroHpBefore =
          heroStartHp;

        let monsterHpBefore =
          monsterMaxHp;

        for (
          const round
          of rounds
        ) {
          result.push({
            type:
              "HERO_ATTACK",

            round:
              round.round,

            damage:
              round.heroDamage,

            heroHp:
              heroHpBefore,

            monsterHp:
              round.monsterHpAfter,
          });

          monsterHpBefore =
            round.monsterHpAfter;

          if (
            round.monsterDamage >
            0
          ) {
            result.push({
              type:
                "MONSTER_ATTACK",

              round:
                round.round,

              damage:
                round.monsterDamage,

              heroHp:
                round.heroHpAfter,

              monsterHp:
                monsterHpBefore,
            });
          }

          heroHpBefore =
            round.heroHpAfter;
        }

        return result;
      },
      [
        heroStartHp,
        monsterMaxHp,
        rounds,
      ]
    );

  // =====================================================
  // START BATTLE
  // =====================================================

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setActionIndex(
            0
          );
        },
        550
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, []);

  // =====================================================
  // PLAY ACTION
  // =====================================================

  useEffect(() => {
    if (
      actionIndex <
      0
    ) {
      return;
    }

    if (
      actionIndex >=
      actions.length
    ) {
      setAttacker(
        null
      );

      const finishTimer =
        window.setTimeout(
          () => {
            setFinished(
              true
            );
          },
          500
        );

      return () => {
        window.clearTimeout(
          finishTimer
        );
      };
    }

    const action =
      actions[
        actionIndex
      ];

    setCurrentRound(
      action.round
    );

    setHeroDamageText(
      null
    );

    setMonsterDamageText(
      null
    );

    if (
      action.type ===
      "HERO_ATTACK"
    ) {
      setAttacker(
        "HERO"
      );

      setMonsterHp(
        action.monsterHp
      );

      setMonsterDamageText(
        `-${action.damage}`
      );
    } else {
      setAttacker(
        "MONSTER"
      );

      setHeroHp(
        action.heroHp
      );

      setHeroDamageText(
        `-${action.damage}`
      );
    }

    const clearDamage =
      window.setTimeout(
        () => {
          setHeroDamageText(
            null
          );

          setMonsterDamageText(
            null
          );
        },
        360
      );

    const nextAction =
      window.setTimeout(
        () => {
          setActionIndex(
            (
              current
            ) =>
              current +
              1
          );
        },
        650
      );

    return () => {
      window.clearTimeout(
        clearDamage
      );

      window.clearTimeout(
        nextAction
      );
    };
  }, [
    actionIndex,
    actions,
  ]);

  // =====================================================
  // PERCENT
  // =====================================================

  const heroHpPercent =
    Math.max(
      0,
      Math.min(
        100,
        heroHp /
          heroMaxHp *
          100
      )
    );

  const monsterHpPercent =
    Math.max(
      0,
      Math.min(
        100,
        monsterHp /
          monsterMaxHp *
          100
      )
    );

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center overflow-hidden rounded-[28px] bg-black/95 p-5 backdrop-blur-xl">

      {/* BACKGROUND */}

      <div className="pointer-events-none absolute inset-0">

        <div className="absolute left-[18%] top-1/2 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-cyan-400/[0.08] blur-[110px]" />

        <div
          className={`
            absolute
            right-[18%]
            top-1/2
            h-[300px]
            w-[300px]
            -translate-y-1/2
            rounded-full
            blur-[110px]

            ${
              monsterTier ===
              "ELITE"
                ? "bg-red-500/[0.12]"
                : "bg-purple-500/[0.10]"
            }
          `}
        />

      </div>

      <div className="relative z-10 w-full max-w-[900px]">

        {/* HEADER */}

        <div className="text-center">

          <p className="text-[8px] font-black tracking-[0.32em] text-red-400">
            AUTO BATTLE ENGAGED
          </p>

          <h2 className="mt-2 text-3xl font-black sm:text-4xl">
            LOOT HERO{" "}

            <span className="text-zinc-600">
              VS
            </span>{" "}

            <span
              className={
                monsterTier ===
                "ELITE"
                  ? "text-red-400"
                  : "text-purple-400"
              }
            >
              {monsterName}
            </span>
          </h2>

          {!finished && (
            <p className="mt-2 text-[8px] font-black tracking-[0.2em] text-zinc-600">
              ROUND{" "}
              {Math.max(
                1,
                currentRound
              )}
            </p>
          )}

        </div>

        {/* =============================================
            BATTLE STAGE
        ============================================= */}

        <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">

          {/* =========================================
              HERO
          ========================================= */}

          <div className="relative">

            <div
              className={`
                relative
                mx-auto
                flex
                h-[170px]
                w-full
                max-w-[260px]
                items-center
                justify-center
                rounded-[26px]
                border
                bg-cyan-400/[0.03]
                transition-all
                duration-150

                ${
                  attacker ===
                  "HERO"
                    ? "translate-x-4 border-cyan-300 shadow-[0_0_40px_rgba(34,211,238,0.20)]"
                    : attacker ===
                      "MONSTER"
                    ? "-translate-x-2 border-red-400/40"
                    : "border-cyan-400/20"
                }
              `}
            >

              <LootformHeroSprite
                size={
                  128
                }
                grade={
                  heroGrade
                }
                direction="RIGHT"
                moving={
                  attacker ===
                  "HERO"
                }
              />

              {heroDamageText && (
                <div className="combat-damage absolute right-[8%] top-[20%] text-3xl font-black text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,1)]">
                  {heroDamageText}
                </div>
              )}

            </div>

            <div className="mx-auto mt-4 max-w-[260px]">

              <div className="flex items-end justify-between gap-3">

                <div>

                  <p className="text-[6px] tracking-[0.18em] text-cyan-400">
                    PLAYER
                  </p>

                  <p className="mt-1 text-sm font-black">
                    LOOT HERO
                  </p>

                </div>

                <p className="text-[9px] font-black text-white">
                  {heroHp} / {heroMaxHp}
                </p>

              </div>

              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-900">

                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{
                    width:
                      `${heroHpPercent}%`,
                  }}
                />

              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">

                <CombatStat
                  label="ATK"
                  value={
                    heroAtk
                  }
                  className="text-orange-400"
                />

                <CombatStat
                  label="DEF"
                  value={
                    heroDef
                  }
                  className="text-cyan-400"
                />

              </div>

            </div>

          </div>

          {/* =========================================
              VS
          ========================================= */}

          <div className="flex flex-col items-center justify-center">

            <div
              className={`
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                border
                text-sm
                font-black

                ${
                  finished
                    ? won
                      ? "border-lime-400/40 bg-lime-400/10 text-lime-400"
                      : "border-red-400/40 bg-red-400/10 text-red-400"
                    : "border-zinc-700 bg-black text-zinc-500"
                }
              `}
            >
              VS
            </div>

          </div>

          {/* =========================================
              MONSTER
          ========================================= */}

          <div className="relative">

            <div
              className={`
                relative
                mx-auto
                flex
                h-[170px]
                w-full
                max-w-[260px]
                items-center
                justify-center
                rounded-[26px]
                border
                transition-all
                duration-150

                ${
                  monsterTier ===
                  "ELITE"
                    ? "bg-red-500/[0.04]"
                    : "bg-purple-500/[0.04]"
                }

                ${
                  attacker ===
                  "MONSTER"
                    ? "-translate-x-4 border-red-400 shadow-[0_0_40px_rgba(248,113,113,0.18)]"
                    : attacker ===
                      "HERO"
                    ? "translate-x-2 border-cyan-400/50"
                    : monsterTier ===
                      "ELITE"
                    ? "border-red-400/25"
                    : "border-purple-400/25"
                }
              `}
            >

              <div
                className={`
                  absolute
                  h-28
                  w-28
                  rounded-full
                  blur-[30px]

                  ${
                    monsterTier ===
                    "ELITE"
                      ? "bg-red-500/25"
                      : "bg-purple-500/25"
                  }
                `}
              />

              <span
                className={`
                  relative
                  z-10
                  select-none
                  text-[100px]
                  leading-none

                  ${
                    attacker ===
                    "MONSTER"
                      ? "combat-monster-attack"
                      : "combat-monster-idle"
                  }
                `}
              >
                {monsterVisual}
              </span>

              {monsterDamageText && (
                <div className="combat-damage absolute left-[8%] top-[20%] text-3xl font-black text-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,1)]">
                  {monsterDamageText}
                </div>
              )}

            </div>

            <div className="mx-auto mt-4 max-w-[260px]">

              <div className="flex items-end justify-between gap-3">

                <div>

                  <p
                    className={`
                      text-[6px]
                      tracking-[0.18em]

                      ${
                        monsterTier ===
                        "ELITE"
                          ? "text-red-400"
                          : "text-purple-400"
                      }
                    `}
                  >
                    {monsterTier}
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {monsterName}
                  </p>

                </div>

                <p className="text-[9px] font-black text-white">
                  {monsterHp} / {monsterMaxHp}
                </p>

              </div>

              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-900">

                <div
                  className={
                    monsterTier ===
                    "ELITE"
                      ? "h-full bg-red-400 transition-all duration-300"
                      : "h-full bg-purple-400 transition-all duration-300"
                  }
                  style={{
                    width:
                      `${monsterHpPercent}%`,
                  }}
                />

              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">

                <CombatStat
                  label="ATK"
                  value={
                    monsterAtk
                  }
                  className="text-red-400"
                />

                <CombatStat
                  label="DEF"
                  value={
                    monsterDef
                  }
                  className="text-purple-400"
                />

              </div>

            </div>

          </div>

        </div>

        {/* =============================================
            RESULT
        ============================================= */}

        <div className="mt-8 min-h-[100px]">

          {!finished ? (
            <div className="text-center">

              <div className="mx-auto h-[1px] max-w-sm bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

              <p className="mt-4 animate-pulse text-[8px] font-black tracking-[0.28em] text-zinc-500">
                RESOLVING COMBAT...
              </p>

            </div>
          ) : (
            <div className="combat-result text-center">

              <p
                className={`
                  text-[9px]
                  font-black
                  tracking-[0.3em]

                  ${
                    won
                      ? "text-lime-400"
                      : "text-red-400"
                  }
                `}
              >
                COMBAT RESULT
              </p>

              <h3
                className={`
                  mt-2
                  text-4xl
                  font-black

                  ${
                    won
                      ? "text-white"
                      : "text-red-400"
                  }
                `}
              >
                {won
                  ? "VICTORY"
                  : "DEFEATED"}
              </h3>

              <p className="mt-2 text-[8px] text-zinc-600">
                {rounds.length} BATTLE ROUNDS RESOLVED
              </p>

              <button
                type="button"
                onClick={
                  onComplete
                }
                className={`
                  mt-6
                  rounded-xl
                  px-9
                  py-3
                  text-[10px]
                  font-black
                  transition

                  ${
                    won
                      ? "bg-lime-400 text-black hover:bg-lime-300"
                      : "bg-red-400 text-black hover:bg-red-300"
                  }
                `}
              >
                {won
                  ? "RETURN TO MAP"
                  : "VIEW RESULT"}
              </button>

            </div>
          )}

        </div>

      </div>

      <style jsx>{`

        .combat-damage {
          animation:
            combatDamage
            360ms
            ease-out;
        }

        .combat-monster-idle {
          animation:
            monsterIdle
            1.1s
            ease-in-out
            infinite;
        }

        .combat-monster-attack {
          animation:
            monsterAttack
            300ms
            ease-out;
        }

        .combat-result {
          animation:
            combatResult
            350ms
            ease-out;
        }

        @keyframes combatDamage {

          0% {
            opacity: 0;
            transform:
              translateY(8px)
              scale(0.6);
          }

          35% {
            opacity: 1;
            transform:
              translateY(-8px)
              scale(1.2);
          }

          100% {
            opacity: 0;
            transform:
              translateY(-20px)
              scale(1);
          }

        }

        @keyframes monsterIdle {

          0%,
          100% {
            transform:
              translateY(0);
          }

          50% {
            transform:
              translateY(-5px);
          }

        }

        @keyframes monsterAttack {

          0% {
            transform:
              translateX(0)
              scale(1);
          }

          50% {
            transform:
              translateX(-18px)
              scale(1.12);
          }

          100% {
            transform:
              translateX(0)
              scale(1);
          }

        }

        @keyframes combatResult {

          0% {
            opacity: 0;
            transform:
              translateY(12px)
              scale(0.96);
          }

          100% {
            opacity: 1;
            transform:
              translateY(0)
              scale(1);
          }

        }

      `}</style>

    </div>
  );
}

// =========================================================
// STAT
// =========================================================

function CombatStat({
  label,
  value,
  className,
}: {
  label: string;

  value: number;

  className: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/50 p-2">

      <p className="text-[5px] tracking-[0.15em] text-zinc-600">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-black ${className}`}
      >
        {value}
      </p>

    </div>
  );
}