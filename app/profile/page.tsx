"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

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

type ItemImageSource = {
  grade: Grade;
  thumbnail_url_snapshot: string | null;
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
  size: string | null;
  upgrade_level: number;
  upgrade_exp: number;
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
    items,
    setItems,
  ] =
    useState<Item[]>([]);

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
    equippingItemId,
    setEquippingItemId,
  ] =
    useState<number | null>(
      null
    );

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
  // LOAD EQUIPMENT (HEAD / TOP / BOTTOM)
  // =====================================

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
        id: topItem.id,
        serial: topItem.serial,
        product: topItem.product,
        season: topItem.season,
        grade: topItem.grade,
        level: topItem.level,
        size: topItem.size,

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
    }

    return nextSlots;
  }

  // =====================================
  // EQUIP ITEM
  // =====================================

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
        await supabase.auth.getSession();

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
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                item_id: item.id,
              }),
          }
        );

      const result =
        await response.json();

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
        resolvedSlot === "HEAD" ||
        resolvedSlot === "TOP" ||
        resolvedSlot === "BOTTOM"
      ) {
        setSelectedEquipmentSlot(
          resolvedSlot
        );
      }

      await loadEquipment(
        session.access_token
      );
    } catch (error) {
      console.error(
        "PROFILE EQUIPMENT ERROR:",
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
      // ITEMS (FULL COLLECTION)
      // =====================================

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
              ascending: false,
            }
          );

      if (
        itemError
      ) {
        throw itemError;
      }

      const safeItems =
        (itemData ?? []) as Item[];

      setItems(
        safeItems
      );

      // =====================================
      // EQUIPMENT (HEAD / TOP / BOTTOM)
      // =====================================

      if (session) {
        const nextSlots =
          await loadEquipment(
            session.access_token
          );

        if (
          !nextSlots.TOP &&
          safeProfile.equipped_item_id
        ) {
          const legacyEquipped =
            safeItems.find(
              (item) =>
                item.id ===
                safeProfile.equipped_item_id
            );

          if (
            legacyEquipped
          ) {
            setEquippedItem({
              id: legacyEquipped.id,
              serial: legacyEquipped.serial,
              product: legacyEquipped.product,
              season: legacyEquipped.season,
              grade: legacyEquipped.grade,
              level: legacyEquipped.level,
              size: legacyEquipped.size,

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
      equipmentSlots
        .TOP
        ?.item
        ?.grade ??
      equippedItem?.grade ??
      "COMMON";

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
                  value={`${items.length} ITEMS`}
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
                LOADOUT
            ===================================== */}

            <section className="border border-zinc-800 bg-zinc-950/80 rounded-[28px] p-6">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <p className="text-orange-400 text-[9px] tracking-[0.3em]">
                    CHARACTER EQUIPMENT
                  </p>

                  <h2 className="text-2xl font-black mt-2">
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
                        (slot) =>
                          equipmentSlots[slot]
                            ?.item
                      ).length
                    }
                    /3
                  </p>

                </div>

              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">

                {PLAYER_LOADOUT_SLOTS.map(
                  (slot) => {
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
                        key={slot}
                        type="button"
                        onClick={() =>
                          setSelectedEquipmentSlot(
                            slot
                          )
                        }
                        className={`
                          relative
                          min-h-[132px]
                          overflow-hidden
                          rounded-xl
                          border
                          p-2.5
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
                                text-[8px]
                                font-black
                                tracking-[0.18em]
                                ${
                                  selected
                                    ? "text-cyan-400"
                                    : "text-zinc-400"
                                }
                              `}
                            >
                              {slot}
                            </p>

                            <p className="mt-0.5 text-[6px] text-zinc-700">
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
                                text-[6px]
                                font-black
                                ${
                                  upgradeLevel >
                                  0
                                    ? "border-lime-400/30 bg-lime-400/[0.08] text-lime-400"
                                    : "border-zinc-700 bg-black/50 text-zinc-500"
                                }
                              `}
                            >
                              +{upgradeLevel}
                            </span>
                          )}

                        </div>

                        {item ? (
                          <>

                            <div className="mt-2 flex h-[58px] items-center justify-center">

                              <ItemImage
                                item={item}
                                alt={
                                  item.product
                                }
                                className="h-full w-full scale-[1.12] object-contain"
                              />

                            </div>

                            <p
                              className={`mt-1 truncate text-[7px] font-black ${gradeText[item.grade]}`}
                            >
                              {item.grade}
                            </p>

                            <p className="mt-0.5 truncate text-[8px] font-black text-white">
                              {item.product}
                            </p>

                            {upgradeLevel >
                            0 ? (
                              <p className="mt-0.5 text-[6px] font-black text-lime-400">
                                UPGRADED +
                                {upgradeLevel}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[6px] font-black text-zinc-600">
                                BASE +0
                              </p>
                            )}

                          </>
                        ) : (
                          <div className="mt-4 flex min-h-[74px] flex-col items-center justify-center">

                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-[14px] font-black text-zinc-700">
                              +
                            </div>

                            <p className="mt-2 text-[7px] font-black text-zinc-600">
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

              <div className="mt-4 border-t border-zinc-900 pt-4">

                <div className="flex items-center justify-between gap-4">

                  <div>

                    <p className="text-zinc-600 text-[6px] tracking-[0.18em]">
                      INVENTORY
                    </p>

                    <p className="mt-0.5 text-[10px] font-black text-white">
                      SELECT ITEM FOR{" "}

                      <span className="text-cyan-400">
                        {
                          selectedEquipmentSlot
                        }
                      </span>
                    </p>

                  </div>

                  <p className="text-[7px] text-zinc-600">
                    {
                      compatibleItems.length
                    }{" "}
                    AVAILABLE
                  </p>

                </div>

                {compatibleItems.length ===
                0 ? (
                  <div className="mt-3 flex min-h-[72px] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-black/30">

                    <div className="text-center">

                      <p className="text-[9px] font-black text-zinc-600">
                        NO{" "}
                        {
                          selectedEquipmentSlot
                        }{" "}
                        ITEM
                      </p>

                      <p className="mt-1 text-[6px] text-zinc-700">
                        CRAFT OR COLLECT A COMPATIBLE ITEM
                      </p>

                    </div>

                  </div>
                ) : (
                  <div className="mt-3 grid max-h-[140px] grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4">

                    {compatibleItems.map(
                      (item) => {
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
                            key={item.id}
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
                              min-h-[94px]
                              overflow-hidden
                              rounded-lg
                              border
                              px-2
                              py-1.5
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

                            <div className="relative h-[34px]">

                              <ItemImage
                                item={item}
                                alt={
                                  item.product
                                }
                                className="h-full w-full object-contain"
                              />

                            </div>

                            <div className="mt-1 flex items-center justify-between gap-1">

                              <p
                                className={`text-[6px] font-black ${gradeText[item.grade]}`}
                              >
                                {item.grade}
                              </p>

                              <span
                                className={
                                  item.upgrade_level >
                                  0
                                    ? "text-[6px] font-black text-lime-400"
                                    : "text-[6px] font-black text-zinc-600"
                                }
                              >
                                +
                                {
                                  item.upgrade_level ??
                                  0
                                }
                              </span>

                            </div>

                            <p className="mt-0.5 truncate text-[8px] font-black text-white">
                              {item.product}
                            </p>

                            <p className="mt-0.5 truncate font-mono text-[6px] text-cyan-400">
                              {item.serial}
                            </p>

                            {isEquipped && (
                              <div className="absolute right-1.5 top-1.5 rounded-md bg-lime-400 px-1.5 py-0.5 text-[5px] font-black text-black">
                                EQUIPPED
                              </div>
                            )}

                            {updating && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/80">

                                <p className="text-[7px] font-black text-cyan-400 animate-pulse">
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

              <div className="mt-4">

                {selectedSlotItem ? (
                  <div className="grid items-center gap-3 rounded-xl border border-zinc-800 bg-black/45 p-3 sm:grid-cols-[80px_1fr_auto]">

                    <div className="flex h-[80px] items-center justify-center rounded-lg border border-zinc-800 bg-black/50">

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
                          className={`text-base font-black ${gradeText[selectedSlotItem.grade]}`}
                        >
                          {
                            selectedSlotItem.grade
                          }
                        </p>

                        <span className="rounded-md border border-zinc-700 bg-black/50 px-1.5 py-0.5 text-[6px] font-black text-zinc-500">
                          {
                            selectedEquipmentSlot
                          }
                        </span>

                      </div>

                      <p className="mt-0.5 truncate text-[11px] font-black text-white">
                        {
                          selectedSlotItem.product
                        }
                      </p>

                      <p className="mt-0.5 truncate font-mono text-[7px] text-cyan-400">
                        {
                          selectedSlotItem.serial
                        }
                      </p>

                      <div className="mt-1.5 flex flex-wrap gap-1.5">

                        <MiniInfo
                          label="SIZE"
                          value={
                            selectedSlotItem.size ??
                            "-"
                          }
                        />

                        <MiniInfo
                          label="ITEM LV"
                          value={`${selectedSlotItem.level}`}
                        />

                        <MiniInfo
                          label="SEASON"
                          value={
                            selectedSlotItem.season
                          }
                        />

                      </div>

                    </div>

                    <div className="min-w-[92px] rounded-xl border border-lime-400/20 bg-lime-400/[0.04] px-3 py-2 text-center">

                      <p className="text-[6px] tracking-[0.12em] text-zinc-600">
                        UPGRADE
                      </p>

                      <p className="mt-1 text-xl font-black text-lime-400">
                        +
                        {Number(
                          selectedSlotItem.upgrade_level ??
                            0
                        )}
                      </p>

                      <p
                        className={
                          Number(
                            selectedSlotItem.upgrade_level ??
                              0
                          ) > 0
                            ? "mt-0.5 text-[6px] font-black text-lime-400"
                            : "mt-0.5 text-[6px] font-black text-zinc-600"
                        }
                      >
                        {Number(
                          selectedSlotItem.upgrade_level ??
                            0
                        ) > 0
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
// ITEM IMAGE
// =====================================

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