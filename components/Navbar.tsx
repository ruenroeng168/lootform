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

import { supabase } from "@/lib/supabase";

type MenuItem = {
  label: string;
  path: string;
  adminOnly?: boolean;
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    playerOpen,
    setPlayerOpen,
  ] = useState(false);

  const [
    userEmail,
    setUserEmail,
  ] = useState("");

  const [
    walletBalance,
    setWalletBalance,
  ] = useState(0);

  const [
    isAdmin,
    setIsAdmin,
  ] = useState(false);

  const menus: MenuItem[] = [
    {
      label: "HOME",
      path: "/",
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
      label: "WALLET",
      path: "/wallet",
    },
    {
      label: "ADMIN",
      path: "/admin",
      adminOnly: true,
    },
  ];

  // =========================
  // LOAD PLAYER
  // =========================

  useEffect(() => {
    async function loadPlayer() {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        setUserEmail("");
        setWalletBalance(0);
        setIsAdmin(false);
        return;
      }

      const user =
        session.user;

      setUserEmail(
        user.email ?? "PLAYER"
      );

      const {
        data: wallet,
        error: walletError,
      } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletError) {
        console.error(
          "NAVBAR WALLET ERROR:",
          walletError
        );
      }

      setWalletBalance(
        wallet?.balance ?? 0
      );

      // =========================
      // CHECK ADMIN
      // =========================

      try {
        const response =
          await fetch(
            "/api/admin/check",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );

        const result =
          await response.json();

        setIsAdmin(
          response.ok &&
            result.isAdmin === true
        );
      } catch (error) {
        console.error(
          "ADMIN CHECK ERROR:",
          error
        );

        setIsAdmin(false);
      }
    }

    loadPlayer();
  }, [pathname]);

  // =========================
  // VISIBLE MENUS
  // =========================

  const visibleMenus =
    menus.filter(
      (menu) =>
        !menu.adminOnly ||
        isAdmin
    );

  // =========================
  // ACTIVE
  // =========================

  function isActive(
    path: string
  ) {
    if (path === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(
      path
    );
  }

  // =========================
  // NAVIGATE
  // =========================

  function goTo(
    path: string
  ) {
    setMenuOpen(false);
    setPlayerOpen(false);

    router.push(path);
  }

  // =========================
  // LOGOUT
  // =========================

  async function logout() {
    await supabase.auth.signOut();

    setMenuOpen(false);
    setPlayerOpen(false);

    setUserEmail("");
    setWalletBalance(0);
    setIsAdmin(false);

    router.push("/login");
    router.refresh();
  }

  return (
    <header
      className="
        sticky
        top-0
        z-50
        w-full
        border-b
        border-cyan-400/10
        bg-black/90
        backdrop-blur-xl
      "
    >
      {/* TOP GLOW */}

      <div
        className="
          absolute
          top-0
          left-1/2
          -translate-x-1/2
          w-[600px]
          max-w-[80vw]
          h-[1px]
          bg-gradient-to-r
          from-transparent
          via-cyan-400
          to-transparent
          shadow-[0_0_25px_rgba(34,211,238,0.7)]
        "
      />

      <div
        className="
          max-w-7xl
          mx-auto
          px-4
          sm:px-6
          h-[76px]
          flex
          items-center
          justify-between
          gap-4
        "
      >
        {/* LOGO */}

        <button
          onClick={() =>
            goTo("/")
          }
          className="
            flex
            items-center
            gap-3
            group
            shrink-0
          "
        >
          <div
            className="
              relative
              w-12
              h-12
              flex
              items-center
              justify-center
            "
          >
            <div
              className="
                absolute
                inset-0
                rounded-full
                bg-cyan-400/10
                blur-xl
                opacity-0
                group-hover:opacity-100
                transition
              "
            />

            <Image
              src="/logo.png"
              alt="LOOTFORM"
              width={48}
              height={48}
              priority
              className="
                relative
                object-contain
                transition
                duration-300
                group-hover:scale-105
              "
            />
          </div>

          <div
            className="
              hidden
              sm:block
              text-left
            "
          >
            <p
              className="
                text-white
                font-black
                text-xl
                tracking-tight
              "
            >
              LOOTFORM
            </p>

            <p
              className="
                text-[8px]
                text-cyan-400
                tracking-[0.28em]
              "
            >
              DIGITAL LOOT
            </p>
          </div>
        </button>

        {/* DESKTOP MENU */}

        <nav
          className="
            hidden
            lg:flex
            items-center
            gap-2
          "
        >
          {visibleMenus.map(
            (menu) => {
              const active =
                isActive(
                  menu.path
                );

              const adminMenu =
                menu.label ===
                "ADMIN";

              return (
                <button
                  key={
                    menu.label
                  }
                  onClick={() =>
                    goTo(
                      menu.path
                    )
                  }
                  className={`
                    relative
                    px-4
                    py-2.5
                    rounded-lg
                    text-xs
                    font-bold
                    tracking-wide
                    border
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
                          shadow-[0_0_20px_rgba(34,211,238,0.12)]
                        `
                        : adminMenu
                        ? `
                          border-orange-400/25
                          text-orange-400
                          bg-orange-400/[0.03]
                          hover:border-orange-400
                          hover:bg-orange-400/10
                        `
                        : `
                          border-zinc-800
                          text-zinc-500
                          hover:text-white
                          hover:border-zinc-600
                          hover:bg-white/[0.03]
                        `
                    }
                  `}
                >
                  {adminMenu && (
                    <span className="mr-1">
                      ◆
                    </span>
                  )}

                  {
                    menu.label
                  }

                  {active && (
                    <span
                      className={`
                        absolute
                        -bottom-[5px]
                        left-1/2
                        -translate-x-1/2
                        w-1
                        h-1
                        rounded-full

                        ${
                          adminMenu
                            ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,1)]"
                            : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)]"
                        }
                      `}
                    />
                  )}
                </button>
              );
            }
          )}
        </nav>

        {/* DESKTOP PLAYER */}

        <div
          className="
            hidden
            lg:flex
            items-center
            gap-3
            relative
          "
        >
          <button
            onClick={() =>
              goTo("/wallet")
            }
            className="
              border
              border-lime-400/20
              bg-lime-400/[0.03]
              rounded-xl
              px-4
              py-2
              text-left
              hover:border-lime-400
              transition
            "
          >
            <p
              className="
                text-zinc-600
                text-[8px]
                tracking-[0.2em]
              "
            >
              WALLET
            </p>

            <p
              className="
                text-lime-400
                text-sm
                font-black
                mt-0.5
              "
            >
              {
                walletBalance
              }{" "}
              LT
            </p>
          </button>

          <button
            onClick={() =>
              setPlayerOpen(
                !playerOpen
              )
            }
            className="
              flex
              items-center
              gap-3
              border
              border-zinc-800
              bg-zinc-950/80
              rounded-xl
              px-3
              py-2
              hover:border-cyan-400/50
              transition
            "
          >
            <div
              className={`
                w-9
                h-9
                rounded-lg
                border
                flex
                items-center
                justify-center
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
                : "P1"}
            </div>

            <div
              className="
                text-left
                max-w-[150px]
              "
            >
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
                  : "PLAYER"}
              </p>

              <p
                className="
                  text-zinc-300
                  text-xs
                  truncate
                  mt-1
                "
              >
                {userEmail ||
                  "PLAYER"}
              </p>
            </div>

            <span
              className={`
                text-zinc-600
                text-xs
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

          {/* PLAYER DROPDOWN */}

          {playerOpen && (
            <div
              className="
                absolute
                top-[58px]
                right-0
                w-[260px]
                border
                border-zinc-800
                bg-black/95
                rounded-2xl
                p-3
                shadow-[0_20px_60px_rgba(0,0,0,0.7)]
                backdrop-blur-xl
              "
            >
              <div
                className="
                  border
                  border-zinc-800
                  bg-zinc-950
                  rounded-xl
                  p-4
                "
              >
                <div className="flex items-center justify-between gap-3">

                  <p
                    className="
                      text-zinc-600
                      text-[8px]
                      tracking-[0.2em]
                    "
                  >
                    PLAYER ACCOUNT
                  </p>

                  {isAdmin && (
                    <span
                      className="
                        border
                        border-orange-400/30
                        bg-orange-400/5
                        text-orange-400
                        rounded-full
                        px-2
                        py-1
                        text-[7px]
                        font-black
                      "
                    >
                      ADMIN
                    </span>
                  )}

                </div>

                <p
                  className="
                    text-cyan-400
                    text-xs
                    mt-2
                    break-all
                  "
                >
                  {userEmail}
                </p>

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    mt-4
                  "
                >
                  <p
                    className="
                      text-zinc-600
                      text-[9px]
                    "
                  >
                    BALANCE
                  </p>

                  <p
                    className="
                      text-lime-400
                      font-black
                    "
                  >
                    {
                      walletBalance
                    }{" "}
                    LT
                  </p>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() =>
                    goTo(
                      "/admin"
                    )
                  }
                  className="
                    w-full
                    mt-2
                    border
                    border-orange-400/20
                    bg-orange-400/[0.03]
                    text-left
                    text-orange-400
                    px-4
                    py-3
                    rounded-xl
                    text-xs
                    font-black
                    hover:border-orange-400
                    hover:bg-orange-400/10
                    transition
                  "
                >
                  ◆ ADMIN DASHBOARD
                </button>
              )}

              <button
                onClick={() =>
                  goTo(
                    "/collection"
                  )
                }
                className="
                  w-full
                  mt-2
                  border
                  border-transparent
                  text-left
                  text-zinc-400
                  px-4
                  py-3
                  rounded-xl
                  text-xs
                  font-bold
                  hover:border-cyan-400/30
                  hover:bg-cyan-400/5
                  hover:text-cyan-400
                  transition
                "
              >
                MY COLLECTION
              </button>

              <button
                onClick={() =>
                  goTo("/wallet")
                }
                className="
                  w-full
                  border
                  border-transparent
                  text-left
                  text-zinc-400
                  px-4
                  py-3
                  rounded-xl
                  text-xs
                  font-bold
                  hover:border-lime-400/30
                  hover:bg-lime-400/5
                  hover:text-lime-400
                  transition
                "
              >
                MY WALLET
              </button>

              <div
                className="
                  h-[1px]
                  bg-zinc-900
                  my-2
                "
              />

              <button
                onClick={logout}
                className="
                  w-full
                  border
                  border-transparent
                  text-left
                  text-red-400/70
                  px-4
                  py-3
                  rounded-xl
                  text-xs
                  font-bold
                  hover:border-red-400/30
                  hover:bg-red-400/5
                  hover:text-red-400
                  transition
                "
              >
                LOGOUT
              </button>
            </div>
          )}
        </div>

        {/* MOBILE CONTROLS */}

        <div
          className="
            flex
            lg:hidden
            items-center
            gap-2
          "
        >
          <button
            onClick={() =>
              goTo("/wallet")
            }
            className="
              border
              border-lime-400/20
              bg-lime-400/[0.03]
              rounded-lg
              px-3
              py-2
            "
          >
            <p
              className="
                text-lime-400
                text-xs
                font-black
              "
            >
              {
                walletBalance
              }{" "}
              LT
            </p>
          </button>

          {isAdmin && (
            <button
              onClick={() =>
                goTo("/admin")
              }
              className="
                border
                border-orange-400/30
                bg-orange-400/[0.05]
                text-orange-400
                rounded-lg
                px-3
                py-2
                text-xs
                font-black
              "
            >
              ADMIN
            </button>
          )}

          <button
            onClick={() => {
              setMenuOpen(
                !menuOpen
              );

              setPlayerOpen(
                false
              );
            }}
            className="
              w-11
              h-11
              border
              border-zinc-800
              rounded-xl
              flex
              flex-col
              items-center
              justify-center
              gap-1.5
              hover:border-cyan-400
              transition
            "
            aria-label="Open menu"
          >
            <span
              className={`
                block
                w-5
                h-[1px]
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
                w-5
                h-[1px]
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
                w-5
                h-[1px]
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

      {/* MOBILE MENU */}

      {menuOpen && (
        <div
          className="
            lg:hidden
            border-t
            border-zinc-900
            bg-black/95
            backdrop-blur-xl
          "
        >
          <div
            className="
              max-w-7xl
              mx-auto
              px-4
              sm:px-6
              py-4
            "
          >
            <div
              className="
                border
                border-zinc-800
                bg-zinc-950/80
                rounded-2xl
                p-4
                mb-4
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className={`
                    w-10
                    h-10
                    rounded-xl
                    border
                    flex
                    items-center
                    justify-center
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
                    : "P1"}
                </div>

                <div
                  className="
                    min-w-0
                  "
                >
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
                      : "PLAYER"}
                  </p>

                  <p
                    className="
                      text-cyan-400
                      text-xs
                      truncate
                      mt-1
                    "
                  >
                    {userEmail}
                  </p>
                </div>
              </div>

              <div
                className="
                  flex
                  items-center
                  justify-between
                  mt-4
                  border-t
                  border-zinc-900
                  pt-3
                "
              >
                <p
                  className="
                    text-zinc-600
                    text-[9px]
                  "
                >
                  WALLET
                </p>

                <p
                  className="
                    text-lime-400
                    font-black
                  "
                >
                  {
                    walletBalance
                  }{" "}
                  LT
                </p>
              </div>
            </div>

            <div
              className="
                grid
                gap-2
              "
            >
              {visibleMenus.map(
                (menu) => {
                  const active =
                    isActive(
                      menu.path
                    );

                  const adminMenu =
                    menu.label ===
                    "ADMIN";

                  return (
                    <button
                      key={
                        menu.label
                      }
                      onClick={() =>
                        goTo(
                          menu.path
                        )
                      }
                      className={`
                        w-full
                        text-left
                        px-4
                        py-4
                        rounded-xl
                        border
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
                      {adminMenu
                        ? "◆ "
                        : ""}
                      {
                        menu.label
                      }
                    </button>
                  );
                }
              )}
            </div>

            <button
              onClick={() =>
                goTo(
                  "/wallet/topup"
                )
              }
              className="
                w-full
                mt-3
                bg-lime-400
                text-black
                font-black
                px-4
                py-4
                rounded-xl
              "
            >
              + TOP UP TOKEN
            </button>

            <button
              onClick={logout}
              className="
                w-full
                mt-2
                border
                border-red-400/20
                bg-red-400/[0.03]
                text-red-400
                font-bold
                px-4
                py-4
                rounded-xl
              "
            >
              LOGOUT
            </button>
          </div>
        </div>
      )}
    </header>
  );
}