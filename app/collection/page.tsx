"use client";

import Image from "next/image";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

// =====================================
// TYPES
// =====================================

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type ProductionStatus =
  | "CRAFTED"
  | "PRODUCTION"
  | "QC"
  | "PACKING"
  | "SHIPPED"
  | "DELIVERED";

type Item = {
  id: number;
  serial: string;
  product: string;
  season: string;
  grade: Grade;
  level: number;
  size: string | null;
  created_at: string;

  production_status:
    ProductionStatus;

  tracking_number:
    string | null;

  production_updated_at:
    string;

  shipping_address_id:
    number | null;

  /* ===================================
     IMMUTABLE ITEM ARTWORK SNAPSHOT
  =================================== */

  thumbnail_url_snapshot:
    string | null;

  /* ===================================
     CRAFTED SHIRT GAME STATS SNAPSHOT
  =================================== */

  hp_bonus_snapshot:
    number | null;

  attack_bonus_snapshot:
    number | null;

  defense_bonus_snapshot:
    number | null;

  luck_bonus_snapshot:
    number | null;

  heal_bonus_snapshot:
    number | null;

  vision_bonus_snapshot:
    number | null;

  mp_bonus_snapshot:
    number | null;

  mat_bonus_snapshot:
    number | null;

  mdf_bonus_snapshot:
    number | null;

  agi_bonus_snapshot:
    number | null;

  power_score_snapshot:
    number | null;

  ability_code_snapshot:
    string | null;

  ability_config_snapshot:
    Record<string, unknown> | null;

  bonus_ability_code_snapshot:
    string | null;

  bonus_ability_config_snapshot:
    Record<string, unknown> | null;
};

type ShippingAddress = {
  id: number;
  user_id: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string | null;
  district: string | null;
  province: string;
  postal_code: string;
  note: string | null;
  is_default: boolean;
};

// =====================================
// PRODUCT IMAGE
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

// =====================================
// GRADE TEXT
// =====================================

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

// =====================================
// GRADE BORDER
// =====================================

const gradeBorder: Record<
  Grade,
  string
> = {
  COMMON:
    "border-zinc-700",

  RARE:
    "border-cyan-400/50",

  EPIC:
    "border-purple-400/50",

  LEGENDARY:
    "border-orange-400/50",
};

// =====================================
// PRODUCTION STEPS
// =====================================

const productionSteps:
  ProductionStatus[] = [
    "CRAFTED",
    "PRODUCTION",
    "QC",
    "PACKING",
    "SHIPPED",
    "DELIVERED",
  ];

// =====================================
// PAGE
// =====================================

export default function CollectionPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    items,
    setItems,
  ] =
    useState<Item[]>([]);

  const [
    addresses,
    setAddresses,
  ] =
    useState<
      ShippingAddress[]
    >([]);

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
    selectingItem,
    setSelectingItem,
  ] =
    useState<Item | null>(
      null
    );

  const [
    selectedAddressId,
    setSelectedAddressId,
  ] =
    useState<number | null>(
      null
    );

  const [
    savingShipping,
    setSavingShipping,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    equippedItemId,
    setEquippedItemId,
  ] =
    useState<number | null>(
      null
    );

  const [
    equippingItemId,
    setEquippingItemId,
  ] =
    useState<number | null>(
      null
    );

  // =====================================
  // LOAD COLLECTION
  // =====================================

  useEffect(() => {
    loadCollection();
  }, []);

  async function loadCollection() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
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

      setUserEmail(
        user.email ??
          "PLAYER"
      );

      // =====================================
      // WALLET
      // =====================================

      const {
        data: wallet,
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

      setWalletBalance(
        wallet?.balance ??
          0
      );

      // =====================================
      // ITEMS
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
            production_status,
            tracking_number,
            production_updated_at,
            shipping_address_id,
            thumbnail_url_snapshot,
            hp_bonus_snapshot,
            attack_bonus_snapshot,
            defense_bonus_snapshot,
            luck_bonus_snapshot,
            heal_bonus_snapshot,
            vision_bonus_snapshot,
            mp_bonus_snapshot,
            mat_bonus_snapshot,
            mdf_bonus_snapshot,
            agi_bonus_snapshot,
            power_score_snapshot,
            ability_code_snapshot,
            ability_config_snapshot,
            bonus_ability_code_snapshot,
            bonus_ability_config_snapshot
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

      if (itemError) {
        throw itemError;
      }

      setItems(
        (itemData ??
          []) as Item[]
      );

      // =====================================
      // PLAYER PROFILE / EQUIPPED ITEM
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
          .select(
            "equipped_item_id"
          )
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

      setEquippedItemId(
        profileData
          ?.equipped_item_id ??
          null
      );

      // =====================================
      // SHIPPING ADDRESSES
      // =====================================

      const {
        data:
          addressData,

        error:
          addressError,
      } =
        await supabase
          .from(
            "shipping_addresses"
          )
          .select(`
            id,
            user_id,
            recipient_name,
            phone,
            address_line,
            subdistrict,
            district,
            province,
            postal_code,
            note,
            is_default
          `)
          .eq(
            "user_id",
            user.id
          )
          .order(
            "is_default",
            {
              ascending:
                false,
            }
          )
          .order(
            "id",
            {
              ascending:
                false,
            }
          );

      if (
        addressError
      ) {
        throw addressError;
      }

      setAddresses(
        (addressData ??
          []) as ShippingAddress[]
      );
    } catch (error) {
      console.error(
        "COLLECTION ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to load collection"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================
  // STATS
  // =====================================

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
    }, [items]);

  // =====================================
  // PROGRESS
  // =====================================

  function getProgress(
    status:
      ProductionStatus
  ) {
    const index =
      productionSteps.indexOf(
        status
      );

    return (
      ((index + 1) /
        productionSteps.length) *
      100
    );
  }

  // =====================================
  // ADDRESS HELPER
  // =====================================

  function getAddressById(
    id:
      number | null
  ) {
    if (!id) {
      return null;
    }

    return (
      addresses.find(
        (address) =>
          address.id ===
          id
      ) ?? null
    );
  }

  // =====================================
  // OPEN SHIPPING SELECTOR
  // =====================================

  function openShippingSelector(
    item: Item
  ) {
    setErrorMessage("");
    setSuccessMessage("");

    if (
      addresses.length ===
      0
    ) {
      router.push(
        "/shipping"
      );

      return;
    }

    setSelectingItem(
      item
    );

    if (
      item.shipping_address_id
    ) {
      setSelectedAddressId(
        item.shipping_address_id
      );
    } else {
      const defaultAddress =
        addresses.find(
          (address) =>
            address.is_default
        );

      setSelectedAddressId(
        defaultAddress?.id ??
          addresses[0]?.id ??
          null
      );
    }
  }

  // =====================================
  // CLOSE SELECTOR
  // =====================================

  function closeShippingSelector() {
    if (
      savingShipping
    ) {
      return;
    }

    setSelectingItem(
      null
    );

    setSelectedAddressId(
      null
    );
  }

  // =====================================
  // SAVE ITEM SHIPPING
  // =====================================

  async function saveItemShipping() {
    if (
      savingShipping ||
      !selectingItem ||
      !selectedAddressId
    ) {
      return;
    }

    setSavingShipping(
      true
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push(
          "/login"
        );

        return;
      }

      const response =
        await fetch(
          "/api/items/shipping",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify(
                {
                  itemId:
                    selectingItem.id,

                  addressId:
                    selectedAddressId,
                }
              ),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.message ||
            "Unable to save shipping address"
        );
      }

      setItems(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              selectingItem.id
                ? {
                    ...item,

                    shipping_address_id:
                      selectedAddressId,
                  }
                : item
          )
      );

      setSuccessMessage(
        `${selectingItem.serial} บันทึกที่อยู่จัดส่งเรียบร้อยแล้ว`
      );

      closeShippingSelector();
    } catch (error) {
      console.error(
        "SAVE ITEM SHIPPING ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "ไม่สามารถบันทึกที่อยู่จัดส่งได้"
      );
    } finally {
      setSavingShipping(
        false
      );
    }
  }

  // =====================================
  // EQUIP ITEM
  // =====================================

  async function equipItem(
    item: Item
  ) {
    if (
      equippingItemId
    ) {
      return;
    }

    setEquippingItemId(
      item.id
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push(
          "/login"
        );

        return;
      }

      const response =
        await fetch(
          "/api/profile/equip",
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
                itemId:
                  item.id,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.message ||
            "Unable to Equip Item"
        );
      }

      setEquippedItemId(
        item.id
      );

      setSuccessMessage(
        `${item.serial} EQUIPPED TO CHARACTER`
      );
    } catch (error) {
      console.error(
        "EQUIP ITEM ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to Equip Item"
      );
    } finally {
      setEquippingItemId(
        null
      );
    }
  }

  // =====================================
  // UNEQUIP ITEM
  // =====================================

  async function unequipItem(
    item: Item
  ) {
    if (
      equippingItemId
    ) {
      return;
    }

    setEquippingItemId(
      item.id
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push(
          "/login"
        );

        return;
      }

      const response =
        await fetch(
          "/api/profile/equip",
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.message ||
            "Unable to Unequip Item"
        );
      }

      setEquippedItemId(
        null
      );

      setSuccessMessage(
        `${item.serial} REMOVED FROM CHARACTER`
      );
    } catch (error) {
      console.error(
        "UNEQUIP ITEM ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to Unequip Item"
      );
    } finally {
      setEquippingItemId(
        null
      );
    }
  }

  // =====================================
  // LOADING
  // =====================================

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-cyan-400 tracking-[0.35em] animate-pulse">
            LOADING
            COLLECTION...
          </p>
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

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">

        {/* =====================================
            PLAYER BAR
        ===================================== */}

        <div className="flex items-center justify-between gap-5 flex-wrap">

          <div className="flex items-center gap-3">

            <div className="w-11 h-11 rounded-xl border border-cyan-400/30 bg-cyan-400/5 flex items-center justify-center text-cyan-400 font-black">
              P1
            </div>

            <div>

              <p className="text-zinc-600 text-[9px] tracking-[0.25em]">
                PLAYER
              </p>

              <p className="text-cyan-400 text-sm mt-1">
                {userEmail}
              </p>

            </div>

          </div>

          <div className="flex items-center gap-3 flex-wrap">

            <button
              onClick={() =>
                router.push(
                  "/profile"
                )
              }
              className="
                border
                border-purple-400/20
                bg-purple-400/[0.03]
                text-purple-400
                rounded-xl
                px-5
                py-3
                text-xs
                font-black
                hover:border-purple-400
                transition
              "
            >
              CHARACTER
            </button>

            <button
              onClick={() =>
                router.push(
                  "/shipping"
                )
              }
              className="
                border
                border-cyan-400/20
                bg-cyan-400/[0.03]
                text-cyan-400
                rounded-xl
                px-5
                py-3
                text-xs
                font-black
                hover:border-cyan-400
                transition
              "
            >
              SHIPPING
            </button>

            <button
              onClick={() =>
                router.push(
                  "/wallet"
                )
              }
              className="border border-zinc-800 bg-black/40 rounded-xl px-5 py-3"
            >
              <p className="text-zinc-600 text-[8px]">
                WALLET
              </p>

              <p className="text-lime-400 font-black">
                {
                  walletBalance
                }{" "}
                LT
              </p>
            </button>

            <button
              onClick={() =>
                router.push(
                  "/craft"
                )
              }
              className="border border-zinc-800 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
            >
              CRAFT NEW ITEM
            </button>

          </div>

        </div>

        {/* =====================================
            MESSAGE
        ===================================== */}

        {errorMessage && (
          <div
            className="
              mt-6
              border
              border-red-400/30
              bg-red-400/[0.07]
              text-red-400
              rounded-xl
              p-5
            "
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="
              mt-6
              border
              border-lime-400/30
              bg-lime-400/[0.07]
              text-lime-400
              rounded-xl
              p-5
            "
          >
            ✓{" "}
            {
              successMessage
            }
          </div>
        )}

        {/* =====================================
            TITLE
        ===================================== */}

        <section className="text-center mt-12">

          <p className="text-purple-400 text-[9px] tracking-[0.35em]">
            PLAYER INVENTORY
          </p>

          <h1 className="text-5xl sm:text-7xl font-black mt-4">
            MY{" "}
            <span className="text-cyan-400">
              COLLECTION
            </span>
          </h1>

        </section>

        {/* =====================================
            STATS
        ===================================== */}

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-10">

          <CollectionStat
            label="TOTAL"
            value={
              stats.total
            }
            className="text-white"
          />

          <CollectionStat
            label="COMMON"
            value={
              stats.COMMON
            }
            className="text-zinc-200"
          />

          <CollectionStat
            label="RARE"
            value={
              stats.RARE
            }
            className="text-cyan-400"
          />

          <CollectionStat
            label="EPIC"
            value={
              stats.EPIC
            }
            className="text-purple-400"
          />

          <CollectionStat
            label="LEGENDARY"
            value={
              stats.LEGENDARY
            }
            className="text-orange-400"
          />

        </section>

        {/* =====================================
            EMPTY COLLECTION
        ===================================== */}

        {items.length ===
          0 && (
          <section
            className="
              mt-8
              border
              border-zinc-800
              bg-zinc-950/70
              rounded-[26px]
              p-12
              text-center
            "
          >
            <p className="text-zinc-500">
              ยังไม่มี Item ใน Collection
            </p>

            <button
              onClick={() =>
                router.push(
                  "/craft"
                )
              }
              className="
                mt-5
                bg-lime-400
                text-black
                px-6
                py-3
                rounded-xl
                font-black
              "
            >
              CRAFT FIRST ITEM
            </button>
          </section>
        )}

        {/* =====================================
            ITEM GRID
        ===================================== */}

        <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">

          {items.map(
            (item) => {
              const progress =
                getProgress(
                  item.production_status ??
                    "CRAFTED"
                );

              const
                shippingAddress =
                  getAddressById(
                    item.shipping_address_id
                  );

              const
                shippingLocked =
                  item.production_status ===
                    "SHIPPED" ||
                  item.production_status ===
                    "DELIVERED";

              const
                isEquipped =
                  equippedItemId ===
                  item.id;

              const
                isEquipping =
                  equippingItemId ===
                  item.id;

              return (
                <article
                  key={
                    item.id
                  }
                  className={`
                    border
                    rounded-[26px]
                    bg-zinc-950/75
                    p-5
                    ${
                      gradeBorder[
                        item.grade
                      ]
                    }
                  `}
                >

                  {/* GRADE */}

                  <div className="flex items-start justify-between">

                    <div>

                      <p className="text-zinc-600 text-[8px]">
                        RARITY
                      </p>

                      <p
                        className={`
                          text-xl
                          font-black
                          mt-1
                          ${
                            gradeText[
                              item.grade
                            ]
                          }
                        `}
                      >
                        {
                          item.grade
                        }
                      </p>

                    </div>

                    <div className="flex items-center gap-2">

                      {isEquipped && (
                        <div className="border border-purple-400/30 bg-purple-400/[0.07] text-purple-400 rounded-full px-3 py-1.5 text-[8px] font-black shadow-[0_0_20px_rgba(192,132,252,0.08)]">
                          ✓ EQUIPPED
                        </div>
                      )}

                      <div className="border border-lime-400/20 bg-lime-400/5 text-lime-400 rounded-full px-3 py-1.5 text-[8px] font-black">
                        OWNED
                      </div>

                    </div>

                  </div>

                  {/* PRODUCT IMAGE

                      New items use the immutable artwork URL
                      saved at Craft time.

                      Legacy items without a snapshot fall back
                      to the original local Grade image.
                  */}

                  <div className="h-[280px] mt-2">

                    <CollectionItemImage
                      item={
                        item
                      }
                    />

                  </div>

                  {/* PRODUCT */}

                  <div className="text-center">

                    <p className="text-white text-xl font-black">
                      {
                        item.product
                      }
                    </p>

                    <p className="text-zinc-600 text-[9px] mt-2">
                      SEASON{" "}
                      {
                        item.season
                      }
                    </p>

                  </div>

                  {/* ITEM ID */}

                  <div className="mt-5 border border-zinc-800 bg-black/50 rounded-xl p-4">

                    <p className="text-zinc-600 text-[8px]">
                      ITEM ID
                    </p>

                    <p className="text-cyan-400 font-mono font-bold mt-2">
                      {
                        item.serial
                      }
                    </p>

                  </div>

                  {/* =====================================
                      CRAFTED SHIRT GAME STATS
                  ===================================== */}

                  <ItemGameStatsPanel
                    item={
                      item
                    }
                  />

                  {/* ITEM INFO */}

                  <div className="grid grid-cols-3 gap-2 mt-2">

                    <MiniInfo
                      label="SIZE"
                      value={
                        item.size ??
                        "-"
                      }
                    />

                    <MiniInfo
                      label="LEVEL"
                      value={`LVL ${String(
                        item.level
                      ).padStart(
                        2,
                        "0"
                      )}`}
                    />

                    <MiniInfo
                      label="DROP"
                      value={
                        item.season
                      }
                    />

                  </div>

                  {/* =====================================
                      CHARACTER EQUIP
                  ===================================== */}

                  <div
                    className={`
                      mt-4
                      border
                      rounded-xl
                      p-4

                      ${
                        isEquipped
                          ? "border-purple-400/30 bg-purple-400/[0.05]"
                          : "border-zinc-800 bg-black/40"
                      }
                    `}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="text-purple-400 text-[8px] tracking-[0.18em]">
                          CHARACTER LOADOUT
                        </p>

                        <p className="text-white text-sm font-black mt-2">
                          {isEquipped
                            ? "ACTIVE ITEM"
                            : "NOT EQUIPPED"}
                        </p>

                      </div>

                      {isEquipped && (
                        <span className="text-purple-400 text-lg font-black">
                          ✓
                        </span>
                      )}

                    </div>

                    <button
                      onClick={() =>
                        isEquipped
                          ? unequipItem(
                              item
                            )
                          : equipItem(
                              item
                            )
                      }
                      disabled={
                        equippingItemId !==
                        null
                      }
                      className={`
                        w-full
                        mt-4
                        py-3
                        rounded-xl
                        text-xs
                        font-black
                        transition

                        ${
                          isEquipped
                            ? "border border-purple-400/30 bg-purple-400/[0.05] text-purple-400 hover:bg-purple-400/[0.10]"
                            : "bg-purple-400 text-black hover:bg-purple-300"
                        }

                        ${
                          equippingItemId !==
                          null
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }
                      `}
                    >
                      {isEquipping
                        ? "UPDATING..."
                        : isEquipped
                        ? "UNEQUIP FROM CHARACTER"
                        : "EQUIP TO CHARACTER"}
                    </button>

                    {isEquipped && (
                      <button
                        onClick={() =>
                          router.push(
                            "/profile"
                          )
                        }
                        className="w-full mt-2 border border-zinc-800 text-zinc-400 py-3 rounded-xl text-[10px] font-black hover:border-cyan-400 hover:text-cyan-400 transition"
                      >
                        VIEW CHARACTER
                      </button>
                    )}

                  </div>

                  {/* =====================================
                      SHIPPING
                  ===================================== */}

                  <div
                    className={`
                      mt-4
                      border
                      rounded-xl
                      p-4

                      ${
                        shippingAddress
                          ? "border-lime-400/20 bg-lime-400/[0.03]"
                          : "border-orange-400/20 bg-orange-400/[0.03]"
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-4">

                      <div>
                        <p
                          className={`
                            text-[8px]
                            tracking-[0.18em]

                            ${
                              shippingAddress
                                ? "text-lime-400"
                                : "text-orange-400"
                            }
                          `}
                        >
                          SHIPPING
                        </p>

                        {shippingAddress ? (
                          <>
                            <p className="text-white text-sm font-black mt-2">
                              {
                                shippingAddress.recipient_name
                              }
                            </p>

                            <p className="text-zinc-500 text-xs mt-1">
                              {
                                shippingAddress.province
                              }{" "}
                              {
                                shippingAddress.postal_code
                              }
                            </p>
                          </>
                        ) : (
                          <p className="text-orange-300 text-xs font-bold mt-2">
                            ยังไม่ได้เลือกที่อยู่จัดส่ง
                          </p>
                        )}
                      </div>

                      {shippingAddress && (
                        <span
                          className="
                            text-lime-400
                            text-lg
                            font-black
                          "
                        >
                          ✓
                        </span>
                      )}

                    </div>

                    {shippingAddress && (
                      <div
                        className="
                          mt-4
                          border-t
                          border-zinc-800
                          pt-3
                        "
                      >
                        <p className="text-zinc-500 text-xs leading-6">
                          {
                            shippingAddress.address_line
                          }

                          {shippingAddress.subdistrict
                            ? ` ต.${shippingAddress.subdistrict}`
                            : ""}

                          {shippingAddress.district
                            ? ` อ.${shippingAddress.district}`
                            : ""}

                          {` จ.${shippingAddress.province}`}

                          {` ${shippingAddress.postal_code}`}
                        </p>

                        <p className="text-zinc-600 text-xs mt-2">
                          TEL:{" "}
                          {
                            shippingAddress.phone
                          }
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() =>
                        openShippingSelector(
                          item
                        )
                      }
                      disabled={
                        shippingLocked
                      }
                      className={`
                        w-full
                        mt-4
                        py-3
                        rounded-xl
                        text-xs
                        font-black
                        transition

                        ${
                          shippingLocked
                            ? `
                              border
                              border-zinc-800
                              text-zinc-700
                              cursor-not-allowed
                            `
                            : shippingAddress
                            ? `
                              border
                              border-cyan-400/25
                              text-cyan-400
                              hover:border-cyan-400
                            `
                            : `
                              bg-orange-400
                              text-black
                              hover:bg-orange-300
                            `
                        }
                      `}
                    >
                      {shippingLocked
                        ? "SHIPPING LOCKED"
                        : shippingAddress
                        ? "เปลี่ยนที่อยู่จัดส่ง"
                        : "เลือกที่อยู่จัดส่ง"}
                    </button>

                  </div>

                  {/* =====================================
                      PRODUCTION
                  ===================================== */}

                  <div className="mt-4 border border-zinc-800 bg-black/50 rounded-xl p-4">

                    <div className="flex justify-between">

                      <div>

                        <p className="text-zinc-600 text-[8px]">
                          PRODUCTION
                        </p>

                        <p className="text-white text-sm font-black mt-1">
                          {
                            item.production_status
                          }
                        </p>

                      </div>

                      <p className="text-cyan-400 text-xs font-black">
                        {
                          Math.round(
                            progress
                          )
                        }
                        %
                      </p>

                    </div>

                    <div className="h-1.5 bg-zinc-900 rounded-full mt-4 overflow-hidden">

                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-lime-400"
                        style={{
                          width:
                            `${progress}%`,
                        }}
                      />

                    </div>

                    {(item.production_status ===
                      "SHIPPED" ||
                      item.production_status ===
                        "DELIVERED") && (
                      <div className="mt-4 border-t border-zinc-900 pt-4">

                        <p className="text-zinc-600 text-[8px]">
                          TRACKING
                        </p>

                        <p className="text-lime-400 font-mono text-xs font-black mt-2">
                          {item.tracking_number ??
                            "WAITING"}
                        </p>

                      </div>
                    )}

                  </div>

                </article>
              );
            }
          )}

        </section>

      </div>

      {/* =====================================
          SHIPPING SELECTOR MODAL
      ===================================== */}

      {selectingItem && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            bg-black/80
            backdrop-blur-sm
            flex
            items-center
            justify-center
            p-4
          "
        >
          <div
            className="
              w-full
              max-w-2xl
              max-h-[90vh]
              overflow-y-auto
              border
              border-cyan-400/30
              bg-zinc-950
              rounded-[28px]
              shadow-[0_30px_100px_rgba(0,0,0,0.8)]
            "
          >

            {/* MODAL HEADER */}

            <div
              className="
                sticky
                top-0
                z-10
                border-b
                border-zinc-800
                bg-zinc-950/95
                backdrop-blur-xl
                p-6
              "
            >
              <div className="flex items-start justify-between gap-5">

                <div>

                  <p className="text-cyan-400 text-[8px] tracking-[0.25em]">
                    SELECT SHIPPING
                  </p>

                  <h2 className="text-2xl font-black mt-2">
                    เลือกที่อยู่จัดส่ง
                  </h2>

                  <p className="text-zinc-500 text-xs mt-2 font-mono">
                    {
                      selectingItem.serial
                    }
                  </p>

                </div>

                <button
                  onClick={
                    closeShippingSelector
                  }
                  disabled={
                    savingShipping
                  }
                  className="
                    w-10
                    h-10
                    border
                    border-zinc-800
                    text-zinc-500
                    rounded-xl
                    hover:text-white
                    hover:border-zinc-600
                    disabled:opacity-40
                  "
                >
                  ×
                </button>

              </div>
            </div>

            {/* ADDRESS LIST */}

            <div className="p-6 space-y-3">

              {addresses.map(
                (address) => {
                  const selected =
                    selectedAddressId ===
                    address.id;

                  return (
                    <button
                      key={
                        address.id
                      }
                      onClick={() =>
                        setSelectedAddressId(
                          address.id
                        )
                      }
                      className={`
                        w-full
                        text-left
                        border
                        rounded-2xl
                        p-5
                        transition

                        ${
                          selected
                            ? `
                              border-cyan-400
                              bg-cyan-400/[0.06]
                              shadow-[0_0_30px_rgba(34,211,238,0.05)]
                            `
                            : `
                              border-zinc-800
                              bg-black/40
                              hover:border-zinc-600
                            `
                        }
                      `}
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <div className="flex items-center gap-2 flex-wrap">

                            <p className="text-white font-black">
                              {
                                address.recipient_name
                              }
                            </p>

                            {address.is_default && (
                              <span
                                className="
                                  border
                                  border-lime-400/25
                                  bg-lime-400/[0.05]
                                  text-lime-400
                                  rounded-full
                                  px-2
                                  py-1
                                  text-[7px]
                                  font-black
                                "
                              >
                                DEFAULT
                              </span>
                            )}

                          </div>

                          <p className="text-zinc-500 text-xs mt-2">
                            {
                              address.phone
                            }
                          </p>

                        </div>

                        <div
                          className={`
                            w-5
                            h-5
                            rounded-full
                            border
                            flex
                            items-center
                            justify-center

                            ${
                              selected
                                ? "border-cyan-400"
                                : "border-zinc-700"
                            }
                          `}
                        >
                          {selected && (
                            <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full" />
                          )}
                        </div>

                      </div>

                      <p className="text-zinc-400 text-sm leading-7 mt-4">

                        {
                          address.address_line
                        }

                        {address.subdistrict
                          ? ` ต.${address.subdistrict}`
                          : ""}

                        {address.district
                          ? ` อ.${address.district}`
                          : ""}

                        {` จ.${address.province}`}

                        {` ${address.postal_code}`}

                      </p>

                    </button>
                  );
                }
              )}

              {/* MANAGE ADDRESS */}

              <button
                onClick={() =>
                  router.push(
                    "/shipping"
                  )
                }
                className="
                  w-full
                  border
                  border-dashed
                  border-zinc-700
                  text-zinc-400
                  rounded-2xl
                  p-5
                  text-xs
                  font-black
                  hover:border-cyan-400
                  hover:text-cyan-400
                  transition
                "
              >
                + เพิ่ม / แก้ไข ที่อยู่จัดส่ง
              </button>

            </div>

            {/* MODAL FOOTER */}

            <div
              className="
                sticky
                bottom-0
                border-t
                border-zinc-800
                bg-zinc-950/95
                backdrop-blur-xl
                p-6
              "
            >
              <button
                onClick={
                  saveItemShipping
                }
                disabled={
                  savingShipping ||
                  !selectedAddressId
                }
                className="
                  w-full
                  bg-lime-400
                  text-black
                  py-4
                  rounded-xl
                  font-black
                  hover:bg-lime-300
                  disabled:bg-zinc-800
                  disabled:text-zinc-600
                  transition
                "
              >
                {savingShipping
                  ? "กำลังบันทึก..."
                  : "ยืนยันที่อยู่สำหรับ Item นี้"}
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}

// =====================================
// COLLECTION STAT
// =====================================

function CollectionStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/75 rounded-2xl p-5">

      <p className="text-zinc-600 text-[8px]">
        {label}
      </p>

      <p
        className={`text-3xl font-black mt-2 ${className}`}
      >
        {value}
      </p>

    </div>
  );
}

// =====================================
// ABILITY LABEL
//
// ability_code is data from the Design's game stat profile in the
// database, never a shirt name -- this only maps the fixed, shared
// ability_code enum (spec section 16) to display text.
// =====================================

const ABILITY_LABELS: Record<
  string,
  { name: string; describe: (config: Record<string, unknown>) => string }
> = {
  BERSERK: {
    name: "BERSERK",
    describe: (config) =>
      `Below ${config.hp_threshold_percent ?? 30}% HP: ATK +${config.attack_bonus_percent ?? 0}%`,
  },

  FORTIFIED: {
    name: "FORTIFIED",
    describe: (config) =>
      `Elite Damage Taken -${config.elite_damage_reduction_percent ?? 0}%`,
  },

  TREASURE_HUNTER: {
    name: "TREASURE HUNTER",
    describe: (config) =>
      `Rare Material Drop +${config.rare_material_drop_bonus_percent ?? 0}%`,
  },

  FIELD_MEDIC: {
    name: "FIELD MEDIC",
    describe: (config) =>
      `Potion Heal +${config.potion_heal_bonus_percent ?? 0}%`,
  },

  SCOUT: {
    name: "SCOUT",
    describe: () =>
      "Reveals a wider radius while exploring.",
  },

  ELITE_HUNTER: {
    name: "ELITE HUNTER",
    describe: () =>
      "Deals bonus damage to Elite monsters.",
  },
};

// =====================================
// ITEM GAME STATS PANEL
//
// Crafted Shirt Game Stats -- all values are the frozen snapshot the
// server computed and wrote at Craft time (lootform_craft_atomic).
// Nothing here is computed in the browser.
// =====================================

function ItemGameStatsPanel({
  item,
}: {
  item: Item;
}) {
  const stats = [
    { label: "HP", value: item.hp_bonus_snapshot, suffix: "" },
    { label: "ATK", value: item.attack_bonus_snapshot, suffix: "" },
    { label: "DEF", value: item.defense_bonus_snapshot, suffix: "" },
    { label: "LUCK", value: item.luck_bonus_snapshot, suffix: "%" },
    { label: "HEAL", value: item.heal_bonus_snapshot, suffix: "%" },
    { label: "VISION", value: item.vision_bonus_snapshot, suffix: "" },
    { label: "MP", value: item.mp_bonus_snapshot, suffix: "" },
    { label: "MAT", value: item.mat_bonus_snapshot, suffix: "" },
    { label: "MDF", value: item.mdf_bonus_snapshot, suffix: "" },
    { label: "AGI", value: item.agi_bonus_snapshot, suffix: "" },
  ].filter(
    (stat) => Number(stat.value ?? 0) !== 0
  );

  const ability =
    item.ability_code_snapshot
      ? ABILITY_LABELS[item.ability_code_snapshot]
      : null;

  const bonusAbility =
    item.bonus_ability_code_snapshot
      ? ABILITY_LABELS[item.bonus_ability_code_snapshot]
      : null;

  if (
    stats.length === 0 &&
    !ability &&
    !bonusAbility
  ) {
    return null;
  }

  return (
    <div className="mt-4 border border-zinc-800 bg-black/40 rounded-xl p-4">

      <div className="flex items-center justify-between gap-3">

        <p className="text-zinc-600 text-[8px] tracking-[0.18em]">
          GAME STATS
        </p>

        {item.power_score_snapshot != null && (
          <p className="text-lime-400 text-xs font-black">
            POWER {item.power_score_snapshot}
          </p>
        )}

      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-3">

          {stats.map((stat) => (
            <div
              key={stat.label}
              className="border border-zinc-800 bg-zinc-950/60 rounded-lg px-2 py-2 text-center"
            >

              <p className="text-zinc-600 text-[6px]">
                {stat.label}
              </p>

              <p className="text-cyan-400 text-xs font-black mt-1">
                +{stat.value}{stat.suffix}
              </p>

            </div>
          ))}

        </div>
      )}

      {ability && (
        <div className="mt-3 border border-purple-400/20 bg-purple-400/[0.05] rounded-lg p-3">

          <p className="text-purple-400 text-[7px] tracking-[0.16em]">
            ABILITY
          </p>

          <p className="text-white text-xs font-black mt-1">
            {ability.name}
          </p>

          <p className="text-zinc-500 text-[8px] mt-1">
            {ability.describe(
              item.ability_config_snapshot ?? {}
            )}
          </p>

        </div>
      )}

      {bonusAbility && (
        <div className="mt-3 border border-orange-400/30 bg-orange-400/[0.06] rounded-lg p-3">

          <p className="text-orange-400 text-[7px] tracking-[0.16em]">
            LEGENDARY BONUS ABILITY
          </p>

          <p className="text-white text-xs font-black mt-1">
            {bonusAbility.name}
          </p>

          <p className="text-zinc-500 text-[8px] mt-1">
            {bonusAbility.describe(
              item.bonus_ability_config_snapshot ?? {}
            )}
          </p>

        </div>
      )}

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

      <p className="text-zinc-600 text-[7px]">
        {label}
      </p>

      <p className="text-white text-xs font-black mt-1">
        {value}
      </p>

    </div>
  );
}

// =====================================
// COLLECTION ITEM IMAGE
// =====================================

function CollectionItemImage({
  item,
}: {
  item: Item;
}) {
  const [
    snapshotFailed,
    setSnapshotFailed,
  ] =
    useState(false);

  const snapshotUrl =
    item.thumbnail_url_snapshot
      ?.trim() ??
    "";

  /*
    NEW ITEM:
    Use the exact Grade artwork saved into
    thumbnail_url_snapshot at Craft time.

    Native <img> is intentional here because the
    snapshot URL comes from Supabase Storage and
    does not require Next.js remote image config.
  */

  if (
    snapshotUrl &&
    !snapshotFailed
  ) {
    return (
      <img
        src={
          snapshotUrl
        }
        alt={
          item.product
        }
        onError={() =>
          setSnapshotFailed(
            true
          )
        }
        className="w-full h-full object-contain"
      />
    );
  }

  /*
    LEGACY / RECOVERY FALLBACK:
    - old Item created before snapshot support
    - historical Storage file is unavailable
  */

  return (
    <Image
      src={
        productImages[
          item.grade
        ]
      }
      alt={
        item.product
      }
      width={
        600
      }
      height={
        700
      }
      className="w-full h-full object-contain"
    />
  );
}