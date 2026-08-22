"use client";

export type HeroDirection =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT";

export type HeroGrade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type LootformHeroSpriteProps = {
  direction?: HeroDirection;
  moving?: boolean;
  grade?: HeroGrade;
  size?: number;
};

type GradeTheme = {
  primary: string;
  secondary: string;
  glow: string;
};

function getGradeTheme(
  grade: HeroGrade
): GradeTheme {
  switch (grade) {
    case "LEGENDARY":
      return {
        primary: "#fb923c",
        secondary: "#facc15",
        glow: "rgba(251,146,60,0.65)",
      };

    case "EPIC":
      return {
        primary: "#c084fc",
        secondary: "#a855f7",
        glow: "rgba(168,85,247,0.60)",
      };

    case "RARE":
      return {
        primary: "#22d3ee",
        secondary: "#38bdf8",
        glow: "rgba(34,211,238,0.60)",
      };

    default:
      return {
        primary: "#d4d4d8",
        secondary: "#71717a",
        glow: "rgba(212,212,216,0.35)",
      };
  }
}

export default function LootformHeroSprite({
  direction = "DOWN",
  moving = false,
  grade = "COMMON",
  size = 48,
}: LootformHeroSpriteProps) {
  const theme =
    getGradeTheme(
      grade
    );

  const facingLeft =
    direction ===
    "LEFT";

  const facingUp =
    direction ===
    "UP";

  return (
    <div
      className={`
        lootform-hero
        relative
        flex
        shrink-0
        select-none
        items-center
        justify-center

        ${
          moving
            ? "lootform-hero-moving"
            : ""
        }
      `}
      style={{
        width: size,
        height: size,
      }}
    >

      {/* =============================================
          GRADE AURA
      ============================================= */}

      <div
        className="absolute inset-[7%] rounded-full blur-[8px]"
        style={{
          background:
            theme.glow,

          opacity:
            moving
              ? 0.95
              : 0.55,
        }}
      />

      <div
        className="absolute inset-[3%] rounded-full border"
        style={{
          borderColor:
            `${theme.primary}75`,

          boxShadow:
            `0 0 15px ${theme.glow}`,
        }}
      />

      {/* =============================================
          SHADOW
      ============================================= */}

      <div className="absolute bottom-[3px] left-1/2 h-[6px] w-[58%] -translate-x-1/2 rounded-full bg-black/80 blur-[2px]" />

      {/* =============================================
          CHARACTER
      ============================================= */}

      <div
        className="relative z-10 h-full w-full"
        style={{
          transform:
            facingLeft
              ? "scaleX(-1)"
              : "scaleX(1)",
        }}
      >

        <svg
          viewBox="0 0 80 80"
          width="100%"
          height="100%"
          role="img"
          aria-label="LOOTFORM Hero"
        >

          {/* =========================================
              ENERGY WINGS
          ========================================= */}

          <path
            d="
              M21 38
              L8 30
              L13 40
              L6 49
              L22 45
              Z
            "
            fill={theme.secondary}
            opacity="0.55"
          />

          <path
            d="
              M59 38
              L72 30
              L67 40
              L74 49
              L58 45
              Z
            "
            fill={theme.secondary}
            opacity="0.55"
          />

          {/* =========================================
              LEFT LEG
          ========================================= */}

          <g className="hero-leg-left">

            <path
              d="
                M29 53
                L38 53
                L36 68
                L26 68
                Z
              "
              fill="#111827"
              stroke="#334155"
              strokeWidth="1.5"
            />

            <path
              d="
                M25 66
                L36 66
                L35 74
                L21 74
                Q21 69 25 66
                Z
              "
              fill="#020617"
              stroke={theme.primary}
              strokeWidth="2"
            />

            <path
              d="M23 71 L34 71"
              stroke="#22d3ee"
              strokeWidth="2.4"
              strokeLinecap="round"
            />

          </g>

          {/* =========================================
              RIGHT LEG
          ========================================= */}

          <g className="hero-leg-right">

            <path
              d="
                M42 53
                L51 53
                L54 68
                L44 68
                Z
              "
              fill="#111827"
              stroke="#334155"
              strokeWidth="1.5"
            />

            <path
              d="
                M44 66
                L55 66
                Q60 69 60 74
                L44 74
                Z
              "
              fill="#020617"
              stroke={theme.primary}
              strokeWidth="2"
            />

            <path
              d="M46 71 L57 71"
              stroke="#22d3ee"
              strokeWidth="2.4"
              strokeLinecap="round"
            />

          </g>

          {/* =========================================
              BODY / TECH JACKET
          ========================================= */}

          <path
            d="
              M26 34
              Q29 28 35 27
              L45 27
              Q51 28 54 34
              L53 57
              L27 57
              Z
            "
            fill="#09090b"
            stroke={theme.primary}
            strokeWidth="2"
          />

          {/* LEFT JACKET PANEL */}

          <path
            d="
              M28 36
              L38 39
              L38 54
              L28 51
              Z
            "
            fill="#111827"
          />

          {/* RIGHT JACKET PANEL */}

          <path
            d="
              M52 36
              L42 39
              L42 54
              L52 51
              Z
            "
            fill="#111827"
          />

          {/* ZIPPER */}

          <path
            d="M40 31 L40 55"
            stroke="#52525b"
            strokeWidth="1.5"
          />

          {/* LOOTFORM CHEST LOGO */}

          <path
            d="
              M34 37
              L40 33
              L46 37
              L40 43
              Z
            "
            fill={theme.primary}
          />

          <path
            d="
              M37 37
              L40 35
              L43 37
              L40 40
              Z
            "
            fill="#020617"
          />

          {/* TECH STRIPS */}

          <path
            d="M29 48 L37 51"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeLinecap="round"
          />

          <path
            d="M51 48 L43 51"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* =========================================
              LEFT ARM
          ========================================= */}

          <g className="hero-arm-left">

            <path
              d="
                M27 34
                L19 38
                L17 52
                L25 53
                L31 40
                Z
              "
              fill="#09090b"
              stroke="#334155"
              strokeWidth="1.5"
            />

            <circle
              cx="18"
              cy="54"
              r="4"
              fill="#020617"
              stroke={theme.primary}
              strokeWidth="2"
            />

            <path
              d="M14 54 L7 54"
              stroke="#22d3ee"
              strokeWidth="3"
              strokeLinecap="round"
            />

          </g>

          {/* =========================================
              RIGHT ARM
          ========================================= */}

          <g className="hero-arm-right">

            <path
              d="
                M53 34
                L61 38
                L63 52
                L55 53
                L49 40
                Z
              "
              fill="#09090b"
              stroke="#334155"
              strokeWidth="1.5"
            />

            <circle
              cx="62"
              cy="54"
              r="4"
              fill="#020617"
              stroke={theme.primary}
              strokeWidth="2"
            />

            <path
              d="M66 54 L73 54"
              stroke="#22d3ee"
              strokeWidth="3"
              strokeLinecap="round"
            />

          </g>

          {/* =========================================
              NECK
          ========================================= */}

          <path
            d="
              M35 28
              L36 23
              L44 23
              L45 28
              Z
            "
            fill="#efb995"
          />

          {/* =========================================
              HEAD
          ========================================= */}

          <ellipse
            cx="40"
            cy="18"
            rx="12"
            ry="11"
            fill="#f1c09f"
            stroke="#18181b"
            strokeWidth="1.5"
          />

          {/* =========================================
              SILVER CYBER HAIR
          ========================================= */}

          <path
            d="
              M27 19
              Q25 9 34 6
              L33 1
              L39 6
              L45 1
              L45 6
              L54 3
              L50 10
              Q55 14 52 21
              L47 15
              L44 20
              L40 13
              L36 19
              L32 13
              L29 22
              Z
            "
            fill="#e4e4e7"
            stroke="#71717a"
            strokeWidth="1.5"
          />

          <path
            d="M32 8 L37 4"
            stroke="white"
            strokeWidth="2"
          />

          <path
            d="M41 8 L47 4"
            stroke="white"
            strokeWidth="2"
          />

          {/* =========================================
              FACE
          ========================================= */}

          {!facingUp && (
            <>

              <path
                d="M32 18 Q35 15 37 18"
                fill="none"
                stroke="#18181b"
                strokeWidth="1.5"
              />

              <path
                d="M43 18 Q46 15 48 18"
                fill="none"
                stroke="#18181b"
                strokeWidth="1.5"
              />

              <circle
                cx="35"
                cy="18"
                r="1.6"
                fill="#22d3ee"
              />

              <circle
                cx="46"
                cy="18"
                r="1.6"
                fill="#22d3ee"
              />

              <path
                d="M37 23 Q40 25 43 23"
                fill="none"
                stroke="#92400e"
                strokeWidth="1"
              />

            </>
          )}

          {/* =========================================
              HOOD
          ========================================= */}

          <path
            d="
              M29 31
              Q40 23 51 31
            "
            fill="none"
            stroke={theme.primary}
            strokeWidth="3"
          />

          {/* =========================================
              ENERGY CORE
          ========================================= */}

          <circle
            cx="40"
            cy="46"
            r="4"
            fill={theme.primary}
            opacity="0.8"
          />

          <circle
            cx="40"
            cy="46"
            r="1.7"
            fill="white"
          />

        </svg>

      </div>

      {/* =============================================
          DIRECTION INDICATOR
      ============================================= */}

      <span
        className={`
          absolute
          z-30
          text-[7px]
          font-black
          text-cyan-300
          drop-shadow-[0_0_6px_rgba(34,211,238,1)]

          ${
            direction ===
            "UP"
              ? "-top-[5px] left-1/2 -translate-x-1/2"
              : direction ===
                "DOWN"
              ? "-bottom-[5px] left-1/2 -translate-x-1/2 rotate-180"
              : direction ===
                "LEFT"
              ? "left-[-4px] top-1/2 -translate-y-1/2 -rotate-90"
              : "right-[-4px] top-1/2 -translate-y-1/2 rotate-90"
          }
        `}
      >
        ▲
      </span>

      {/* =============================================
          LEGENDARY SPARK
      ============================================= */}

      {grade ===
        "LEGENDARY" && (
        <>

          <span className="lootform-spark absolute right-[5%] top-[4%] text-[7px] text-yellow-300">
            ✦
          </span>

          <span className="lootform-spark lootform-spark-delay absolute bottom-[20%] left-[3%] text-[5px] text-orange-300">
            ✦
          </span>

        </>
      )}

      <style jsx>{`

        .lootform-hero {
          transform-origin:
            center bottom;
        }

        .lootform-hero-moving {
          animation:
            hero-bob
            180ms
            ease-in-out;
        }

        .lootform-hero-moving
        .hero-leg-left {
          transform-origin:
            33px 55px;

          animation:
            hero-leg-left
            180ms
            ease-in-out;
        }

        .lootform-hero-moving
        .hero-leg-right {
          transform-origin:
            48px 55px;

          animation:
            hero-leg-right
            180ms
            ease-in-out;
        }

        .lootform-hero-moving
        .hero-arm-left {
          transform-origin:
            28px 36px;

          animation:
            hero-arm-left
            180ms
            ease-in-out;
        }

        .lootform-hero-moving
        .hero-arm-right {
          transform-origin:
            52px 36px;

          animation:
            hero-arm-right
            180ms
            ease-in-out;
        }

        .lootform-spark {
          animation:
            hero-spark
            1.1s
            ease-in-out
            infinite;
        }

        .lootform-spark-delay {
          animation-delay:
            0.55s;
        }

        @keyframes hero-bob {

          0% {
            transform:
              translateY(0)
              scale(1);
          }

          50% {
            transform:
              translateY(-4px)
              scale(1.04);
          }

          100% {
            transform:
              translateY(0)
              scale(1);
          }

        }

        @keyframes hero-leg-left {

          0% {
            transform:
              rotate(0deg);
          }

          50% {
            transform:
              rotate(11deg);
          }

          100% {
            transform:
              rotate(0deg);
          }

        }

        @keyframes hero-leg-right {

          0% {
            transform:
              rotate(0deg);
          }

          50% {
            transform:
              rotate(-11deg);
          }

          100% {
            transform:
              rotate(0deg);
          }

        }

        @keyframes hero-arm-left {

          0% {
            transform:
              rotate(0deg);
          }

          50% {
            transform:
              rotate(-10deg);
          }

          100% {
            transform:
              rotate(0deg);
          }

        }

        @keyframes hero-arm-right {

          0% {
            transform:
              rotate(0deg);
          }

          50% {
            transform:
              rotate(10deg);
          }

          100% {
            transform:
              rotate(0deg);
          }

        }

        @keyframes hero-spark {

          0%,
          100% {
            opacity:
              0.25;

            transform:
              scale(0.7)
              rotate(0deg);
          }

          50% {
            opacity:
              1;

            transform:
              scale(1.3)
              rotate(90deg);
          }

        }

      `}</style>

    </div>
  );
}