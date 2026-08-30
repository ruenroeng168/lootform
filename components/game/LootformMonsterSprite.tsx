"use client";

/*
  Companion sprite to LootformHeroSprite -- same SVG/CSS renderer, same
  80x80 viewBox convention, same "grade family gets a theme + one
  extra distinguishing detail" language, but keyed on MonsterTier
  (SCOUT/GUARD/ELITE) instead of item Grade. Monsters have no loadout
  and no directional movement (they only ever appear inside
  CombatScene, facing the Hero), so this intentionally has no
  direction/moving props -- CombatScene's existing
  combat-monster-idle / combat-monster-attack wrapper classes (pure
  transform, content-agnostic) keep driving the attack-lunge timeline
  from outside; this component only owns its own continuous idle
  motion and tier theme.
*/

export type MonsterTier =
  | "SCOUT"
  | "GUARD"
  | "ELITE";

type LootformMonsterSpriteProps = {
  tier: MonsterTier;
  size?: number;
};

type TierTheme = {
  primary: string;
  secondary: string;
  glow: string;
};

function getTierTheme(
  tier: MonsterTier
): TierTheme {
  switch (tier) {
    case "ELITE":
      return {
        primary: "#f87171",
        secondary: "#fb923c",
        glow: "rgba(248,113,113,0.65)",
      };

    case "GUARD":
      return {
        primary: "#c084fc",
        secondary: "#a855f7",
        glow: "rgba(192,132,252,0.55)",
      };

    default:
      return {
        primary: "#a78bfa",
        secondary: "#818cf8",
        glow: "rgba(167,139,250,0.5)",
      };
  }
}

export default function LootformMonsterSprite({
  tier,
  size = 128,
}: LootformMonsterSpriteProps) {
  const theme =
    getTierTheme(
      tier
    );

  return (
    <div
      className={`
        lootform-monster
        lootform-monster-${tier.toLowerCase()}
        relative
        flex
        shrink-0
        select-none
        items-center
        justify-center
      `}
      style={{
        width: size,
        height: size,
      }}
    >

      {/* =============================================
          TIER AURA
      ============================================= */}

      <div
        className="absolute inset-[10%] rounded-full blur-[10px]"
        style={{
          background:
            theme.glow,

          opacity:
            0.5,
        }}
      />

      {/* =============================================
          SHADOW
      ============================================= */}

      <div className="absolute bottom-[2px] left-1/2 h-[7px] w-[54%] -translate-x-1/2 rounded-full bg-black/80 blur-[2px]" />

      {/* =============================================
          BODY
      ============================================= */}

      <div className="lootform-monster-body relative z-10 h-full w-full">

        <svg
          viewBox="0 0 80 80"
          width="100%"
          height="100%"
          role="img"
          aria-label={`${tier} monster`}
        >

          {tier === "SCOUT" && (
            <>

              {/* SENSOR PRONGS */}

              <path
                d="M40 20 L18 8 M40 20 L62 8 M40 52 L14 62 M40 52 L66 62"
                stroke={theme.secondary}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.7"
              />

              <circle cx="18" cy="8" r="2.4" fill={theme.secondary} />
              <circle cx="62" cy="8" r="2.4" fill={theme.secondary} />
              <circle cx="14" cy="62" r="2.4" fill={theme.secondary} />
              <circle cx="66" cy="62" r="2.4" fill={theme.secondary} />

              {/* CORE SHELL (diamond drone body) */}

              <path
                d="
                  M40 14
                  L58 36
                  L40 58
                  L22 36
                  Z
                "
                fill="#100a1f"
                stroke={theme.primary}
                strokeWidth="2.5"
              />

              <path
                d="
                  M40 22
                  L50 36
                  L40 50
                  L30 36
                  Z
                "
                fill="#1c1033"
                stroke={theme.secondary}
                strokeWidth="1.2"
                opacity="0.8"
              />

              {/* SCANNER EYE */}

              <circle
                cx="40"
                cy="36"
                r="7.5"
                fill={theme.primary}
              />

              <circle
                cx="40"
                cy="36"
                r="3"
                fill="#f5f3ff"
              />

            </>
          )}

          {tier === "GUARD" && (
            <>

              {/* LEG STRUTS */}

              <path
                d="M30 62 L27 74 L36 74 L37 62 Z"
                fill="#0b0714"
                stroke={theme.primary}
                strokeWidth="1.8"
              />

              <path
                d="M50 62 L53 74 L44 74 L43 62 Z"
                fill="#0b0714"
                stroke={theme.primary}
                strokeWidth="1.8"
              />

              {/* SHOULDER PLATES */}

              <path
                d="M14 34 L26 30 L26 48 L14 46 Z"
                fill="#161022"
                stroke={theme.secondary}
                strokeWidth="1.8"
              />

              <path
                d="M66 34 L54 30 L54 48 L66 46 Z"
                fill="#161022"
                stroke={theme.secondary}
                strokeWidth="1.8"
              />

              {/* TORSO */}

              <path
                d="
                  M26 26
                  Q26 20 34 20
                  L46 20
                  Q54 20 54 26
                  L54 60
                  L26 60
                  Z
                "
                fill="#0b0714"
                stroke={theme.primary}
                strokeWidth="2.5"
              />

              {/* CHEST PANEL LINES */}

              <path
                d="M31 44 L49 44 M31 51 L49 51"
                stroke={theme.secondary}
                strokeWidth="1.4"
                opacity="0.7"
              />

              {/* CORE LIGHT */}

              <circle
                cx="40"
                cy="34"
                r="6.5"
                fill={theme.primary}
              />

              <circle
                cx="40"
                cy="34"
                r="2.6"
                fill="#f5f3ff"
              />

              {/* HEAD / SENSOR BAR */}

              <path
                d="M31 14 L49 14 L47 20 L33 20 Z"
                fill="#161022"
                stroke={theme.secondary}
                strokeWidth="1.8"
              />

              <path
                d="M34 17 L46 17"
                stroke={theme.primary}
                strokeWidth="2"
                strokeLinecap="round"
              />

              <path
                d="M40 10 L40 14"
                stroke={theme.secondary}
                strokeWidth="2"
              />

              <circle cx="40" cy="9" r="2" fill={theme.primary} />

            </>
          )}

          {tier === "ELITE" && (
            <>

              {/* CORONA SPIKES */}

              <path
                d="
                  M40 40 L40 4
                  M40 40 L64 14
                  M40 40 L74 40
                  M40 40 L64 66
                  M40 40 L40 76
                  M40 40 L16 66
                  M40 40 L6 40
                  M40 40 L16 14
                "
                stroke={theme.secondary}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.55"
              />

              {/* VOID TENDRILS */}

              <path
                d="M22 30 Q6 32 8 48 Q14 44 24 40"
                fill={theme.primary}
                opacity="0.35"
              />

              <path
                d="M58 30 Q74 32 72 48 Q66 44 56 40"
                fill={theme.primary}
                opacity="0.35"
              />

              {/* MAIN BODY */}

              <path
                d="
                  M40 12
                  L60 30
                  L60 52
                  L40 68
                  L20 52
                  L20 30
                  Z
                "
                fill="#160309"
                stroke={theme.primary}
                strokeWidth="3"
              />

              <path
                d="
                  M40 24
                  L50 33
                  L50 49
                  L40 57
                  L30 49
                  L30 33
                  Z
                "
                fill="#2a0810"
                stroke={theme.secondary}
                strokeWidth="1.4"
                opacity="0.85"
              />

              {/* ELITE CORE EYE */}

              <circle
                cx="40"
                cy="40"
                r="10"
                fill={theme.primary}
              />

              <circle
                cx="40"
                cy="40"
                r="4.2"
                fill="#fff7ed"
              />

              {/* OUTER RING (elite-only signature detail) */}

              <circle
                cx="40"
                cy="40"
                r="17"
                fill="none"
                stroke={theme.secondary}
                strokeWidth="1.4"
                strokeDasharray="4 5"
                opacity="0.7"
                className="lootform-monster-elite-ring"
              />

            </>
          )}

        </svg>

      </div>

      <style jsx>{`

        .lootform-monster-body {
          animation:
            monster-float
            2.2s
            ease-in-out
            infinite;
        }

        .lootform-monster-guard
        .lootform-monster-body {
          animation-duration: 2.6s;
        }

        .lootform-monster-elite
        .lootform-monster-body {
          animation-duration: 1.8s;
        }

        .lootform-monster-elite-ring {
          transform-origin: 40px 40px;
          animation:
            monster-elite-ring-spin
            6s
            linear
            infinite;
        }

        @keyframes monster-float {

          0%,
          100% {
            transform:
              translateY(0);
          }

          50% {
            transform:
              translateY(-4px);
          }

        }

        @keyframes monster-elite-ring-spin {

          from {
            transform:
              rotate(0deg);
          }

          to {
            transform:
              rotate(360deg);
          }

        }

      `}</style>

    </div>
  );
}
