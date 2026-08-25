"use client";

import Image from "next/image";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabase";

type MenuItem = {
  label: string;
  path: string;
  symbol?: string;
  adminOnly?: boolean;
};

export default function Navbar() {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(false);

  const [
    playerOpen,
    setPlayerOpen,
  ] =
    useState(false);

  const [
    isAuthenticated,
    setIsAuthenticated,
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
    isAdmin,
    setIsAdmin,
  ] =
    useState(false);

  // =====================================================
  // MENU
  // =====================================================

  const menus: MenuItem[] = [
    {
      label: "HOME",
      path: "/",
    },

    {
      label: "CATALOG",
      path: "/catalog",
    },

    {
      label: "GAME",
      path: "/game",
      symbol: "✦",
    },

    {
      label: "CRAFT",
      path: "/craft",
    },

    {
      label: "COLLECTION",
      path: "/collection",
    },

    {
      label: "SHIPPING",
      path: "/shipping",
      symbol: "◇",
    },

    {
      label: "WALLET",
      path: "/wallet",
    },

    {
      label: "ADMIN",
      path: "/admin",
      symbol: "◆",
      adminOnly: true,
    },
  ];

  // =====================================================
  // LOAD PLAYER
  // =====================================================

  useEffect(() => {
    async function loadPlayer() {
      const {
        data: {
          session,
        },
      } =
        await supabase
          .auth
          .getSession();

      if (!session) {
        setIsAuthenticated(
          false
        );

        setUserEmail(
          ""
        );

        setWalletBalance(
          0
        );

        setIsAdmin(
          false
        );

        return;
      }

      setIsAuthenticated(
        true
      );

      const user =
        session.user;

      setUserEmail(
        user.email ??
          "PLAYER"
      );

      // =================================================
      // WALLET
      // =================================================

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
          "NAVBAR WALLET ERROR:",
          walletError
        );
      }

      setWalletBalance(
        Number(
          wallet?.balance ??
            0
        )
      );

      // =================================================
      // ADMIN
      // =================================================

      try {
        const response =
          await fetch(
            "/api/admin/check",
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

        const result =
          await response
            .json();

        setIsAdmin(
          response.ok &&
            result.isAdmin ===
              true
        );
      } catch (
        error
      ) {
        console.error(
          "ADMIN CHECK ERROR:",
          error
        );

        setIsAdmin(
          false
        );
      }
    }

    void loadPlayer();
  }, [
    pathname,
  ]);

  // =====================================================
  // VISIBLE MENU
  // =====================================================

  const visibleMenus =
    menus.filter(
      (
        menu
      ) =>
        !menu.adminOnly ||
        isAdmin
    );

  // =====================================================
  // ACTIVE MENU
  // =====================================================

  function isActive(
    path: string
  ) {
    if (
      path ===
      "/"
    ) {
      return (
        pathname ===
        "/"
      );
    }

    return pathname.startsWith(
      path
    );
  }

  // =====================================================
  // NAVIGATION
  // =====================================================

  function goTo(
    path: string
  ) {
    if (
      !isAuthenticated &&
      path !== "/" &&
      path !== "/login" &&
      path !== "/catalog"
    ) {
      setMenuOpen(
        false
      );

      setPlayerOpen(
        false
      );

      router.push(
        "/login"
      );

      return;
    }

    setMenuOpen(
      false
    );

    setPlayerOpen(
      false
    );

    router.push(
      path
    );
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  async function logout() {
    await supabase
      .auth
      .signOut();

    setMenuOpen(
      false
    );

    setPlayerOpen(
      false
    );

    setIsAuthenticated(
      false
    );

    setUserEmail(
      ""
    );

    setWalletBalance(
      0
    );

    setIsAdmin(
      false
    );

    router.push(
      "/login"
    );

    router.refresh();
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <header className="sticky top-0 z-50 w-full border-b border-cyan-400/10 bg-black/90 backdrop-blur-xl">

      {/* TOP GLOW */}

      <div className="absolute left-1/2 top-0 h-[1px] w-[600px] max-w-[80vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_25px_rgba(34,211,238,0.7)]" />

      <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">

        {/* =================================================
            LOGO
        ================================================= */}

        <button
          type="button"
          onClick={() =>
            goTo(
              "/"
            )
          }
          className="group flex shrink-0 items-center gap-3"
        >

          <div className="relative flex h-12 w-12 items-center justify-center">

            <div className="absolute inset-0 rounded-full bg-cyan-400/10 opacity-0 blur-xl transition group-hover:opacity-100" />

            <Image
              src="/logo.png"
              alt="LOOTFORM"
              width={48}
              height={48}
              priority
              className="relative object-contain transition duration-300 group-hover:scale-105"
            />

          </div>

          <div className="hidden text-left sm:block">

            <p className="text-xl font-black tracking-tight text-white">
              LOOTFORM
            </p>

            <p className="text-[8px] tracking-[0.28em] text-cyan-400">
              DIGITAL LOOT
            </p>

          </div>

        </button>

        {/* =================================================
            DESKTOP MENU
        ================================================= */}

        <nav className="hidden items-center gap-1.5 lg:flex">

          {visibleMenus.map(
            (
              menu
            ) => {
              const active =
                isActive(
                  menu.path
                );

              const adminMenu =
                menu.label ===
                "ADMIN";

              const gameMenu =
                menu.label ===
                "GAME";

              return (
                <button
                  key={
                    menu.label
                  }
                  type="button"
                  onClick={() =>
                    goTo(
                      menu.path
                    )
                  }
                  className={`
                    relative
                    rounded-lg
                    border
                    px-3
                    py-2.5
                    text-[11px]
                    font-bold
                    tracking-wide
                    transition-all
                    duration-300

                    ${
                      active &&
                      adminMenu
                        ? `
                          border-orange-400
                          bg-orange-400/10
                          text-orange-400
                          shadow-[0_0_20px_rgba(251,146,60,0.14)]
                        `
                        : active
                        ? `
                          border-cyan-400
                          bg-cyan-400/10
                          text-cyan-400
                          shadow-[0_0_22px_rgba(34,211,238,0.15)]
                        `
                        : adminMenu
                        ? `
                          border-orange-400/25
                          bg-orange-400/[0.03]
                          text-orange-400
                          hover:border-orange-400
                          hover:bg-orange-400/10
                        `
                        : `
                          border-zinc-800
                          text-zinc-500
                          hover:border-zinc-600
                          hover:bg-white/[0.03]
                          hover:text-white
                        `
                    }
                  `}
                >

                  <span className="flex items-center justify-center gap-1.5">

                    {menu.symbol && (
                      <span
                        className={`
                          text-[9px]
                          font-black
                          transition-all
                          duration-300

                          ${
                            active &&
                            gameMenu
                              ? "text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.95)]"
                              : adminMenu
                              ? "text-orange-400"
                              : active
                              ? "text-cyan-400"
                              : "text-zinc-600"
                          }
                        `}
                      >
                        {
                          menu.symbol
                        }
                      </span>
                    )}

                    <span>
                      {
                        menu.label
                      }
                    </span>

                  </span>

                  {/* ACTIVE DOT */}

                  {active && (
                    <span
                      className={`
                        absolute
                        -bottom-[5px]
                        left-1/2
                        h-1
                        w-1
                        -translate-x-1/2
                        rounded-full

                        ${
                          adminMenu
                            ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,1)]"
                            : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)]"
                        }
                      `}
                    />
                  )}

                  {/* GAME EXTRA GLOW */}

                  {active &&
                    gameMenu && (
                      <span className="pointer-events-none absolute inset-x-4 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                    )}

                </button>
              );
            }
          )}

        </nav>

        {/* =================================================
            DESKTOP PLAYER
        ================================================= */}

        <div className="relative hidden items-center gap-3 lg:flex">

          {/* WALLET */}

          <button
            type="button"
            onClick={() =>
              goTo(
                "/wallet"
              )
            }
            className="rounded-xl border border-lime-400/20 bg-lime-400/[0.03] px-4 py-2 text-left transition hover:border-lime-400"
          >

            <p className="text-[8px] tracking-[0.2em] text-zinc-600">
              WALLET
            </p>

            <p className="mt-0.5 text-sm font-black text-lime-400">
              {isAuthenticated
                ? `${walletBalance.toLocaleString()} LT`
                : "LOGIN"}
            </p>

          </button>

          {/* PLAYER */}

          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                goTo(
                  "/login"
                );

                return;
              }

              setPlayerOpen(
                !playerOpen
              );
            }}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 transition hover:border-cyan-400/50"
          >

            <div
              className={`
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-lg
                border
                text-xs
                font-black

                ${
                  isAdmin
                    ? "border-orange-400/40 bg-orange-400/5 text-orange-400"
                    : "border-cyan-400/30 bg-cyan-400/5 text-cyan-400"
                }
              `}
            >
              {isAdmin
                ? "AD"
                : isAuthenticated
                ? "P1"
                : "G"}
            </div>

            <div className="max-w-[150px] text-left">

              <p
                className={`
                  text-[7px]
                  tracking-[0.2em]

                  ${
                    isAdmin
                      ? "text-orange-400"
                      : "text-zinc-600"
                  }
                `}
              >
                {isAdmin
                  ? "ADMIN"
                  : isAuthenticated
                  ? "PLAYER"
                  : "GUEST"}
              </p>

              <p className="mt-1 truncate text-xs text-zinc-300">
                {userEmail ||
                  (isAuthenticated
                    ? "PLAYER"
                    : "SIGN IN")}
              </p>

            </div>

            <span
              className={`
                text-xs
                text-zinc-600
                transition-transform

                ${
                  playerOpen
                    ? "rotate-180"
                    : ""
                }
              `}
            >
              ▼
            </span>

          </button>

          {/* =================================================
              PLAYER DROPDOWN
          ================================================= */}

          {playerOpen && (
            <div className="absolute right-0 top-[58px] w-[260px] rounded-2xl border border-zinc-800 bg-black/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl">

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">

                <div className="flex items-center justify-between gap-3">

                  <p className="text-[8px] tracking-[0.2em] text-zinc-600">
                    PLAYER ACCOUNT
                  </p>

                  {isAdmin && (
                    <span className="rounded-full border border-orange-400/30 bg-orange-400/5 px-2 py-1 text-[7px] font-black text-orange-400">
                      ADMIN
                    </span>
                  )}

                </div>

                <p className="mt-2 break-all text-xs text-cyan-400">
                  {
                    userEmail
                  }
                </p>

                <div className="mt-4 flex items-center justify-between">

                  <p className="text-[9px] text-zinc-600">
                    BALANCE
                  </p>

                  <p className="font-black text-lime-400">
                    {walletBalance.toLocaleString()}{" "}
                    LT
                  </p>

                </div>

              </div>

              {/* GAME HUB */}

              <button
                type="button"
                onClick={() =>
                  goTo(
                    "/game"
                  )
                }
                className="mt-2 w-full rounded-xl border border-transparent px-4 py-3 text-left text-xs font-bold text-zinc-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/5 hover:text-cyan-400"
              >
                <span className="mr-2 text-cyan-400">
                  ✦
                </span>

                GAME HUB
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() =>
                    goTo(
                      "/admin"
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-orange-400/20 bg-orange-400/[0.03] px-4 py-3 text-left text-xs font-black text-orange-400 transition hover:border-orange-400 hover:bg-orange-400/10"
                >
                  ◆ ADMIN DASHBOARD
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  goTo(
                    "/collection"
                  )
                }
                className="mt-2 w-full rounded-xl border border-transparent px-4 py-3 text-left text-xs font-bold text-zinc-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/5 hover:text-cyan-400"
              >
                MY COLLECTION
              </button>

              <button
                type="button"
                onClick={() =>
                  goTo(
                    "/wallet"
                  )
                }
                className="w-full rounded-xl border border-transparent px-4 py-3 text-left text-xs font-bold text-zinc-400 transition hover:border-lime-400/30 hover:bg-lime-400/5 hover:text-lime-400"
              >
                MY WALLET
              </button>

              <div className="my-2 h-[1px] bg-zinc-900" />

              <button
                type="button"
                onClick={
                  logout
                }
                className="w-full rounded-xl border border-transparent px-4 py-3 text-left text-xs font-bold text-red-400/70 transition hover:border-red-400/30 hover:bg-red-400/5 hover:text-red-400"
              >
                LOGOUT
              </button>

            </div>
          )}

        </div>

        {/* =================================================
            MOBILE CONTROLS
        ================================================= */}

        <div className="flex items-center gap-2 lg:hidden">

          <button
            type="button"
            onClick={() =>
              goTo(
                "/wallet"
              )
            }
            className="rounded-lg border border-lime-400/20 bg-lime-400/[0.03] px-3 py-2"
          >

            <p className="text-xs font-black text-lime-400">
              {isAuthenticated
                ? `${walletBalance.toLocaleString()} LT`
                : "LOGIN"}
            </p>

          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() =>
                goTo(
                  "/admin"
                )
              }
              className="rounded-lg border border-orange-400/30 bg-orange-400/[0.05] px-3 py-2 text-xs font-black text-orange-400"
            >
              ◆
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setMenuOpen(
                !menuOpen
              );

              setPlayerOpen(
                false
              );
            }}
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-800 transition hover:border-cyan-400"
            aria-label="Open menu"
          >

            <span
              className={`
                block
                h-[1px]
                w-5
                bg-zinc-300
                transition

                ${
                  menuOpen
                    ? "translate-y-[7px] rotate-45"
                    : ""
                }
              `}
            />

            <span
              className={`
                block
                h-[1px]
                w-5
                bg-zinc-300
                transition

                ${
                  menuOpen
                    ? "opacity-0"
                    : ""
                }
              `}
            />

            <span
              className={`
                block
                h-[1px]
                w-5
                bg-zinc-300
                transition

                ${
                  menuOpen
                    ? "-translate-y-[7px] -rotate-45"
                    : ""
                }
              `}
            />

          </button>

        </div>

      </div>

      {/* =================================================
          MOBILE MENU
      ================================================= */}

      {menuOpen && (
        <div className="border-t border-zinc-900 bg-black/95 backdrop-blur-xl lg:hidden">

          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">

            {/* ACCOUNT */}

            <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">

              <div className="flex items-center gap-3">

                <div
                  className={`
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    border
                    text-xs
                    font-black

                    ${
                      isAdmin
                        ? "border-orange-400/30 bg-orange-400/5 text-orange-400"
                        : "border-cyan-400/30 bg-cyan-400/5 text-cyan-400"
                    }
                  `}
                >
                  {isAdmin
                    ? "AD"
                    : isAuthenticated
                    ? "P1"
                    : "G"}
                </div>

                <div className="min-w-0">

                  <p
                    className={`
                      text-[8px]
                      tracking-[0.2em]

                      ${
                        isAdmin
                          ? "text-orange-400"
                          : "text-zinc-600"
                      }
                    `}
                  >
                    {isAdmin
                      ? "ADMIN"
                      : isAuthenticated
                      ? "PLAYER"
                      : "GUEST"}
                  </p>

                  <p className="mt-1 truncate text-xs text-cyan-400">
                    {
                      userEmail ||
                      (isAuthenticated
                        ? "PLAYER"
                        : "SIGN IN")
                    }
                  </p>

                </div>

              </div>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-900 pt-3">

                <p className="text-[9px] text-zinc-600">
                  WALLET
                </p>

                <p className="font-black text-lime-400">
                  {walletBalance.toLocaleString()}{" "}
                  LT
                </p>

              </div>

            </div>

            {/* MENU LIST */}

            <div className="grid gap-2">

              {visibleMenus.map(
                (
                  menu
                ) => {
                  const active =
                    isActive(
                      menu.path
                    );

                  const adminMenu =
                    menu.label ===
                    "ADMIN";

                  const gameMenu =
                    menu.label ===
                    "GAME";

                  return (
                    <button
                      key={
                        menu.label
                      }
                      type="button"
                      onClick={() =>
                        goTo(
                          menu.path
                        )
                      }
                      className={`
                        w-full
                        rounded-xl
                        border
                        px-4
                        py-4
                        text-left
                        text-sm
                        font-black
                        transition

                        ${
                          active &&
                          adminMenu
                            ? "border-orange-400 bg-orange-400/10 text-orange-400"
                            : active
                            ? "border-cyan-400 bg-cyan-400/10 text-cyan-400"
                            : adminMenu
                            ? "border-orange-400/25 text-orange-400"
                            : "border-zinc-800 text-zinc-400 hover:text-white"
                        }
                      `}
                    >

                      <span className="flex items-center gap-2">

                        {menu.symbol && (
                          <span
                            className={
                              active &&
                              gameMenu
                                ? "text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,1)]"
                                : adminMenu
                                ? "text-orange-400"
                                : active
                                ? "text-cyan-400"
                                : "text-zinc-600"
                            }
                          >
                            {
                              menu.symbol
                            }
                          </span>
                        )}

                        <span>
                          {
                            menu.label
                          }
                        </span>

                      </span>

                    </button>
                  );
                }
              )}

            </div>

            {/* TOPUP */}

            <button
              type="button"
              onClick={() =>
                goTo(
                  "/wallet/topup"
                )
              }
              className="mt-3 w-full rounded-xl bg-lime-400 px-4 py-4 font-black text-black"
            >
              + TOP UP TOKEN
            </button>

            {/* ACCOUNT ACTION */}

            <button
              type="button"
              onClick={
                isAuthenticated
                  ? logout
                  : () => goTo("/login")
              }
              className="mt-2 w-full rounded-xl border border-red-400/20 bg-red-400/[0.03] px-4 py-4 font-bold text-red-400"
            >
              {isAuthenticated
                ? "LOGOUT"
                : "LOGIN"}
            </button>

          </div>

        </div>
      )}

    </header>
  );
}