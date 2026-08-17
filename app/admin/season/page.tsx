"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabase";

import Navbar from "@/components/Navbar";

type SeasonSettings = {
  id: number;

  season_code: string;
  season_name: string;

  product_name: string;

  craft_cost: number;

  common_rate: number;
  rare_rate: number;
  epic_rate: number;
  legendary_rate: number;

  is_active: boolean;

  start_at: string | null;
  end_at: string | null;

  created_at: string;
  updated_at: string;
};

export default function AdminSeasonPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    adminEmail,
    setAdminEmail,
  ] = useState("");

  const [
    season,
    setSeason,
  ] =
    useState<
      SeasonSettings | null
    >(null);

  async function loadSeason() {
    setLoading(true);

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response =
        await fetch(
          "/api/admin/season",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },

            cache: "no-store",
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Unable to load season"
        );
      }

      setAdminEmail(
        result.admin?.email ??
          ""
      );

      setSeason(
        result.season as SeasonSettings
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load season"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSeason();
  }, []);

  const totalOdds =
    useMemo(() => {
      if (!season) {
        return 0;
      }

      return (
        Number(
          season.common_rate
        ) +
        Number(
          season.rare_rate
        ) +
        Number(
          season.epic_rate
        ) +
        Number(
          season.legendary_rate
        )
      );
    }, [season]);

  const seasonStatus =
    useMemo(() => {
      if (!season) {
        return {
          label: "UNKNOWN",
          className:
            "text-zinc-500",
        };
      }

      if (!season.is_active) {
        return {
          label: "INACTIVE",
          className:
            "text-red-400",
        };
      }

      const now =
        Date.now();

      const start =
        season.start_at
          ? new Date(
              season.start_at
            ).getTime()
          : null;

      const end =
        season.end_at
          ? new Date(
              season.end_at
            ).getTime()
          : null;

      if (
        start !== null &&
        now < start
      ) {
        return {
          label: "UPCOMING",
          className:
            "text-cyan-400",
        };
      }

      if (
        end !== null &&
        now >= end
      ) {
        return {
          label: "ENDED",
          className:
            "text-zinc-500",
        };
      }

      return {
        label: "ACTIVE",
        className:
          "text-lime-400",
      };
    }, [season]);

  function updateText(
    key:
      | "season_code"
      | "season_name"
      | "product_name",
    value: string
  ) {
    setSeason(
      (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          [key]: value,
        };
      }
    );

    setSuccessMessage("");
  }

  function updateNumber(
    key:
      | "craft_cost"
      | "common_rate"
      | "rare_rate"
      | "epic_rate"
      | "legendary_rate",
    value: string
  ) {
    const parsed =
      value === ""
        ? 0
        : Number(value);

    setSeason(
      (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          [key]:
            Number.isNaN(parsed)
              ? 0
              : parsed,
        };
      }
    );

    setSuccessMessage("");
  }

  function updateDateTime(
    key:
      | "start_at"
      | "end_at",
    value: string
  ) {
    setSeason(
      (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          [key]:
            value
              ? new Date(
                  value
                ).toISOString()
              : null,
        };
      }
    );

    setSuccessMessage("");
  }

  function toDateTimeLocal(
    value:
      | string
      | null
  ) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    const pad = (
      number: number
    ) =>
      String(number).padStart(
        2,
        "0"
      );

    return [
      date.getFullYear(),
      "-",
      pad(
        date.getMonth() + 1
      ),
      "-",
      pad(
        date.getDate()
      ),
      "T",
      pad(
        date.getHours()
      ),
      ":",
      pad(
        date.getMinutes()
      ),
    ].join("");
  }

  async function saveSeason() {
    if (
      !season ||
      saving
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (
      totalOdds !== 100
    ) {
      setErrorMessage(
        `Grade Odds รวมต้องเท่ากับ 100% ตอนนี้ ${totalOdds}%`
      );

      return;
    }

    if (
      season.start_at &&
      season.end_at
    ) {
      const start =
        new Date(
          season.start_at
        ).getTime();

      const end =
        new Date(
          season.end_at
        ).getTime();

      if (end <= start) {
        setErrorMessage(
          "วันเวลาปิด Season ต้องอยู่หลังวันเวลาเปิด"
        );

        return;
      }
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response =
        await fetch(
          "/api/admin/season",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify(
                season
              ),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Unable to save season"
        );
      }

      setSeason(
        result.season as SeasonSettings
      );

      setSuccessMessage(
        "SEASON SETTINGS SAVED"
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save season"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">

          <p className="text-orange-400 tracking-[0.35em] animate-pulse">
            LOADING SEASON CONTROL...
          </p>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">

      <Navbar />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        <div className="absolute top-[-300px] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full bg-orange-500/10 blur-[180px]" />

        <div className="absolute bottom-[-350px] left-[-250px] w-[700px] h-[700px] rounded-full bg-purple-500/8 blur-[180px]" />

        <div className="absolute bottom-[-350px] right-[-250px] w-[700px] h-[700px] rounded-full bg-cyan-500/8 blur-[180px]" />

      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">

        <section>

          <div className="inline-flex items-center gap-2 border border-orange-400/20 bg-orange-400/5 rounded-full px-4 py-2">

            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />

            <span className="text-orange-400 text-[9px] tracking-[0.3em]">
              DROP CONFIGURATION
            </span>

          </div>

          <div className="flex items-end justify-between gap-6 flex-wrap mt-4">

            <div>

              <p className="text-zinc-600 text-[9px] tracking-[0.3em]">
                LOOTFORM ADMIN
              </p>

              <h1 className="text-4xl sm:text-6xl font-black mt-2">
                SEASON{" "}
                <span className="text-orange-400">
                  CONTROL
                </span>
              </h1>

              <p className="text-zinc-500 text-sm mt-4">
                ADMIN{" "}
                <span className="text-cyan-400">
                  {adminEmail}
                </span>
              </p>

            </div>

            <button
              onClick={() =>
                router.push(
                  "/admin"
                )
              }
              className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-orange-400 hover:text-orange-400 transition"
            >
              ← ADMIN DASHBOARD
            </button>

          </div>

        </section>

        {errorMessage && (
          <div className="mt-7 border border-red-400/30 bg-red-400/[0.07] rounded-xl p-5 text-red-400">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-7 border border-lime-400/30 bg-lime-400/[0.07] rounded-xl p-5 text-lime-400 font-black">
            ✓ {successMessage}
          </div>
        )}

        {season && (
          <>

            <section className="grid md:grid-cols-[1fr_auto] gap-5 items-center mt-9 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">

              <div>

                <p className="text-zinc-600 text-[9px] tracking-[0.25em]">
                  CURRENT DROP
                </p>

                <div className="flex items-center gap-3 flex-wrap mt-2">

                  <h2 className="text-3xl sm:text-4xl font-black">
                    {season.season_name}
                  </h2>

                  <div className="border border-zinc-800 bg-black/50 rounded-full px-3 py-2 text-[9px] font-black">

                    <span
                      className={
                        seasonStatus.className
                      }
                    >
                      ●{" "}
                      {
                        seasonStatus.label
                      }
                    </span>

                  </div>

                </div>

                <p className="text-zinc-500 mt-3">
                  {season.product_name}
                </p>

              </div>

              <div className="border border-zinc-800 bg-black/50 rounded-2xl px-6 py-4">

                <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                  CRAFT COST
                </p>

                <p className="text-lime-400 text-3xl font-black mt-2">
                  {season.craft_cost} LT
                </p>

              </div>

            </section>

            <section className="grid xl:grid-cols-2 gap-6 mt-6">

              <div className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">

                <p className="text-cyan-400 text-[9px] tracking-[0.3em]">
                  DROP IDENTITY
                </p>

                <h2 className="text-2xl font-black mt-2">
                  SEASON SETTINGS
                </h2>

                <div className="mt-6">

                  <FieldLabel>
                    SEASON CODE
                  </FieldLabel>

                  <input
                    value={
                      season.season_code
                    }
                    onChange={(event) =>
                      updateText(
                        "season_code",
                        event.target.value
                      )
                    }
                    className="w-full mt-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-4 text-white outline-none focus:border-cyan-400"
                  />

                </div>

                <div className="mt-4">

                  <FieldLabel>
                    SEASON NAME
                  </FieldLabel>

                  <input
                    value={
                      season.season_name
                    }
                    onChange={(event) =>
                      updateText(
                        "season_name",
                        event.target.value
                      )
                    }
                    className="w-full mt-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-4 text-white outline-none focus:border-cyan-400"
                  />

                </div>

                <div className="mt-4">

                  <FieldLabel>
                    PRODUCT NAME
                  </FieldLabel>

                  <input
                    value={
                      season.product_name
                    }
                    onChange={(event) =>
                      updateText(
                        "product_name",
                        event.target.value
                      )
                    }
                    className="w-full mt-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-4 text-white outline-none focus:border-purple-400"
                  />

                </div>

                <div className="mt-4">

                  <FieldLabel>
                    CRAFT COST
                  </FieldLabel>

                  <input
                    type="number"
                    min="0"
                    value={
                      season.craft_cost
                    }
                    onChange={(event) =>
                      updateNumber(
                        "craft_cost",
                        event.target.value
                      )
                    }
                    className="w-full mt-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-4 text-lime-400 text-xl font-black outline-none focus:border-lime-400"
                  />

                </div>

              </div>

              <div className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">

                <p className="text-orange-400 text-[9px] tracking-[0.3em]">
                  DROP SCHEDULE
                </p>

                <h2 className="text-2xl font-black mt-2">
                  SEASON WINDOW
                </h2>

                <div className="mt-6">

                  <FieldLabel>
                    SEASON START
                  </FieldLabel>

                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(
                      season.start_at
                    )}
                    onChange={(event) =>
                      updateDateTime(
                        "start_at",
                        event.target.value
                      )
                    }
                    className="w-full mt-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-4 text-cyan-400 outline-none focus:border-cyan-400"
                  />

                </div>

                <div className="mt-4">

                  <FieldLabel>
                    SEASON END
                  </FieldLabel>

                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(
                      season.end_at
                    )}
                    onChange={(event) =>
                      updateDateTime(
                        "end_at",
                        event.target.value
                      )
                    }
                    className="w-full mt-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-4 text-orange-400 outline-none focus:border-orange-400"
                  />

                </div>

                <div className="mt-6 border border-zinc-800 bg-black/50 rounded-[22px] p-5">

                  <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                    CURRENT STATUS
                  </p>

                  <p
                    className={`
                      text-2xl
                      font-black
                      mt-2
                      ${seasonStatus.className}
                    `}
                  >
                    {
                      seasonStatus.label
                    }
                  </p>

                  <div className="mt-5 space-y-3">

                    <DateDisplay
                      label="START"
                      value={
                        season.start_at
                      }
                    />

                    <DateDisplay
                      label="END"
                      value={
                        season.end_at
                      }
                    />

                  </div>

                </div>

                <div className="mt-6 border border-zinc-800 rounded-[24px] p-6">

                  <div className="flex items-center justify-between gap-5">

                    <div>

                      <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                        MASTER SWITCH
                      </p>

                      <p
                        className={
                          season.is_active
                            ? "text-lime-400 text-xl font-black mt-2"
                            : "text-red-400 text-xl font-black mt-2"
                        }
                      >
                        {season.is_active
                          ? "DROP ENABLED"
                          : "DROP DISABLED"}
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSeason(
                          (current) =>
                            current
                              ? {
                                  ...current,

                                  is_active:
                                    !current.is_active,
                                }
                              : current
                        )
                      }
                      className={`
                        relative
                        w-[74px]
                        h-[38px]
                        rounded-full

                        ${
                          season.is_active
                            ? "bg-lime-400"
                            : "bg-zinc-800"
                        }
                      `}
                    >

                      <span
                        className={`
                          absolute
                          top-[4px]
                          w-[30px]
                          h-[30px]
                          rounded-full
                          bg-black
                          transition-all

                          ${
                            season.is_active
                              ? "left-[40px]"
                              : "left-[4px]"
                          }
                        `}
                      />

                    </button>

                  </div>

                </div>

              </div>

            </section>

            <section className="mt-6 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">

              <div className="flex items-end justify-between gap-5 flex-wrap">

                <div>

                  <p className="text-purple-400 text-[9px] tracking-[0.3em]">
                    RANDOM ENGINE
                  </p>

                  <h2 className="text-2xl sm:text-3xl font-black mt-2">
                    GRADE ODDS
                  </h2>

                </div>

                <p
                  className={
                    totalOdds === 100
                      ? "text-lime-400 text-2xl font-black"
                      : "text-red-400 text-2xl font-black"
                  }
                >
                  {totalOdds}%
                </p>

              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">

                <OddsInput
                  label="COMMON"
                  value={
                    season.common_rate
                  }
                  accent="text-zinc-200"
                  border="border-zinc-700"
                  onChange={(value) =>
                    updateNumber(
                      "common_rate",
                      value
                    )
                  }
                />

                <OddsInput
                  label="RARE"
                  value={
                    season.rare_rate
                  }
                  accent="text-cyan-400"
                  border="border-cyan-400/30"
                  onChange={(value) =>
                    updateNumber(
                      "rare_rate",
                      value
                    )
                  }
                />

                <OddsInput
                  label="EPIC"
                  value={
                    season.epic_rate
                  }
                  accent="text-purple-400"
                  border="border-purple-400/30"
                  onChange={(value) =>
                    updateNumber(
                      "epic_rate",
                      value
                    )
                  }
                />

                <OddsInput
                  label="LEGENDARY"
                  value={
                    season.legendary_rate
                  }
                  accent="text-orange-400"
                  border="border-orange-400/30"
                  onChange={(value) =>
                    updateNumber(
                      "legendary_rate",
                      value
                    )
                  }
                />

              </div>

              <div className="flex h-3 rounded-full overflow-hidden bg-zinc-900 mt-7">

                <div
                  className="bg-zinc-400"
                  style={{
                    width:
                      `${season.common_rate}%`,
                  }}
                />

                <div
                  className="bg-cyan-400"
                  style={{
                    width:
                      `${season.rare_rate}%`,
                  }}
                />

                <div
                  className="bg-purple-500"
                  style={{
                    width:
                      `${season.epic_rate}%`,
                  }}
                />

                <div
                  className="bg-orange-400"
                  style={{
                    width:
                      `${season.legendary_rate}%`,
                  }}
                />

              </div>

            </section>

            <section className="mt-6 border border-orange-400/20 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">

              <button
                onClick={
                  saveSeason
                }
                disabled={
                  saving ||
                  totalOdds !== 100
                }
                className="
                  w-full
                  min-h-[70px]
                  bg-orange-400
                  text-black
                  rounded-xl
                  px-8
                  font-black
                  hover:bg-orange-300
                  disabled:bg-zinc-800
                  disabled:text-zinc-600
                  transition
                "
              >
                {saving
                  ? "SAVING..."
                  : totalOdds !== 100
                  ? `ODDS = ${totalOdds}%`
                  : "SAVE SEASON SETTINGS"}
              </button>

            </section>

          </>
        )}

      </div>

    </main>
  );
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label className="text-zinc-600 text-[8px] tracking-[0.25em]">
      {children}
    </label>
  );
}

function OddsInput({
  label,
  value,
  accent,
  border,
  onChange,
}: {
  label: string;
  value: number;
  accent: string;
  border: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div
      className={`
        border
        bg-black/40
        rounded-[22px]
        p-5
        ${border}
      `}
    >

      <p
        className={`
          text-[10px]
          font-black
          tracking-[0.2em]
          ${accent}
        `}
      >
        {label}
      </p>

      <div className="relative mt-4">

        <input
          type="number"
          min="0"
          max="100"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className={`
            w-full
            border
            border-zinc-800
            bg-black
            rounded-xl
            px-4
            py-4
            pr-12
            text-3xl
            font-black
            outline-none
            ${accent}
          `}
        />

        <span
          className={`
            absolute
            right-4
            top-1/2
            -translate-y-1/2
            font-black
            ${accent}
          `}
        >
          %
        </span>

      </div>

    </div>
  );
}

function DateDisplay({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border border-zinc-900 rounded-xl px-4 py-3">

      <p className="text-zinc-600 text-[8px]">
        {label}
      </p>

      <p className="text-zinc-300 text-xs font-black text-right">
        {value
          ? new Date(
              value
            ).toLocaleString(
              "th-TH",
              {
                dateStyle:
                  "medium",
                timeStyle:
                  "short",
              }
            )
          : "NOT SET"}
      </p>

    </div>
  );
}