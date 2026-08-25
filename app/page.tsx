"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import Navbar from "@/components/Navbar";
import CharacterAvatar from "@/components/CharacterAvatar";
import PublicHome from "@/components/PublicHome";

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type EquipmentSlot =
  | "HEAD"
  | "TOP"
  | "BOTTOM"
  | "SHOES"
  | "ACCESSORY";

type PlayerLoadoutSlot =
  | "HEAD"
  | "TOP"
  | "BOTTOM";

type Item = {
  id: number;
  serial: string;
  product: string;
  season: string;
  grade: Grade;
  level: number;
  size: string | null;
  created_at: string;

  product_id: number | null;
  design_id: number | null;

  equip_slot_snapshot: EquipmentSlot | null;

  upgrade_level: number;
  upgrade_exp: number;

  thumbnail_url_snapshot: string | null;
  model_url_snapshot: string | null;
};

type PlayerProfile = {
  user_id: string;
  display_name: string | null;
  level: number;
  exp: number;
  title: string;
  avatar_key: string;
  equipped_item_id: number | null;
};

type EquippedItem = {
  id: number;
  serial: string;
  product: string;
  season: string;
  grade: Grade;
  level: number;
  size: string | null;
  upgrade_level: number;
  upgrade_exp: number;
};

type SeasonSettings = {
  season_code: string;
  season_name: string;
  product_name: string;
  craft_cost: number;
  common_rate: number;
  rare_rate: number;
  epic_rate: number;
  legendary_rate: number;
  is_active: boolean;
};

type PlayerCharacter = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  version: number;
  thumbnail_url: string | null;
  model_url: string | null;
  is_active: boolean;
  is_default: boolean;
  image_ready: boolean;
  model_ready: boolean;
};

type EquipmentApiItem = {
  id: number;
  owner_id: string | null;

  serial: string;
  product: string;
  season: string;
  grade: Grade;

  level: number;
  size: string | null;

  product_id: number | null;
  design_id: number | null;

  equip_slot_snapshot: EquipmentSlot | null;

  upgrade_level: number | null;
  upgrade_exp: number | null;

  thumbnail_url_snapshot: string | null;
  model_url_snapshot: string | null;
};

type EquipmentEntry = {
  id: number;
  slot: EquipmentSlot;
  item_id: number;

  created_at: string;
  updated_at: string;

  item: EquipmentApiItem | null;
};

type EquipmentSlots = {
  HEAD: EquipmentEntry | null;
  TOP: EquipmentEntry | null;
  BOTTOM: EquipmentEntry | null;
  SHOES: EquipmentEntry | null;
  ACCESSORY: EquipmentEntry | null;
};

type EquipmentApiResponse = {
  ok: boolean;

  equipment?: EquipmentEntry[];
  slots?: Partial<EquipmentSlots>;
  count?: number;

  code?: string;
  error?: string;
  message?: string;
};

type PlayerRank = {
  collection_score: number;
  global_rank: number;
  total_players: number;
  total_items: number;
  common_items: number;
  rare_items: number;
  epic_items: number;
  legendary_items: number;
};

type RankApiResponse = {
  ok: boolean;
  rank?: PlayerRank;
  code?: string;
  error?: string;
};

type ItemImageSource = {
  grade: Grade;
  thumbnail_url_snapshot: string | null;
};

const productImages: Record<Grade, string> = {
  COMMON: "/products/common.png",
  RARE: "/products/rare.png",
  EPIC: "/products/epic.png",
  LEGENDARY: "/products/legendary.png",
};

/*
  Grade color source of truth. These read from the shared
  design tokens in globals.css (--grade-common / rare / epic /
  legendary) so the brand palette and the in-app rarity colors
  can never drift apart again.
*/

const gradeCssVar: Record<Grade, string> = {
  COMMON: "var(--grade-common)",
  RARE: "var(--grade-rare)",
  EPIC: "var(--grade-epic)",
  LEGENDARY: "var(--grade-legendary)",
};

const gradeText: Record<Grade, string> = {
  COMMON: "text-[var(--grade-common)]",
  RARE: "text-[var(--grade-rare)]",
  EPIC: "text-[var(--grade-epic)]",
  LEGENDARY: "text-[var(--grade-legendary)]",
};

const gradeBorder: Record<Grade, string> = {
  COMMON: "border-[var(--grade-common)]/40",
  RARE: "border-[var(--grade-rare)]/40",
  EPIC: "border-[var(--grade-epic)]/45",
  LEGENDARY: "border-[var(--grade-legendary)]/45",
};

const gradeGlow: Record<Grade, string> = {
  COMMON:
    "shadow-[0_0_80px_rgba(168,173,187,0.10)]",

  RARE:
    "shadow-[0_0_100px_rgba(56,198,244,0.16)]",

  EPIC:
    "shadow-[0_0_120px_rgba(181,101,247,0.20)]",

  LEGENDARY:
    "shadow-[0_0_140px_rgba(240,169,59,0.24)]",
};

const EMPTY_EQUIPMENT_SLOTS: EquipmentSlots = {
  HEAD: null,
  TOP: null,
  BOTTOM: null,
  SHOES: null,
  ACCESSORY: null,
};

const PLAYER_LOADOUT_SLOTS: PlayerLoadoutSlot[] = [
  "HEAD",
  "TOP",
  "BOTTOM",
];

const slotSubLabel: Record<
  PlayerLoadoutSlot,
  string
> = {
  HEAD: "HEADWEAR",
  TOP: "SHIRT",
  BOTTOM: "PANTS",
};

export default function HomePage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    isGuest,
    setIsGuest,
  ] =
    useState(false);

  const [
    userEmail,
    setUserEmail,
  ] =
    useState("");

  const [
    walletBalance,
    setWalletBalance,
  ] =
    useState(0);

  const [
    items,
    setItems,
  ] =
    useState<Item[]>([]);

  const [
    profile,
    setProfile,
  ] =
    useState<PlayerProfile | null>(
      null
    );

  const [
    equippedItem,
    setEquippedItem,
  ] =
    useState<EquippedItem | null>(
      null
    );

  const [
    season,
    setSeason,
  ] =
    useState<SeasonSettings | null>(
      null
    );

  const [
    playerCharacter,
    setPlayerCharacter,
  ] =
    useState<PlayerCharacter | null>(
      null
    );

  const [
    playerRank,
    setPlayerRank,
  ] =
    useState<PlayerRank | null>(
      null
    );

  const [
    equipmentSlots,
    setEquipmentSlots,
  ] =
    useState<EquipmentSlots>({
      ...EMPTY_EQUIPMENT_SLOTS,
    });

  const [
    selectedEquipmentSlot,
    setSelectedEquipmentSlot,
  ] =
    useState<PlayerLoadoutSlot>(
      "TOP"
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    equippingItemId,
    setEquippingItemId,
  ] =
    useState<number | null>(
      null
    );

  async function loadEquipment(
    accessToken: string
  ) {
    const response =
      await fetch(
        "/api/profile/equipment",
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache: "no-store",
        }
      );

    const result =
      (await response.json()) as EquipmentApiResponse;

    if (
      !response.ok ||
      !result.ok
    ) {
      throw new Error(
        result.error ||
          "Unable to load equipment."
      );
    }

    const nextSlots: EquipmentSlots = {
      HEAD:
        result.slots?.HEAD ??
        null,

      TOP:
        result.slots?.TOP ??
        null,

      BOTTOM:
        result.slots?.BOTTOM ??
        null,

      SHOES:
        result.slots?.SHOES ??
        null,

      ACCESSORY:
        result.slots?.ACCESSORY ??
        null,
    };

    setEquipmentSlots(
      nextSlots
    );

    const topItem =
      nextSlots.TOP?.item ??
      null;

    if (topItem) {
      setEquippedItem({
        id:
          topItem.id,

        serial:
          topItem.serial,

        product:
          topItem.product,

        season:
          topItem.season,

        grade:
          topItem.grade,

        level:
          topItem.level,

        size:
          topItem.size,

        upgrade_level:
          Number(
            topItem.upgrade_level ??
              0
          ),

        upgrade_exp:
          Number(
            topItem.upgrade_exp ??
              0
          ),
      });
    } else {
      setEquippedItem(
        null
      );
    }

    return nextSlots;
  }

  async function loadPlayerRank(
    accessToken: string
  ) {
    const response =
      await fetch(
        "/api/profile/rank",
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache: "no-store",
        }
      );

    const result =
      (await response.json()) as RankApiResponse;

    if (
      !response.ok ||
      !result.ok ||
      !result.rank
    ) {
      console.error(
        "HOME RANK ERROR:",
        result
      );

      setPlayerRank(
        null
      );

      return null;
    }

    setPlayerRank(
      result.rank
    );

    return result.rank;
  }

  useEffect(() => {
    async function loadHome() {
      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase
            .auth
            .getUser();

        if (
          userError ||
          !user
        ) {
          if (!user) {
            setIsGuest(
              true
            );

            return;
          }

          throw userError;
        }

        setIsGuest(
          false
        );

        setUserEmail(
          user.email ??
            "PLAYER"
        );

        const {
          data: {
            session,
          },
          error:
            sessionError,
        } =
          await supabase
            .auth
            .getSession();

        if (
          sessionError
        ) {
          throw sessionError;
        }

        if (!session) {
          setIsGuest(
            true
          );

          return;
        }

        const {
          data:
            wallet,
          error:
            walletError,
        } =
          await supabase
            .from(
              "wallets"
            )
            .select(
              "balance"
            )
            .eq(
              "user_id",
              user.id
            )
            .maybeSingle();

        if (
          walletError
        ) {
          console.error(
            "HOME WALLET ERROR:",
            walletError
          );
        }

        setWalletBalance(
          Number(
            wallet?.balance ??
              0
          )
        );

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
              created_at,
              product_id,
              design_id,
              equip_slot_snapshot,
              upgrade_level,
              upgrade_exp,
              thumbnail_url_snapshot,
              model_url_snapshot
            `)
            .eq(
              "owner_id",
              user.id
            )
            .order(
              "id",
              {
                ascending:
                  false,
              }
            );

        if (
          itemError
        ) {
          throw itemError;
        }

        const safeItems =
          (itemData ??
            []) as Item[];

        setItems(
          safeItems
        );

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
              equipped_item_id
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
          profileData
        ) {
          const safeProfile =
            profileData as PlayerProfile;

          setProfile(
            safeProfile
          );

          if (
            safeProfile
              .equipped_item_id
          ) {
            const legacyEquipped =
              safeItems.find(
                (item) =>
                  item.id ===
                  safeProfile
                    .equipped_item_id
              );

            if (
              legacyEquipped
            ) {
              setEquippedItem({
                id:
                  legacyEquipped.id,

                serial:
                  legacyEquipped.serial,

                product:
                  legacyEquipped.product,

                season:
                  legacyEquipped.season,

                grade:
                  legacyEquipped.grade,

                level:
                  legacyEquipped.level,

                size:
                  legacyEquipped.size,

                upgrade_level:
                  legacyEquipped.upgrade_level ??
                  0,

                upgrade_exp:
                  legacyEquipped.upgrade_exp ??
                  0,
              });
            }
          }
        }

        await loadEquipment(
          session.access_token
        );

        await loadPlayerRank(
          session.access_token
        );

        const characterResponse =
          await fetch(
            "/api/profile/character",
            {
              method:
                "GET",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            }
          );

        const characterResult =
          await characterResponse
            .json();

        if (
          !characterResponse.ok ||
          !characterResult?.ok
        ) {
          throw new Error(
            characterResult?.error ||
              "Unable to load Player Character"
          );
        }

        setPlayerCharacter(
          characterResult.character ??
            null
        );

        const response =
          await fetch(
            "/api/season",
            {
              cache:
                "no-store",
            }
          );

        const result =
          await response
            .json();

        if (
          response.ok
        ) {
          setSeason(
            result.season ??
              null
          );
        }
      } catch (
        error
      ) {
        console.error(
          "HOME ERROR:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Home"
        );
      } finally {
        setLoading(
          false
        );
      }
    }

    void loadHome();
  }, [
    router,
  ]);

  const stats =
    useMemo(() => {
      return {
        total:
          items.length,

        COMMON:
          items.filter(
            (item) =>
              item.grade ===
              "COMMON"
          ).length,

        RARE:
          items.filter(
            (item) =>
              item.grade ===
              "RARE"
          ).length,

        EPIC:
          items.filter(
            (item) =>
              item.grade ===
              "EPIC"
          ).length,

        LEGENDARY:
          items.filter(
            (item) =>
              item.grade ===
              "LEGENDARY"
          ).length,
      };
    }, [
      items,
    ]);

  const latestItems =
    items.slice(
      0,
      4
    );

  const activeGrade:
    Grade =
      equipmentSlots
        .TOP
        ?.item
        ?.grade ??
      equippedItem
        ?.grade ??
      "COMMON";

  const currentLevel =
    profile?.level ??
    1;

  const currentExp =
    profile?.exp ??
    0;

  const expNeeded =
    Math.max(
      1000,
      currentLevel *
        1000
    );

  const expPercent =
    Math.min(
      100,
      Math.max(
        0,
        (currentExp /
          expNeeded) *
          100
      )
    );

  const levelDisplay =
    String(
      currentLevel
    ).padStart(
      2,
      "0"
    );

  const rankDisplay =
    playerRank &&
    playerRank.global_rank >
      0
      ? `#${playerRank.global_rank}`
      : "#-";

  const collectionScore =
    playerRank?.collection_score ??
    0;

  const totalPlayers =
    playerRank?.total_players ??
    0;

  const selectedSlotEntry =
    equipmentSlots[
      selectedEquipmentSlot
    ];

  const selectedSlotItem =
    selectedSlotEntry?.item ??
    null;

  const compatibleItems =
    useMemo(() => {
      return items.filter(
        (
          item
        ) => {
          if (
            item.equip_slot_snapshot ===
            selectedEquipmentSlot
          ) {
            return true;
          }

          if (
            selectedSlotEntry
              ?.item_id ===
            item.id
          ) {
            return true;
          }

          return false;
        }
      );
    }, [
      items,
      selectedEquipmentSlot,
      selectedSlotEntry,
    ]);

  async function equipItem(
    item: Item
  ) {
    if (
      equippingItemId !==
      null
    ) {
      return;
    }

    setEquippingItemId(
      item.id
    );

    setErrorMessage("");

    try {
      const {
        data: {
          session,
        },
        error:
          sessionError,
      } =
        await supabase
          .auth
          .getSession();

      if (
        sessionError
      ) {
        throw sessionError;
      }

      if (
        !session
      ) {
        router.push(
          "/login"
        );

        return;
      }

      const response =
        await fetch(
          "/api/profile/equipment",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                item_id:
                  item.id,
              }),
          }
        );

      const result =
        await response
          .json();

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
            result?.message ||
            "Unable to equip item."
        );
      }

      const resolvedSlot =
        result?.slot as
          | EquipmentSlot
          | undefined;

      if (
        resolvedSlot ===
          "HEAD" ||
        resolvedSlot ===
          "TOP" ||
        resolvedSlot ===
          "BOTTOM"
      ) {
        setSelectedEquipmentSlot(
          resolvedSlot
        );
      }

      await loadEquipment(
        session.access_token
      );
    } catch (
      error
    ) {
      console.error(
        "HOME EQUIPMENT ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to equip item."
      );
    } finally {
      setEquippingItemId(
        null
      );
    }
  }

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">

          <p className="text-cyan-400 tracking-[0.35em] animate-pulse">
            LOADING PLAYER HOME...
          </p>

        </div>

      </main>
    );
  }

  if (
    isGuest
  ) {
    return (
      <PublicHome />
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--foreground)] relative overflow-hidden">

      <Navbar />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        <div className="absolute top-[-320px] left-1/2 -translate-x-1/2 w-[1100px] h-[900px] rounded-full bg-[var(--grade-rare)]/[0.08] blur-[190px]" />

        <div className="absolute bottom-[-360px] left-[-280px] w-[760px] h-[760px] rounded-full bg-[var(--grade-epic)]/[0.10] blur-[190px]" />

        <div className="absolute bottom-[-360px] right-[-280px] w-[760px] h-[760px] rounded-full bg-[var(--grade-legendary)]/[0.05] blur-[190px]" />

      </div>

      <div className="relative z-10 mx-auto max-w-[1360px] px-5 pb-10 pt-5 sm:px-6 lg:px-7">

        {errorMessage && (
          <div className="border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5 mb-6">
            {errorMessage}
          </div>
        )}

        <section className="flex flex-wrap items-end justify-between gap-4">

          <div>

            <p className="font-mono text-[var(--grade-rare)] text-[8px] tracking-[0.32em]">
              LOOTFORM PLAYER SYSTEM
            </p>

            <h1 className="font-display mt-2 text-[38px] font-bold leading-none sm:text-[46px] lg:text-[50px]">
              MY{" "}

              <span className="text-[var(--grade-rare)]">
                CHARACTER
              </span>
            </h1>

            <p className="mt-2 text-[10px] font-semibold tracking-[0.08em] text-[var(--muted)]">
              DIGITAL IDENTITY // PHYSICAL COLLECTION
            </p>

          </div>

          <div className="flex flex-wrap gap-2.5">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/wallet"
                )
              }
              className="rounded-xl border border-lime-400/20 bg-lime-400/[0.04] px-4 py-2.5 text-left transition hover:border-lime-400"
            >

              <p className="text-zinc-600 text-[8px]">
                WALLET
              </p>

              <p className="text-lime-400 font-black">
                {walletBalance.toLocaleString()}{" "}
                LT
              </p>

            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/account"
                )
              }
              className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] px-4 py-2.5 text-[11px] font-black text-cyan-400 transition hover:border-cyan-400 hover:bg-cyan-400/[0.08]"
            >
              ACCOUNT
            </button>

          </div>

        </section>

        <section className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_1fr]">

          <article
            style={{
              "--grade-color": gradeCssVar[activeGrade],
            } as CSSProperties}
            className={`
              hud-frame
              relative
              overflow-hidden
              min-h-[650px]
              border
              rounded-[28px]
              bg-zinc-950/85
              p-6
              ${
                gradeBorder[
                  activeGrade
                ]
              }
              ${
                gradeGlow[
                  activeGrade
                ]
              }
            `}
          >

            <div className="absolute inset-0 character-grid opacity-[0.05] pointer-events-none" />

            <div
              className="absolute left-[44%] top-[50%] -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full blur-[95px]"
              style={{
                backgroundColor: gradeCssVar[activeGrade],
                opacity:
                  activeGrade === "COMMON"
                    ? 0.1
                    : activeGrade === "RARE"
                    ? 0.18
                    : activeGrade === "EPIC"
                    ? 0.22
                    : 0.28,
              }}
            />

            <div className="relative z-10 flex items-start justify-between gap-5">

              <div>

                <p className="text-cyan-400 text-[8px] tracking-[0.28em]">
                  PLAYER CHARACTER
                </p>

                <h2 className="mt-1.5 text-2xl font-black sm:text-3xl">
                  {profile
                    ?.display_name ||
                    userEmail.split(
                      "@"
                    )[0] ||
                    "PLAYER"}
                </h2>

                <p className="mt-1.5 text-[10px] text-zinc-600">
                  {userEmail}
                </p>

              </div>

              <div className="text-right">

                <p className="text-zinc-600 text-[8px]">
                  TITLE
                </p>

                <p className="mt-1.5 text-sm font-black text-lime-400">
                  {profile?.title ??
                    "ROOKIE"}
                </p>

              </div>

            </div>

            <div className="relative z-10 h-[420px] mt-3">

              <div className="character-ring absolute left-[44%] top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/10" />

              <div className="character-ring-reverse absolute left-[44%] top-1/2 h-[292px] w-[292px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/15" />

              <div className="absolute left-[44%] top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.02] blur-[45px]" />

              <div className="absolute inset-y-0 left-0 right-[140px] z-10">

                <CharacterAvatar
                  grade={
                    activeGrade
                  }
                  modelUrl={
                    playerCharacter
                      ?.model_url
                  }
                />

              </div>

              <div className="absolute left-3 top-1/2 z-20 -translate-y-1/2 space-y-2 sm:left-5">

                <SideStat
                  label="SCORE"
                  value={
                    collectionScore.toLocaleString()
                  }
                  className="text-lime-400"
                />

                <SideStat
                  label="RANK"
                  value={
                    rankDisplay
                  }
                  className="text-cyan-400"
                />

                <SideStat
                  label="LEGENDARY"
                  value={
                    String(
                      stats.LEGENDARY
                    )
                  }
                  className="text-orange-400"
                />

              </div>

              <div className="absolute right-1 top-1/2 z-30 flex w-[128px] -translate-y-1/2 flex-col gap-2 sm:right-2">

                <p className="mb-1 text-center text-[8px] font-black tracking-[0.18em] text-zinc-500">
                  EQUIPMENT
                </p>

                {PLAYER_LOADOUT_SLOTS.map(
                  (
                    slot
                  ) => (
                    <CharacterEquipmentSlot
                      key={
                        slot
                      }
                      slot={
                        slot
                      }
                      entry={
                        equipmentSlots[
                          slot
                        ]
                      }
                      selected={
                        selectedEquipmentSlot ===
                        slot
                      }
                      onSelect={() =>
                        setSelectedEquipmentSlot(
                          slot
                        )
                      }
                    />
                  )
                )}

              </div>

            </div>

            <div className="relative z-30 mt-4 rounded-xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur-xl">

              <div className="flex items-center gap-4">

                <div className="shrink-0 border-r border-zinc-800 pr-4">

                  <p className="text-zinc-500 text-[7px] tracking-[0.22em]">
                    PLAYER LEVEL
                  </p>

                  <p className="mt-1 text-[22px] sm:text-[24px] leading-none font-black text-white">
                    LV.
                    {levelDisplay}
                  </p>

                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-3">

                    <p className="text-zinc-600 text-[7px] tracking-[0.14em]">
                      EXP PROGRESS
                    </p>

                    <p className="text-[9px] sm:text-[10px] font-black text-cyan-400">
                      {currentExp.toLocaleString()}{" "}
                      /{" "}
                      {expNeeded.toLocaleString()}{" "}
                      EXP
                    </p>

                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-900">

                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-lime-400 transition-all duration-700"
                      style={{
                        width:
                          `${expPercent}%`,
                      }}
                    />

                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[7px] font-bold tracking-[0.1em] text-zinc-700">

                    <span>
                      {Math.round(
                        expPercent
                      )}
                      %
                    </span>

                    <span>
                      NEXT LV.
                      {String(
                        currentLevel +
                          1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </span>

                  </div>

                </div>

              </div>

            </div>

          </article>

          <div className="space-y-3">

            <section className="rounded-[20px] border border-zinc-800 bg-zinc-950/80 p-3.5 sm:p-4">

              <p className="text-[7px] tracking-[0.26em] text-purple-400">
                DIGITAL IDENTITY
              </p>

              <h2 className="mt-1 text-lg sm:text-[20px] font-black">
                PLAYER PROFILE
              </h2>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">

                <InfoBox
                  label="LEVEL"
                  value={`LV.${currentLevel}`}
                  className="text-cyan-400"
                />

                <InfoBox
                  label="TITLE"
                  value={
                    profile?.title ??
                    "ROOKIE"
                  }
                  className="text-lime-400"
                />

                <InfoBox
                  label="COLLECTION"
                  value={`${stats.total} ITEMS`}
                  className="text-white"
                />

                <InfoBox
                  label="GLOBAL RANK"
                  value={
                    rankDisplay
                  }
                  className="text-orange-400"
                />

              </div>

              {/* =================================================
                  RANK + COLLECTION SCORE
              ================================================= */}

              <div className="mt-2.5 grid grid-cols-2 gap-2">

                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] px-4 py-3">

                  <p className="text-zinc-600 text-[6px] tracking-[0.16em]">
                    GLOBAL RANK
                  </p>

                  <div className="mt-1 flex items-end justify-between gap-3">

                    <p className="text-[24px] font-black leading-none text-cyan-400">
                      {rankDisplay}
                    </p>

                    <p className="text-right text-[6px] font-black text-zinc-500">
                      OF{" "}
                      {totalPlayers.toLocaleString()}{" "}
                      PLAYERS
                    </p>

                  </div>

                </div>

                <div className="rounded-xl border border-orange-400/20 bg-orange-400/[0.04] px-4 py-3">

                  <p className="text-zinc-600 text-[6px] tracking-[0.16em]">
                    COLLECTION SCORE
                  </p>

                  <div className="mt-1 flex items-end justify-between gap-3">

                    <p className="text-[22px] font-black leading-none text-orange-400">
                      {collectionScore.toLocaleString()}{" "}
                      PTS
                    </p>

                    <p className="text-right text-[6px] font-black text-zinc-500">
                      LIVE SCORE
                    </p>

                  </div>

                </div>

              </div>

            </section>

            <section
              id="home-loadout"
              className="rounded-[20px] border border-zinc-800 bg-zinc-950/80 p-3.5 sm:p-4"
            >

              <div className="flex items-start justify-between gap-4">

                <div>

                  <p className="text-[8px] tracking-[0.26em] text-orange-400">
                    CHARACTER EQUIPMENT
                  </p>

                  <h2 className="mt-1 text-lg sm:text-[20px] font-black">
                    LOADOUT
                  </h2>

                </div>

                <div className="text-right">

                  <p className="text-zinc-600 text-[7px]">
                    EQUIPPED
                  </p>

                  <p className="mt-0.5 text-[11px] font-black text-lime-400">
                    {
                      PLAYER_LOADOUT_SLOTS.filter(
                        (
                          slot
                        ) =>
                          equipmentSlots[
                            slot
                          ]?.item
                      ).length
                    }
                    /3
                  </p>

                </div>

              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">

                {PLAYER_LOADOUT_SLOTS.map(
                  (
                    slot
                  ) => {
                    const entry =
                      equipmentSlots[
                        slot
                      ];

                    const item =
                      entry?.item ??
                      null;

                    const selected =
                      selectedEquipmentSlot ===
                      slot;

                    const upgradeLevel =
                      Number(
                        item?.upgrade_level ??
                          0
                      );

                    return (
                      <button
                        key={
                          slot
                        }
                        type="button"
                        onClick={() =>
                          setSelectedEquipmentSlot(
                            slot
                          )
                        }
                        className={`
                          relative
                          min-h-[168px]
                          overflow-hidden
                          rounded-xl
                          border
                          p-3
                          text-left
                          transition
                          ${
                            selected
                              ? "border-cyan-400/60 bg-cyan-400/[0.06]"
                              : item
                              ? `${gradeBorder[item.grade]} bg-black/50 hover:border-zinc-600`
                              : "border-zinc-800 bg-black/35 hover:border-zinc-600"
                          }
                        `}
                      >

                        <div className="flex items-start justify-between gap-2">

                          <div>

                            <p
                              className={`
                                text-[10px]
                                font-black
                                tracking-[0.18em]
                                ${
                                  selected
                                    ? "text-cyan-400"
                                    : "text-zinc-400"
                                }
                              `}
                            >
                              {
                                slot
                              }
                            </p>

                            <p className="mt-0.5 text-[8px] text-zinc-500">
                              {
                                slotSubLabel[
                                  slot
                                ]
                              }
                            </p>

                          </div>

                          {item && (
                            <span
                              className={`
                                rounded-md
                                border
                                px-1.5
                                py-0.5
                                text-[7px]
                                font-black
                                ${
                                  upgradeLevel >
                                  0
                                    ? "border-lime-400/30 bg-lime-400/[0.08] text-lime-400"
                                    : "border-zinc-700 bg-black/50 text-zinc-400"
                                }
                              `}
                            >
                              +
                              {
                                upgradeLevel
                              }
                            </span>
                          )}

                        </div>

                        {item ? (
                          <>

                            <div className="mt-2 flex h-[76px] items-center justify-center">

                              <ItemImage
                                item={
                                  item
                                }
                                alt={
                                  item.product
                                }
                                className="h-full w-full scale-[1.15] object-contain"
                              />

                            </div>

                            <p
                              className={`mt-1.5 truncate text-[9px] font-black ${gradeText[item.grade]}`}
                            >
                              {
                                item.grade
                              }
                            </p>

                            <p className="mt-0.5 truncate text-[10px] font-black text-white">
                              {
                                item.product
                              }
                            </p>

                            {upgradeLevel >
                            0 ? (
                              <p className="mt-0.5 text-[8px] font-black text-lime-400">
                                UPGRADED +
                                {
                                  upgradeLevel
                                }
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[8px] font-black text-zinc-500">
                                BASE +0
                              </p>
                            )}

                          </>
                        ) : (
                          <div className="mt-4 flex min-h-[92px] flex-col items-center justify-center">

                            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-[16px] font-black text-zinc-700">
                              +
                            </div>

                            <p className="mt-2 text-[9px] font-black text-zinc-500">
                              EMPTY SLOT
                            </p>

                          </div>
                        )}

                        {selected && (
                          <div className="absolute bottom-0 left-1/2 h-[2px] w-10 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                        )}

                      </button>
                    );
                  }
                )}

              </div>

              <div className="mt-3 border-t border-zinc-900 pt-3">

                <div className="flex items-center justify-between gap-4">

                  <div>

                    <p className="text-zinc-500 text-[8px] tracking-[0.18em]">
                      INVENTORY
                    </p>

                    <p className="mt-0.5 text-[11px] font-black text-white">
                      SELECT ITEM FOR{" "}

                      <span className="text-cyan-400">
                        {
                          selectedEquipmentSlot
                        }
                      </span>
                    </p>

                  </div>

                  <p className="text-[8px] text-zinc-500">
                    {
                      compatibleItems.length
                    }{" "}
                    AVAILABLE
                  </p>

                </div>

                {compatibleItems.length ===
                0 ? (
                  <div className="mt-2.5 flex min-h-[80px] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-black/30">

                    <div className="text-center">

                      <p className="text-[10px] font-black text-zinc-500">
                        NO{" "}
                        {
                          selectedEquipmentSlot
                        }{" "}
                        ITEM
                      </p>

                      <p className="mt-1 text-[8px] text-zinc-600">
                        CRAFT OR COLLECT A COMPATIBLE ITEM
                      </p>

                    </div>

                  </div>
                ) : (
                  <div className="mt-2 grid max-h-[132px] grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4">

                    {compatibleItems.map(
                      (
                        item
                      ) => {
                        const isEquipped =
                          selectedSlotEntry
                            ?.item_id ===
                          item.id;

                        const updating =
                          equippingItemId ===
                          item.id;

                        return (
                          <button
                            type="button"
                            key={
                              item.id
                            }
                            onClick={() =>
                              void equipItem(
                                item
                              )
                            }
                            disabled={
                              equippingItemId !==
                              null
                            }
                            className={`
                              relative
                              min-h-[118px]
                              overflow-hidden
                              rounded-lg
                              border
                              px-2.5
                              py-2
                              text-left
                              transition
                              ${
                                isEquipped
                                  ? `${gradeBorder[item.grade]} bg-white/[0.06]`
                                  : "border-zinc-800 bg-black/40 hover:border-zinc-600"
                              }
                              ${
                                equippingItemId !==
                                null
                                  ? "cursor-not-allowed opacity-60"
                                  : ""
                              }
                            `}
                          >

                            <div className="relative h-[46px]">

                              <ItemImage
                                item={
                                  item
                                }
                                alt={
                                  item.product
                                }
                                className="h-full w-full object-contain"
                              />

                            </div>

                            <div className="mt-1.5 flex items-center justify-between gap-1">

                              <p
                                className={`text-[8px] font-black ${gradeText[item.grade]}`}
                              >
                                {
                                  item.grade
                                }
                              </p>

                              <span
                                className={
                                  item.upgrade_level >
                                  0
                                    ? "text-[8px] font-black text-lime-400"
                                    : "text-[8px] font-black text-zinc-500"
                                }
                              >
                                +
                                {
                                  item.upgrade_level ??
                                  0
                                }
                              </span>

                            </div>

                            <p className="mt-0.5 truncate text-[9px] font-black text-white">
                              {
                                item.product
                              }
                            </p>

                            <p className="mt-0.5 truncate font-mono text-[7px] text-cyan-400">
                              {
                                item.serial
                              }
                            </p>

                            {isEquipped && (
                              <div className="absolute right-1.5 top-1.5 rounded-md bg-lime-400 px-1.5 py-0.5 text-[6px] font-black text-black">
                                EQUIPPED
                              </div>
                            )}

                            {updating && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/80">

                                <p className="text-[8px] font-black text-cyan-400 animate-pulse">
                                  EQUIPPING...
                                </p>

                              </div>
                            )}

                          </button>
                        );
                      }
                    )}

                  </div>
                )}

              </div>

              <div className="mt-3">

                {selectedSlotItem ? (
                  <div className="grid items-center gap-3 rounded-xl border border-zinc-800 bg-black/45 p-3 sm:grid-cols-[92px_1fr_auto]">

                    <div className="flex h-[92px] items-center justify-center rounded-lg border border-zinc-800 bg-black/50">

                      <ItemImage
                        item={
                          selectedSlotItem
                        }
                        alt={
                          selectedSlotItem.product
                        }
                        className="h-full w-full object-contain"
                      />

                    </div>

                    <div className="min-w-0">

                      <div className="flex items-center gap-2">

                        <p
                          className={`text-lg font-black ${gradeText[selectedSlotItem.grade]}`}
                        >
                          {
                            selectedSlotItem
                              .grade
                          }
                        </p>

                        <span className="rounded-md border border-zinc-700 bg-black/50 px-1.5 py-0.5 text-[8px] font-black text-zinc-400">
                          {
                            selectedEquipmentSlot
                          }
                        </span>

                      </div>

                      <p className="mt-0.5 truncate text-[13px] font-black text-white">
                        {
                          selectedSlotItem
                            .product
                        }
                      </p>

                      <p className="mt-0.5 truncate font-mono text-[9px] text-cyan-400">
                        {
                          selectedSlotItem
                            .serial
                        }
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">

                        <MiniBadge
                          label="SIZE"
                          value={
                            selectedSlotItem
                              .size ??
                            "-"
                          }
                        />

                        <MiniBadge
                          label="ITEM LV"
                          value={`${selectedSlotItem.level}`}
                        />

                        <MiniBadge
                          label="SEASON"
                          value={
                            selectedSlotItem
                              .season
                          }
                        />

                      </div>

                    </div>

                    <div className="min-w-[100px] rounded-xl border border-lime-400/20 bg-lime-400/[0.04] px-3 py-2.5 text-center">

                      <p className="text-[8px] tracking-[0.12em] text-zinc-500">
                        UPGRADE
                      </p>

                      <p className="mt-1 text-2xl font-black text-lime-400">
                        +
                        {Number(
                          selectedSlotItem
                            .upgrade_level ??
                            0
                        )}
                      </p>

                      <p
                        className={
                          Number(
                            selectedSlotItem
                              .upgrade_level ??
                              0
                          ) >
                          0
                            ? "mt-0.5 text-[8px] font-black text-lime-400"
                            : "mt-0.5 text-[8px] font-black text-zinc-500"
                        }
                      >
                        {Number(
                          selectedSlotItem
                            .upgrade_level ??
                            0
                        ) >
                        0
                          ? "UPGRADED"
                          : "BASE ITEM"}
                      </p>

                    </div>

                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-800 bg-black/25 px-3 py-3 text-center">

                    <p className="text-[8px] font-black text-zinc-600">
                      {
                        selectedEquipmentSlot
                      }{" "}
                      SLOT EMPTY
                    </p>

                  </div>
                )}

              </div>

            </section>

            <section className="rounded-[20px] border border-zinc-800 bg-zinc-950/80 p-3.5">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <p className="text-[8px] tracking-[0.28em] text-orange-400">
                    ACTIVE DROP
                  </p>

                  <h2 className="mt-1 text-sm sm:text-base font-black">
                    {season
                      ?.product_name ??
                      "POWER-UP TEE"}
                  </h2>

                </div>

                <div className="text-right">

                  <p className="text-zinc-600 text-[8px]">
                    CRAFT COST
                  </p>

                  <p className="text-lime-400 font-black mt-1">
                    {season
                      ?.craft_cost ??
                      100}{" "}
                    LT
                  </p>

                </div>

              </div>

              <div className="mt-2.5 grid grid-cols-4 gap-1.5">

                <Rate
                  label="COMMON"
                  value={
                    season
                      ?.common_rate ??
                    0
                  }
                  className="text-zinc-200"
                />

                <Rate
                  label="RARE"
                  value={
                    season
                      ?.rare_rate ??
                    0
                  }
                  className="text-cyan-400"
                />

                <Rate
                  label="EPIC"
                  value={
                    season
                      ?.epic_rate ??
                    0
                  }
                  className="text-purple-400"
                />

                <Rate
                  label="LEGEND"
                  value={
                    season
                      ?.legendary_rate ??
                    0
                  }
                  className="text-orange-400"
                />

              </div>

            </section>

            <section className="grid grid-cols-2 gap-2.5">

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/collection"
                  )
                }
                className="border border-cyan-400/30 bg-cyan-400/[0.05] text-cyan-400 rounded-xl py-2.5 font-black text-[11px] hover:bg-cyan-400/10 transition"
              >
                COLLECTION
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/craft"
                  )
                }
                className="bg-lime-400 text-black rounded-xl py-2.5 font-black text-[11px] hover:bg-lime-300 transition"
              >
                CRAFT LOOT
              </button>

            </section>

          </div>

        </section>

        <section className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-5">

          <StatCard
            label="TOTAL ITEMS"
            value={
              stats.total
            }
            className="text-white"
          />

          <StatCard
            label="COMMON"
            value={
              stats.COMMON
            }
            className="text-zinc-200"
          />

          <StatCard
            label="RARE"
            value={
              stats.RARE
            }
            className="text-cyan-400"
          />

          <StatCard
            label="EPIC"
            value={
              stats.EPIC
            }
            className="text-purple-400"
          />

          <StatCard
            label="LEGENDARY"
            value={
              stats.LEGENDARY
            }
            className="text-orange-400"
          />

        </section>

        <section className="mt-7 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-6">

          <div className="flex flex-wrap items-end justify-between gap-4">

            <div>

              <p className="text-[8px] tracking-[0.28em] text-purple-400">
                PLAYER FEED
              </p>

              <h2 className="mt-1.5 text-xl font-black">
                LATEST LOOT
              </h2>

            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/collection"
                )
              }
              className="text-cyan-400 text-xs font-black"
            >
              VIEW ALL →
            </button>

          </div>

          {latestItems.length ===
          0 ? (
            <div className="mt-6 border border-zinc-800 bg-black/40 rounded-xl p-10 text-center">

              <p className="text-zinc-600">
                NO LOOT YET
              </p>

            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

              {latestItems.map(
                (
                  item
                ) => (
                  <div
                    key={
                      item.id
                    }
                    className="rounded-2xl border border-zinc-800 bg-black/40 p-3.5"
                  >

                    <div className="relative h-[135px]">

                      <ItemImage
                        item={
                          item
                        }
                        alt={
                          item.product
                        }
                        className="h-full w-full object-contain"
                      />

                    </div>

                    <div className="flex items-center justify-between gap-2">

                      <p
                        className={`text-[9px] font-black tracking-[0.2em] ${gradeText[item.grade]}`}
                      >
                        {
                          item.grade
                        }
                      </p>

                      <p
                        className={
                          item.upgrade_level >
                          0
                            ? "text-[8px] font-black text-lime-400"
                            : "text-[8px] font-black text-zinc-600"
                        }
                      >
                        +
                        {
                          item.upgrade_level ??
                          0
                        }
                      </p>

                    </div>

                    <p className="text-white font-black mt-2">
                      {
                        item.product
                      }
                    </p>

                    <p className="text-cyan-400 font-mono text-xs mt-2">
                      {
                        item.serial
                      }
                    </p>

                    <div className="mt-2.5 grid grid-cols-2 gap-2">

                      <InfoBox
                        label="SIZE"
                        value={
                          item.size ??
                          "-"
                        }
                        className="text-white"
                      />

                      <InfoBox
                        label="LEVEL"
                        value={`LVL ${String(
                          item.level
                        ).padStart(
                          2,
                          "0"
                        )}`}
                        className="text-white"
                      />

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </section>

      </div>

      <style jsx global>{`

        .character-grid {
          background-image:
            linear-gradient(
              rgba(
                255,
                255,
                255,
                0.22
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
                0.22
              )
              1px,
              transparent
              1px
            );

          background-size:
            38px 38px;
        }

        @keyframes characterRing {
          from {
            transform:
              rotate(
                0deg
              );
          }

          to {
            transform:
              rotate(
                360deg
              );
          }
        }

        .character-ring {
          animation:
            characterRing
            18s
            linear
            infinite;
        }

        .character-ring-reverse {
          animation:
            characterRing
            11s
            linear
            infinite
            reverse;
        }

      `}</style>

    </main>
  );
}

function ItemImage({
  item,
  alt,
  className,
}: {
  item: ItemImageSource;
  alt: string;
  className: string;
}) {
  const snapshotUrl =
    typeof item.thumbnail_url_snapshot ===
      "string"
      ? item.thumbnail_url_snapshot.trim()
      : "";

  const fallbackUrl =
    productImages[
      item.grade
    ];

  const initialUrl =
    snapshotUrl ||
    fallbackUrl;

  return (
    <img
      src={
        initialUrl
      }
      alt={
        alt
      }
      className={
        className
      }
      loading="lazy"
      decoding="async"
      onError={(
        event
      ) => {
        const image =
          event.currentTarget;

        if (
          image.dataset
            .fallbackApplied ===
          "1"
        ) {
          return;
        }

        image.dataset.fallbackApplied =
          "1";

        image.src =
          fallbackUrl;
      }}
    />
  );
}

function CharacterEquipmentSlot({
  slot,
  entry,
  selected,
  onSelect,
}: {
  slot: PlayerLoadoutSlot;
  entry: EquipmentEntry | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const item =
    entry?.item ??
    null;

  const upgradeLevel =
    Number(
      item?.upgrade_level ??
        0
    );

  return (
    <button
      type="button"
      onClick={
        onSelect
      }
      className={`
        group
        relative
        w-full
        min-h-[124px]
        overflow-hidden
        rounded-xl
        border
        bg-black/80
        px-3
        py-2.5
        text-left
        backdrop-blur-xl
        transition
        ${
          selected
            ? "border-cyan-400/70 bg-cyan-400/[0.08] shadow-[0_0_18px_rgba(34,211,238,0.12)]"
            : item
            ? `${gradeBorder[item.grade]} hover:border-cyan-400/40`
            : "border-zinc-800 hover:border-zinc-600"
        }
      `}
    >

      <div className="flex items-center justify-between gap-1">

        <div>

          <p
            className={
              selected
                ? "text-[9px] font-black tracking-[0.12em] text-cyan-400"
                : "text-[9px] font-black tracking-[0.12em] text-zinc-400"
            }
          >
            {
              slot
            }
          </p>

          <p className="mt-0.5 text-[7px] text-zinc-500">
            {
              slotSubLabel[
                slot
              ]
            }
          </p>

        </div>

        {item && (
          <span
            className={
              upgradeLevel >
              0
                ? "text-[8px] font-black text-lime-400"
                : "text-[8px] font-black text-zinc-500"
            }
          >
            +
            {
              upgradeLevel
            }
          </span>
        )}

      </div>

      {item ? (
        <>

          <div className="mt-1.5 flex h-[58px] items-center justify-center">

            <ItemImage
              item={
                item
              }
              alt={
                item.product
              }
              className="h-full w-full scale-[1.1] object-contain"
            />

          </div>

          <p
            className={`mt-1 truncate text-[8px] font-black ${gradeText[item.grade]}`}
          >
            {
              item.grade
            }
          </p>

          <p className="mt-0.5 truncate text-[8px] font-black text-white">
            {
              item.product
            }
          </p>

        </>
      ) : (
        <div className="flex min-h-[80px] flex-col items-center justify-center">

          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-[16px] font-black text-zinc-700 transition group-hover:border-zinc-500">
            +
          </div>

          <p className="mt-2 text-[8px] font-black text-zinc-500">
            EMPTY
          </p>

        </div>
      )}

      {selected && (
        <div className="absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
      )}

    </button>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/75 p-4">

      <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
        {label}
      </p>

      <p
        className={`mt-1.5 text-2xl font-black ${className}`}
      >
        {value}
      </p>

    </div>
  );
}

function InfoBox({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/40 px-2 py-1.5">

      <p className="text-zinc-600 text-[6px] tracking-[0.12em]">
        {label}
      </p>

      <p
        className={`mt-0.5 text-[9px] font-black ${className}`}
      >
        {value}
      </p>

    </div>
  );
}

function MiniBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-black/50 px-2 py-1.5">

      <p className="text-[7px] text-zinc-500">
        {label}
      </p>

      <p className="mt-0.5 text-[9px] font-black text-white">
        {value}
      </p>

    </div>
  );
}

function SideStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="w-[80px] rounded-xl border border-zinc-800 bg-black/70 p-2.5 backdrop-blur-xl">

      <p className="text-zinc-600 text-[7px]">
        {label}
      </p>

      <p
        className={`mt-1 text-[12px] font-black ${className}`}
      >
        {value}
      </p>

    </div>
  );
}

function Rate({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/40 px-2 py-1.5 text-center">

      <p className="text-zinc-600 text-[6px]">
        {label}
      </p>

      <p
        className={`mt-0.5 text-[10px] font-black ${className}`}
      >
        {value}%
      </p>

    </div>
  );
}