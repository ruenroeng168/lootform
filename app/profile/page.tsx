"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Image from "next/image";

import Navbar from "@/components/Navbar";
import CharacterAvatar from "@/components/CharacterAvatar";

import {
  supabase,
} from "@/lib/supabase";

// =====================================
// TYPES
// =====================================

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type PlayerProfile = {
  user_id: string;

  display_name:
    string | null;

  level: number;

  exp: number;

  title: string;

  avatar_key: string;

  equipped_item_id:
    number | null;

  created_at: string;

  updated_at: string;
};

type PlayerCharacterModel = {
  model_url: string | null;
};

type EquippedItem = {
  id: number;

  serial: string;

  product: string;

  season: string;

  grade: Grade;

  level: number;

  size:
    string | null;

  production_status:
    string;

  created_at: string;
};

// =====================================
// CONFIG
// =====================================

const productImages: Record<
  Grade,
  string
> = {
  COMMON:
    "/products/common.png",

  RARE:
    "/products/rare.png",

  EPIC:
    "/products/epic.png",

  LEGENDARY:
    "/products/legendary.png",
};

const gradeText: Record<
  Grade,
  string
> = {
  COMMON:
    "text-zinc-200",

  RARE:
    "text-cyan-400",

  EPIC:
    "text-purple-400",

  LEGENDARY:
    "text-orange-400",
};

const gradeBorder: Record<
  Grade,
  string
> = {
  COMMON:
    "border-zinc-700",

  RARE:
    "border-cyan-400/40",

  EPIC:
    "border-purple-400/40",

  LEGENDARY:
    "border-orange-400/40",
};

const gradeGlow: Record<
  Grade,
  string
> = {
  COMMON:
    "shadow-[0_0_80px_rgba(161,161,170,0.10)]",

  RARE:
    "shadow-[0_0_90px_rgba(34,211,238,0.18)]",

  EPIC:
    "shadow-[0_0_100px_rgba(192,132,252,0.22)]",

  LEGENDARY:
    "shadow-[0_0_120px_rgba(251,146,60,0.28)]",
};

// =====================================
// PAGE
// =====================================

export default function ProfilePage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    profile,
    setProfile,
  ] =
    useState<
      PlayerProfile | null
    >(null);

  const [
    equippedItem,
    setEquippedItem,
  ] =
    useState<
      EquippedItem | null
    >(null);

  const [
    collectionCount,
    setCollectionCount,
  ] =
    useState(0);

  const [
    playerCharacter,
    setPlayerCharacter,
  ] =
    useState<
      PlayerCharacterModel | null
    >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  // =====================================
  // LOAD PROFILE
  // =====================================

  async function loadProfile() {
    setLoading(true);

    setErrorMessage("");

    try {
      // =====================================
      // USER
      // =====================================

      const {
        data: {
          user,
        },

        error:
          userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        router.push(
          "/login"
        );

        return;
      }

      setEmail(
        user.email ??
          "PLAYER"
      );

      // =====================================
      // PLAYER CHARACTER (3D MODEL)
      // =====================================

      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (session) {
        try {
          const characterResponse =
            await fetch(
              "/api/profile/character",
              {
                method: "GET",

                headers: {
                  Authorization:
                    `Bearer ${session.access_token}`,
                },

                cache: "no-store",
              }
            );

          const characterResult =
            await characterResponse.json();

          if (
            characterResponse.ok &&
            characterResult?.ok
          ) {
            setPlayerCharacter(
              characterResult.character ??
                null
            );
          }
        } catch (characterError) {
          console.error(
            "PROFILE CHARACTER ERROR:",
            characterError
          );
        }
      }

      // =====================================
      // PROFILE
      // =====================================

      const {
        data:
          profileData,

        error:
          profileError,
      } =
        await supabase
          .from(
            "player_profiles"
          )
          .select(`
            user_id,
            display_name,
            level,
            exp,
            title,
            avatar_key,
            equipped_item_id,
            created_at,
            updated_at
          `)
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (
        profileError
      ) {
        throw profileError;
      }

      if (
        !profileData
      ) {
        throw new Error(
          "PLAYER_PROFILE_NOT_FOUND"
        );
      }

      const safeProfile =
        profileData as PlayerProfile;

      setProfile(
        safeProfile
      );

      // =====================================
      // COLLECTION COUNT
      // =====================================

      const {
        count,
        error:
          collectionError,
      } =
        await supabase
          .from(
            "items"
          )
          .select(
            "id",
            {
              count: "exact",
              head: true,
            }
          )
          .eq(
            "owner_id",
            user.id
          );

      if (
        collectionError
      ) {
        throw collectionError;
      }

      setCollectionCount(
        count ?? 0
      );

      // =====================================
      // EQUIPPED ITEM
      // =====================================

      if (
        safeProfile
          .equipped_item_id
      ) {
        const {
          data:
            itemData,

          error:
            itemError,
        } =
          await supabase
            .from(
              "items"
            )
            .select(`
              id,
              serial,
              product,
              season,
              grade,
              level,
              size,
              production_status,
              created_at
            `)
            .eq(
              "id",
              safeProfile
                .equipped_item_id
            )
            .eq(
              "owner_id",
              user.id
            )
            .maybeSingle();

        if (
          itemError
        ) {
          throw itemError;
        }

        setEquippedItem(
          itemData as
            EquippedItem | null
        );
      } else {
        setEquippedItem(
          null
        );
      }
    } catch (error) {
      console.error(
        "PROFILE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to load profile"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================
  // LOAD
  // =====================================

  useEffect(() => {
    loadProfile();
  }, []);

  // =====================================
  // EXP SYSTEM V1
  //
  // Every level currently needs:
  // level * 1000 EXP
  //
  // Later we can move this to server rules.
  // =====================================

  const expNeeded =
    useMemo(() => {
      if (!profile) {
        return 1000;
      }

      return Math.max(
        1000,
        profile.level *
          1000
      );
    }, [profile]);

  const expPercent =
    useMemo(() => {
      if (!profile) {
        return 0;
      }

      return Math.min(
        100,
        Math.max(
          0,
          (profile.exp /
            expNeeded) *
            100
        )
      );
    }, [
      profile,
      expNeeded,
    ]);

  // =====================================
  // ACTIVE GRADE
  // =====================================

  const activeGrade:
    Grade =
      equippedItem?.grade ??
      "COMMON";

  // =====================================
  // LOADING
  // =====================================

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex flex-col items-center justify-center">

          <div className="w-16 h-16 border-2 border-zinc-800 border-t-cyan-400 rounded-full animate-spin" />

          <p className="text-cyan-400 tracking-[0.35em] mt-6 animate-pulse">
            LOADING PLAYER...
          </p>

        </div>

      </main>
    );
  }

  // =====================================
  // ERROR
  // =====================================

  if (
    !profile
  ) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="max-w-4xl mx-auto px-6 py-12">

          <div className="border border-red-400/30 bg-red-400/[0.06] text-red-400 rounded-2xl p-6">

            {errorMessage ||
              "Unable to load player profile"}

          </div>

          <button
            onClick={
              loadProfile
            }
            className="mt-5 border border-zinc-800 px-5 py-3 rounded-xl"
          >
            RETRY
          </button>

        </div>

      </main>
    );
  }

  // =====================================
  // PAGE
  // =====================================

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">

      <Navbar />

      {/* =====================================
          BACKGROUND
      ===================================== */}

      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        <div className="absolute top-[-350px] left-1/2 -translate-x-1/2 w-[1000px] h-[900px] rounded-full bg-cyan-400/[0.06] blur-[190px]" />

        <div className="absolute bottom-[-350px] left-[-250px] w-[700px] h-[700px] rounded-full bg-purple-500/[0.07] blur-[180px]" />

        <div className="absolute bottom-[-350px] right-[-250px] w-[700px] h-[700px] rounded-full bg-orange-400/[0.06] blur-[180px]" />

      </div>

      {/* =====================================
          CONTENT
      ===================================== */}

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-9">

        {/* =====================================
            HEADER
        ===================================== */}

        <section className="flex items-end justify-between gap-5 flex-wrap">

          <div>

            <p className="text-cyan-400 text-[9px] tracking-[0.35em]">
              LOOTFORM PLAYER SYSTEM
            </p>

            <h1 className="text-5xl sm:text-7xl font-black mt-3">
              MY{" "}

              <span className="text-cyan-400">
                CHARACTER
              </span>
            </h1>

            <p className="text-zinc-600 text-sm mt-4">
              DIGITAL IDENTITY // PHYSICAL COLLECTION
            </p>

          </div>

          <button
            onClick={
              loadProfile
            }
            className="border border-zinc-800 bg-zinc-950 px-5 py-3 rounded-xl text-xs font-black hover:border-cyan-400 hover:text-cyan-400 transition"
          >
            REFRESH
          </button>

        </section>

        {/* =====================================
            ERROR
        ===================================== */}

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.06] text-red-400 rounded-xl p-5">

            {errorMessage}

          </div>
        )}

        {/* =====================================
            MAIN
        ===================================== */}

        <section className="grid xl:grid-cols-[1.05fr_0.95fr] gap-6 mt-8">

          {/* =====================================
              CHARACTER CHAMBER
          ===================================== */}

          <div
            className={`
              relative
              overflow-hidden
              min-h-[720px]
              border
              rounded-[32px]
              bg-zinc-950/85
              p-6
              sm:p-8

              ${gradeBorder[
                activeGrade
              ]}

              ${gradeGlow[
                activeGrade
              ]}
            `}
          >

            {/* GRID */}

            <div className="absolute inset-0 character-grid opacity-[0.05] pointer-events-none" />

            {/* AURA */}

            <div
              className={`
                absolute
                left-1/2
                top-[52%]
                -translate-x-1/2
                -translate-y-1/2
                w-[430px]
                h-[430px]
                rounded-full
                blur-[90px]

                ${
                  activeGrade ===
                  "COMMON"
                    ? "bg-zinc-400/10"
                    : activeGrade ===
                      "RARE"
                    ? "bg-cyan-400/15"
                    : activeGrade ===
                      "EPIC"
                    ? "bg-purple-400/20"
                    : "bg-orange-400/25"
                }
              `}
            />

            {/* HEADER */}

            <div className="relative z-10 flex items-start justify-between gap-5">

              <div>

                <p className="text-cyan-400 text-[9px] tracking-[0.3em]">
                  PLAYER CHARACTER
                </p>

                <h2 className="text-3xl sm:text-4xl font-black mt-2">
                  {profile.display_name ||
                    "PLAYER"}
                </h2>

                <p className="text-zinc-600 text-xs mt-2">
                  {email}
                </p>

              </div>

              <div className="text-right">

                <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                  TITLE
                </p>

                <p className="text-lime-400 text-sm font-black mt-2">
                  {profile.title}
                </p>

              </div>

            </div>

            {/* =====================================
                CHARACTER
            ===================================== */}

            <div className="relative z-10 h-[480px] mt-6">

              <CharacterAvatar
                grade={
                  activeGrade
                }
                modelUrl={
                  playerCharacter?.model_url
                }
              />

            </div>

            {/* =====================================
                LEVEL
            ===================================== */}

            <div className="relative z-10">

              <div className="flex items-end justify-between gap-4">

                <div>

                  <p className="text-zinc-600 text-[8px] tracking-[0.25em]">
                    PLAYER LEVEL
                  </p>

                  <p className="text-white text-4xl font-black mt-2">
                    LV.
                    {String(
                      profile.level
                    ).padStart(
                      2,
                      "0"
                    )}
                  </p>

                </div>

                <p className="text-cyan-400 text-sm font-black">
                  {profile.exp.toLocaleString()}
                  {" / "}
                  {expNeeded.toLocaleString()}
                  {" EXP"}
                </p>

              </div>

              <div className="h-3 bg-zinc-900 rounded-full overflow-hidden mt-4">

                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400 transition-all duration-700"
                  style={{
                    width:
                      `${expPercent}%`,
                  }}
                />

              </div>

            </div>

          </div>

          {/* =====================================
              RIGHT PANEL
          ===================================== */}

          <div className="space-y-5">

            {/* PLAYER ID */}

            <section className="border border-zinc-800 bg-zinc-950/80 rounded-[28px] p-6">

              <p className="text-purple-400 text-[9px] tracking-[0.3em]">
                DIGITAL IDENTITY
              </p>

              <h2 className="text-2xl font-black mt-2">
                PLAYER PROFILE
              </h2>

              <div className="grid grid-cols-2 gap-3 mt-5">

                <Info
                  label="LEVEL"
                  value={`LV.${profile.level}`}
                  className="text-cyan-400"
                />

                <Info
                  label="TITLE"
                  value={
                    profile.title
                  }
                  className="text-lime-400"
                />

                <Info
                  label="COLLECTION"
                  value={`${collectionCount} ITEMS`}
                  className="text-white"
                />

                <Info
                  label="AVATAR"
                  value={
                    profile.avatar_key
                  }
                  className="text-purple-400"
                />

              </div>

              <div className="border border-zinc-800 bg-black/40 rounded-xl p-4 mt-3">

                <p className="text-zinc-600 text-[7px] tracking-[0.2em]">
                  PLAYER ID
                </p>

                <p className="text-zinc-300 text-[10px] font-mono mt-2 break-all">
                  {profile.user_id}
                </p>

              </div>

            </section>

            {/* =====================================
                EQUIPPED ITEM
            ===================================== */}

            <section
              className={`
                border
                rounded-[28px]
                bg-zinc-950/80
                p-6

                ${
                  gradeBorder[
                    activeGrade
                  ]
                }
              `}
            >

              <p
                className={`
                  text-[9px]
                  tracking-[0.3em]

                  ${
                    gradeText[
                      activeGrade
                    ]
                  }
                `}
              >
                EQUIPPED LOOT
              </p>

              <h2 className="text-2xl font-black mt-2">
                ACTIVE ITEM
              </h2>

              {!equippedItem && (
                <div className="border border-dashed border-zinc-800 bg-black/30 rounded-2xl p-8 mt-5 text-center">

                  <p className="text-zinc-600 text-sm font-black">
                    NO ITEM EQUIPPED
                  </p>

                  <p className="text-zinc-700 text-xs mt-2">
                    Equip an Item from your Collection.
                  </p>

                  <button
                    onClick={() =>
                      router.push(
                        "/collection"
                      )
                    }
                    className="mt-5 border border-cyan-400/30 text-cyan-400 px-5 py-3 rounded-xl text-xs font-black hover:bg-cyan-400/10 transition"
                  >
                    OPEN COLLECTION
                  </button>

                </div>
              )}

              {equippedItem && (
                <div className="mt-5">

                  <div className="relative h-[230px] border border-zinc-800 bg-black/40 rounded-2xl overflow-hidden">

                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

                    <Image
                      src={
                        productImages[
                          equippedItem.grade
                        ]
                      }
                      alt={
                        equippedItem.product
                      }
                      width={600}
                      height={650}
                      className="relative z-10 w-full h-full object-contain"
                    />

                  </div>

                  <p
                    className={`
                      text-3xl
                      font-black
                      mt-5

                      ${
                        gradeText[
                          equippedItem.grade
                        ]
                      }
                    `}
                  >
                    {equippedItem.grade}
                  </p>

                  <p className="text-white text-xl font-black mt-2">
                    {equippedItem.product}
                  </p>

                  <p className="text-cyan-400 font-mono text-sm mt-2">
                    {equippedItem.serial}
                  </p>

                  <div className="grid grid-cols-3 gap-3 mt-4">

                    <MiniInfo
                      label="SIZE"
                      value={
                        equippedItem.size ??
                        "-"
                      }
                    />

                    <MiniInfo
                      label="LEVEL"
                      value={`LV.${equippedItem.level}`}
                    />

                    <MiniInfo
                      label="SEASON"
                      value={
                        equippedItem.season
                      }
                    />

                  </div>

                </div>
              )}

            </section>

            {/* =====================================
                ACTION
            ===================================== */}

            <section className="grid grid-cols-2 gap-3">

              <button
                onClick={() =>
                  router.push(
                    "/collection"
                  )
                }
                className="border border-cyan-400/30 bg-cyan-400/[0.05] text-cyan-400 rounded-xl py-4 font-black text-sm hover:bg-cyan-400/10 transition"
              >
                COLLECTION
              </button>

              <button
                onClick={() =>
                  router.push(
                    "/craft"
                  )
                }
                className="bg-lime-400 text-black rounded-xl py-4 font-black text-sm hover:bg-lime-300 transition"
              >
                CRAFT LOOT
              </button>

            </section>

          </div>

        </section>

      </div>

      {/* =====================================
          STYLE
      ===================================== */}

      <style jsx global>{`

        .character-grid {
          background-image:
            linear-gradient(
              rgba(
                255,
                255,
                255,
                0.25
              )
              1px,
              transparent
              1px
            ),
            linear-gradient(
              90deg,
              rgba(
                255,
                255,
                255,
                0.25
              )
              1px,
              transparent
              1px
            );

          background-size:
            38px 38px;
        }

      `}</style>

    </main>
  );
}

// =====================================
// INFO
// =====================================

function Info({
  label,
  value,
  className,
}: {
  label: string;

  value: string;

  className: string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">

      <p className="text-zinc-600 text-[7px] tracking-[0.18em]">
        {label}
      </p>

      <p
        className={`
          text-lg
          font-black
          mt-2

          ${className}
        `}
      >
        {value}
      </p>

    </div>
  );
}

// =====================================
// MINI INFO
// =====================================

function MiniInfo({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-3">

      <p className="text-zinc-600 text-[7px] tracking-[0.15em]">
        {label}
      </p>

      <p className="text-white text-xs font-black mt-2">
        {value}
      </p>

    </div>
  );
}