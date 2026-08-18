"use client";

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

type ProductionItem = {
  id: number;
  serial: string;
  product: string;
  season: string;
  grade: Grade;
  level: number;
  size: string | null;
  owner_id: string;

  production_status:
    ProductionStatus;

  tracking_number:
    string | null;

  production_updated_at:
    string;

  created_at:
    string;

  shipping_address_id:
    number | null;

  shipping_address:
    ShippingAddress | null;
};

// =====================================
// STATUS ORDER
// =====================================

const statuses:
  ProductionStatus[] = [
    "CRAFTED",
    "PRODUCTION",
    "QC",
    "PACKING",
    "SHIPPED",
    "DELIVERED",
  ];

// =====================================
// GRADE STYLE
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

const gradeBorder: Record<
  Grade,
  string
> = {
  COMMON:
    "border-zinc-700",

  RARE:
    "border-cyan-400/30",

  EPIC:
    "border-purple-400/30",

  LEGENDARY:
    "border-orange-400/30",
};

// =====================================
// PAGE
// =====================================

export default function AdminProductionPage() {
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
    useState<
      ProductionItem[]
    >([]);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      | "ALL"
      | ProductionStatus
    >("ALL");

  const [
    gradeFilter,
    setGradeFilter,
  ] =
    useState<
      | "ALL"
      | Grade
    >("ALL");

  const [
    shippingFilter,
    setShippingFilter,
  ] =
    useState<
      | "ALL"
      | "READY"
      | "WAITING"
    >("ALL");

  const [
    savingId,
    setSavingId,
  ] =
    useState<
      number | null
    >(null);

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

  // =====================================
  // SESSION
  // =====================================

  async function getSessionToken() {
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

      return null;
    }

    return session.access_token;
  }

  // =====================================
  // LOAD
  // =====================================

  async function loadItems() {
    setLoading(true);
    setErrorMessage("");

    try {
      const token =
        await getSessionToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          "/api/admin/production",
          {
            method:
              "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache:
              "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.message ||
            "Unable to load production"
        );
      }

      setItems(
        result.items ??
          []
      );
    } catch (error) {
      console.error(
        "LOAD PRODUCTION ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to load production"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  // =====================================
  // STATS
  // =====================================

  const stats =
    useMemo(() => {
      return {
        total:
          items.length,

        CRAFTED:
          items.filter(
            (item) =>
              item.production_status ===
              "CRAFTED"
          ).length,

        PRODUCTION:
          items.filter(
            (item) =>
              item.production_status ===
              "PRODUCTION"
          ).length,

        QC:
          items.filter(
            (item) =>
              item.production_status ===
              "QC"
          ).length,

        PACKING:
          items.filter(
            (item) =>
              item.production_status ===
              "PACKING"
          ).length,

        SHIPPED:
          items.filter(
            (item) =>
              item.production_status ===
              "SHIPPED"
          ).length,

        DELIVERED:
          items.filter(
            (item) =>
              item.production_status ===
              "DELIVERED"
          ).length,

        SHIPPING_READY:
          items.filter(
            (item) =>
              Boolean(
                item.shipping_address
              )
          ).length,

        SHIPPING_WAITING:
          items.filter(
            (item) =>
              !item.shipping_address
          ).length,
      };
    }, [items]);

  // =====================================
  // FILTER
  // =====================================

  const filteredItems =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return items.filter(
        (item) => {
          const address =
            item.shipping_address;

          const matchSearch =
            !query ||

            item.serial
              .toLowerCase()
              .includes(
                query
              ) ||

            item.product
              .toLowerCase()
              .includes(
                query
              ) ||

            item.owner_id
              .toLowerCase()
              .includes(
                query
              ) ||

            address
              ?.recipient_name
              .toLowerCase()
              .includes(
                query
              ) ||

            address
              ?.phone
              .toLowerCase()
              .includes(
                query
              ) ||

            address
              ?.province
              .toLowerCase()
              .includes(
                query
              );

          const matchStatus =
            statusFilter ===
              "ALL" ||
            item.production_status ===
              statusFilter;

          const matchGrade =
            gradeFilter ===
              "ALL" ||
            item.grade ===
              gradeFilter;

          const matchShipping =
            shippingFilter ===
              "ALL" ||

            (shippingFilter ===
              "READY" &&
              Boolean(
                item.shipping_address
              )) ||

            (shippingFilter ===
              "WAITING" &&
              !item.shipping_address);

          return (
            matchSearch &&
            matchStatus &&
            matchGrade &&
            matchShipping
          );
        }
      );
    }, [
      items,
      search,
      statusFilter,
      gradeFilter,
      shippingFilter,
    ]);

  // =====================================
  // NEXT STATUS
  // =====================================

  function nextStatus(
    current:
      ProductionStatus
  ) {
    const index =
      statuses.indexOf(
        current
      );

    if (
      index === -1 ||
      index >=
        statuses.length - 1
    ) {
      return null;
    }

    return statuses[
      index + 1
    ];
  }

  // =====================================
  // UPDATE
  // =====================================

  async function updateStatus(
    item:
      ProductionItem,

    newStatus:
      ProductionStatus,

    trackingNumber?:
      string
  ) {
    setSavingId(
      item.id
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token =
        await getSessionToken();

      if (!token) {
        return;
      }

      if (
        newStatus !==
          "CRAFTED" &&
        !item.shipping_address
      ) {
        throw new Error(
          `${item.serial} ยังไม่มีที่อยู่จัดส่ง`
        );
      }

      const currentIndex =
        statuses.indexOf(
          item.production_status
        );

      const newIndex =
        statuses.indexOf(
          newStatus
        );

      const sameStatus =
        newStatus ===
        item.production_status;

      const exactlyNext =
        newIndex ===
        currentIndex + 1;

      if (
        !sameStatus &&
        !exactlyNext
      ) {
        const next =
          nextStatus(
            item.production_status
          );

        throw new Error(
          next
            ? `ไม่สามารถข้ามขั้นได้ ขั้นตอนถัดไปของ ${item.serial} คือ ${next}`
            : `${item.serial} อยู่สถานะ DELIVERED แล้ว`
        );
      }

      if (
        newStatus ===
          "SHIPPED" &&
        !trackingNumber?.trim()
      ) {
        throw new Error(
          "กรุณาใส่ Tracking Number ก่อนเปลี่ยนเป็น SHIPPED"
        );
      }

      const response =
        await fetch(
          "/api/admin/production",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify(
                {
                  id:
                    item.id,

                  production_status:
                    newStatus,

                  tracking_number:
                    trackingNumber ??
                    item.tracking_number ??
                    null,
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
            "Unable to update production"
        );
      }

      setItems(
        (current) =>
          current.map(
            (existing) =>
              existing.id ===
              item.id
                ? result.item
                : existing
          )
      );

      setSuccessMessage(
        `${item.serial} → ${newStatus}`
      );
    } catch (error) {
      console.error(
        "UPDATE PRODUCTION ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to update production"
      );
    } finally {
      setSavingId(
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

          <p className="text-orange-400 tracking-[0.35em] animate-pulse">
            LOADING PRODUCTION...
          </p>

        </div>
      </main>
    );
  }

  // =====================================
  // PAGE
  // =====================================

  return (
    <main className="min-h-screen bg-black text-white">

      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* HEADER */}

        <section>

          <p className="text-orange-400 text-[9px] tracking-[0.3em]">
            PHYSICAL PIPELINE
          </p>

          <div className="flex items-end justify-between gap-5 flex-wrap mt-2">

            <div>

              <h1 className="text-4xl sm:text-6xl font-black">
                PRODUCTION{" "}

                <span className="text-orange-400">
                  CONTROL
                </span>
              </h1>

              <p className="text-zinc-500 mt-3">
                Manage physical item production, shipping and delivery.
              </p>

            </div>

            <div className="flex gap-3">

              <button
                onClick={
                  loadItems
                }
                className="border border-zinc-800 px-5 py-3 rounded-xl text-xs font-black hover:border-cyan-400 hover:text-cyan-400"
              >
                REFRESH
              </button>

              <button
                onClick={() =>
                  router.push(
                    "/admin"
                  )
                }
                className="border border-zinc-800 px-5 py-3 rounded-xl text-xs font-black hover:border-orange-400 hover:text-orange-400"
              >
                ← ADMIN
              </button>

            </div>

          </div>

        </section>

        {/* MESSAGE */}

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 border border-lime-400/30 bg-lime-400/[0.07] text-lime-400 rounded-xl p-5">
            ✓ {successMessage}
          </div>
        )}

        {/* STATS */}

        <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3 mt-8">

          <Stat
            label="TOTAL"
            value={stats.total}
            className="text-white"
          />

          <Stat
            label="CRAFTED"
            value={stats.CRAFTED}
            className="text-zinc-300"
          />

          <Stat
            label="PRODUCTION"
            value={
              stats.PRODUCTION
            }
            className="text-cyan-400"
          />

          <Stat
            label="QC"
            value={stats.QC}
            className="text-purple-400"
          />

          <Stat
            label="PACKING"
            value={stats.PACKING}
            className="text-yellow-300"
          />

          <Stat
            label="SHIPPED"
            value={stats.SHIPPED}
            className="text-orange-400"
          />

          <Stat
            label="DELIVERED"
            value={stats.DELIVERED}
            className="text-lime-400"
          />

        </section>

        {/* SHIPPING STATS */}

        <section className="grid sm:grid-cols-2 gap-3 mt-3">

          <div className="border border-lime-400/20 bg-lime-400/[0.03] rounded-xl p-4">

            <p className="text-lime-400 text-[8px] tracking-[0.2em]">
              SHIPPING READY
            </p>

            <p className="text-2xl font-black text-lime-400 mt-2">
              {stats.SHIPPING_READY}
            </p>

          </div>

          <div className="border border-red-400/20 bg-red-400/[0.03] rounded-xl p-4">

            <p className="text-red-400 text-[8px] tracking-[0.2em]">
              WAITING ADDRESS
            </p>

            <p className="text-2xl font-black text-red-400 mt-2">
              {stats.SHIPPING_WAITING}
            </p>

          </div>

        </section>

        {/* FILTER */}

        <section className="grid lg:grid-cols-[1fr_190px_190px_190px] gap-3 mt-6">

          <input
            type="text"
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search serial, product, owner, recipient, phone..."
            className="border border-zinc-800 bg-zinc-950 rounded-xl px-4 py-4 outline-none focus:border-cyan-400"
          />

          <select
            value={statusFilter}
            onChange={(
              event
            ) =>
              setStatusFilter(
                event.target.value as
                  | "ALL"
                  | ProductionStatus
              )
            }
            className="border border-zinc-800 bg-zinc-950 rounded-xl px-4 py-4 outline-none"
          >

            <option value="ALL">
              ALL STATUS
            </option>

            {statuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              )
            )}

          </select>

          <select
            value={gradeFilter}
            onChange={(
              event
            ) =>
              setGradeFilter(
                event.target.value as
                  | "ALL"
                  | Grade
              )
            }
            className="border border-zinc-800 bg-zinc-950 rounded-xl px-4 py-4 outline-none"
          >

            <option value="ALL">
              ALL GRADE
            </option>

            <option value="COMMON">
              COMMON
            </option>

            <option value="RARE">
              RARE
            </option>

            <option value="EPIC">
              EPIC
            </option>

            <option value="LEGENDARY">
              LEGENDARY
            </option>

          </select>

          <select
            value={shippingFilter}
            onChange={(
              event
            ) =>
              setShippingFilter(
                event.target.value as
                  | "ALL"
                  | "READY"
                  | "WAITING"
              )
            }
            className="border border-zinc-800 bg-zinc-950 rounded-xl px-4 py-4 outline-none"
          >

            <option value="ALL">
              ALL SHIPPING
            </option>

            <option value="READY">
              SHIPPING READY
            </option>

            <option value="WAITING">
              WAITING ADDRESS
            </option>

          </select>

        </section>

        {/* ITEMS */}

        <section className="space-y-4 mt-6">

          {filteredItems.length ===
          0 ? (
            <div className="border border-zinc-800 bg-zinc-950/75 rounded-[24px] p-12 text-center text-zinc-600">
              NO PRODUCTION ITEMS
            </div>
          ) : (
            filteredItems.map(
              (item) => {
                const next =
                  nextStatus(
                    item.production_status
                  );

                return (
                  <ProductionCard
                    key={item.id}
                    item={item}
                    next={next}
                    saving={
                      savingId ===
                      item.id
                    }
                    onUpdate={
                      updateStatus
                    }
                  />
                );
              }
            )
          )}

        </section>

      </div>

    </main>
  );
}

// =====================================
// CARD
// =====================================

function ProductionCard({
  item,
  next,
  saving,
  onUpdate,
}: {
  item:
    ProductionItem;

  next:
    | ProductionStatus
    | null;

  saving:
    boolean;

  onUpdate: (
    item:
      ProductionItem,

    status:
      ProductionStatus,

    tracking?:
      string
  ) => Promise<void>;
}) {
  const [
    selectedStatus,
    setSelectedStatus,
  ] =
    useState<
      ProductionStatus
    >(
      item.production_status
    );

  const [
    tracking,
    setTracking,
  ] =
    useState(
      item.tracking_number ??
        ""
    );

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  useEffect(() => {
    setSelectedStatus(
      item.production_status
    );

    setTracking(
      item.tracking_number ??
        ""
    );
  }, [item]);

  const shippingReady =
    Boolean(
      item.shipping_address
    );

  const shippingAddress =
    item.shipping_address;

  // =====================================
  // ALLOWED MANUAL STATUSES
  // =====================================

  const allowedStatuses:
    ProductionStatus[] =
    next
      ? [
          item.production_status,
          next,
        ]
      : [
          item.production_status,
        ];

  // =====================================
  // ADDRESS TEXT
  // =====================================

  function buildAddressText() {
    if (
      !shippingAddress
    ) {
      return "";
    }

    const parts = [
      shippingAddress.address_line,

      shippingAddress.subdistrict
        ? `ต.${shippingAddress.subdistrict}`
        : "",

      shippingAddress.district
        ? `อ.${shippingAddress.district}`
        : "",

      `จ.${shippingAddress.province}`,

      shippingAddress.postal_code,
    ].filter(Boolean);

    return [
      shippingAddress.recipient_name,
      shippingAddress.phone,
      parts.join(" "),
    ].join("\n");
  }

  // =====================================
  // COPY
  // =====================================

  async function copyAddress() {
    const text =
      buildAddressText();

    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        text
      );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(false);
        },
        1800
      );
    } catch (error) {
      console.error(
        "COPY ADDRESS ERROR:",
        error
      );
    }
  }

  const changingForward =
    selectedStatus !==
      item.production_status;

  const manualBlocked =
    changingForward &&
    !shippingReady;

  const nextBlocked =
    Boolean(next) &&
    !shippingReady;

  return (
    <article
      className={`
        border
        bg-zinc-950/75
        rounded-[24px]
        p-5
        ${
          gradeBorder[
            item.grade
          ]
        }
      `}
    >

      <div className="grid xl:grid-cols-[1.15fr_1.15fr_0.8fr_1fr] gap-5">

        {/* ITEM */}

        <div>

          <div className="flex items-start justify-between gap-4">

            <div>

              <p
                className={`
                  text-[9px]
                  font-black
                  tracking-[0.2em]
                  ${
                    gradeText[
                      item.grade
                    ]
                  }
                `}
              >
                {item.grade}
              </p>

              <h3 className="text-xl font-black mt-2">
                {item.product}
              </h3>

              <p className="text-cyan-400 font-mono text-sm mt-2">
                {item.serial}
              </p>

            </div>

            <div className="border border-zinc-800 bg-black/40 rounded-xl px-3 py-2">

              <p className="text-zinc-600 text-[7px]">
                SIZE
              </p>

              <p className="text-white font-black mt-1">
                {item.size ?? "-"}
              </p>

            </div>

          </div>

          <div className="grid sm:grid-cols-3 gap-2 mt-5">

            <MiniInfo
              label="SEASON"
              value={item.season}
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
              label="STATUS"
              value={
                item.production_status
              }
            />

          </div>

        </div>

        {/* SHIPPING */}

        <div
          className={`
            border
            rounded-2xl
            p-5

            ${
              shippingReady
                ? "border-lime-400/25 bg-lime-400/[0.03]"
                : "border-red-400/25 bg-red-400/[0.03]"
            }
          `}
        >

          {shippingReady &&
          shippingAddress ? (
            <>

              <div className="flex items-center justify-between gap-3">

                <div>

                  <p className="text-lime-400 text-[8px] tracking-[0.2em]">
                    SHIPPING READY
                  </p>

                  <p className="text-white font-black mt-2">
                    {shippingAddress.recipient_name}
                  </p>

                </div>

                <span className="border border-lime-400/30 bg-lime-400/[0.08] text-lime-400 rounded-full px-3 py-1 text-[8px] font-black">
                  ✓ READY
                </span>

              </div>

              <p className="text-cyan-400 text-sm font-bold mt-4">
                {shippingAddress.phone}
              </p>

              <p className="text-zinc-300 text-xs leading-6 mt-3">

                {shippingAddress.address_line}

                {shippingAddress.subdistrict
                  ? ` ต.${shippingAddress.subdistrict}`
                  : ""}

                {shippingAddress.district
                  ? ` อ.${shippingAddress.district}`
                  : ""}

                {` จ.${shippingAddress.province}`}

                {` ${shippingAddress.postal_code}`}

              </p>

              {shippingAddress.note && (
                <div className="mt-4 border border-zinc-800 bg-black/40 rounded-xl p-3">

                  <p className="text-zinc-600 text-[7px]">
                    NOTE
                  </p>

                  <p className="text-yellow-200/80 text-xs mt-1">
                    {shippingAddress.note}
                  </p>

                </div>
              )}

              <button
                onClick={
                  copyAddress
                }
                className="w-full mt-4 border border-cyan-400/25 bg-cyan-400/[0.04] text-cyan-400 py-3 rounded-xl text-xs font-black"
              >
                {copied
                  ? "✓ COPIED"
                  : "COPY ADDRESS"}
              </button>

            </>
          ) : (
            <>

              <p className="text-red-400 text-[8px] tracking-[0.2em]">
                WAITING ADDRESS
              </p>

              <p className="text-white font-black mt-3">
                ยังไม่มีที่อยู่จัดส่ง
              </p>

              <p className="text-zinc-600 text-xs mt-2">
                ลูกค้ายังไม่ได้เลือกที่อยู่สำหรับ Item นี้
              </p>

              <div className="mt-5 border border-red-400/20 bg-red-400/[0.04] text-red-400 rounded-xl p-3 text-xs font-bold">
                ⚠ PRODUCTION LOCKED
              </div>

            </>
          )}

        </div>

        {/* MANUAL STATUS */}

        <div>

          <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
            MANUAL STATUS
          </p>

          <select
            value={
              selectedStatus
            }
            onChange={(
              event
            ) =>
              setSelectedStatus(
                event.target.value as
                  ProductionStatus
              )
            }
            className="w-full mt-2 border border-zinc-800 bg-black rounded-xl px-4 py-4 outline-none"
          >

            {allowedStatuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              )
            )}

          </select>

          {next && (
            <p className="text-zinc-600 text-[9px] mt-2">
              NEXT:{" "}
              <span className="text-cyan-400 font-bold">
                {next}
              </span>
            </p>
          )}

          {(selectedStatus ===
            "SHIPPED" ||
            selectedStatus ===
              "DELIVERED") && (
            <input
              type="text"
              value={tracking}
              onChange={(
                event
              ) =>
                setTracking(
                  event.target.value
                )
              }
              placeholder="Tracking number"
              className="w-full mt-3 border border-zinc-800 bg-black rounded-xl px-4 py-4 outline-none focus:border-lime-400"
            />
          )}

          {manualBlocked && (
            <div className="mt-3 border border-red-400/20 bg-red-400/[0.04] text-red-400 rounded-xl p-3 text-[10px]">
              ต้องมีที่อยู่ก่อนเดินสถานะต่อ
            </div>
          )}

          <button
            disabled={
              saving ||
              manualBlocked
            }
            onClick={() =>
              onUpdate(
                item,
                selectedStatus,
                tracking
              )
            }
            className="w-full mt-3 border border-cyan-400/30 bg-cyan-400/[0.05] text-cyan-400 py-3 rounded-xl text-xs font-black disabled:opacity-30"
          >
            {saving
              ? "SAVING..."
              : "SAVE STATUS"}
          </button>

        </div>

        {/* QUICK ACTION */}

        <div className="border border-zinc-800 bg-black/40 rounded-2xl p-5">

          <p className="text-orange-400 text-[8px] tracking-[0.2em]">
            QUICK ACTION
          </p>

          <p className="text-white font-black mt-3">
            {item.production_status}
          </p>

          <div className="h-2 bg-zinc-900 rounded-full overflow-hidden mt-4">

            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-lime-400"
              style={{
                width:
                  `${getProgress(
                    item.production_status
                  )}%`,
              }}
            />

          </div>

          {next ? (
            <>

              <p className="text-zinc-600 text-[9px] mt-4">
                NEXT STEP
              </p>

              <p className="text-orange-400 font-black mt-1">
                {next}
              </p>

              {nextBlocked && (
                <div className="mt-4 border border-red-400/20 bg-red-400/[0.03] text-red-400 rounded-xl p-3 text-[10px] font-bold">
                  WAITING FOR SHIPPING ADDRESS
                </div>
              )}

              <button
                disabled={
                  saving ||
                  nextBlocked
                }
                onClick={() => {

                  if (
                    next ===
                    "SHIPPED"
                  ) {
                    setSelectedStatus(
                      "SHIPPED"
                    );

                    return;
                  }

                  onUpdate(
                    item,
                    next
                  );
                }}
                className="w-full mt-5 bg-orange-400 text-black py-3 rounded-xl text-xs font-black hover:bg-orange-300 disabled:bg-zinc-800 disabled:text-zinc-600"
              >
                {next ===
                "SHIPPED"
                  ? "SET TRACKING FIRST"
                  : `NEXT → ${next}`}
              </button>

            </>
          ) : (
            <div className="mt-5 border border-lime-400/20 bg-lime-400/[0.05] text-lime-400 text-center rounded-xl py-3 text-xs font-black">
              ✓ COMPLETED
            </div>
          )}

        </div>

      </div>

    </article>
  );
}

// =====================================
// PROGRESS
// =====================================

function getProgress(
  status:
    ProductionStatus
) {
  const index =
    statuses.indexOf(
      status
    );

  if (
    index < 0
  ) {
    return 0;
  }

  return (
    ((index + 1) /
      statuses.length) *
    100
  );
}

// =====================================
// STAT
// =====================================

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/75 rounded-xl p-4">

      <p className="text-zinc-600 text-[7px]">
        {label}
      </p>

      <p
        className={`text-2xl font-black mt-2 ${className}`}
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

      <p className="text-zinc-600 text-[7px]">
        {label}
      </p>

      <p className="text-white text-xs font-black mt-1">
        {value}
      </p>

    </div>
  );
}