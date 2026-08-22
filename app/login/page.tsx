"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [
    mode,
    setMode,
  ] = useState<
    "login" | "register"
  >("login");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  // =====================================
  // LOGIN / REGISTER
  // =====================================

  async function handleSubmit() {
    if (loading) {
      return;
    }

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (
        !email ||
        !password
      ) {
        throw new Error(
          "กรุณากรอก Email และ Password"
        );
      }

      // =====================================
      // REGISTER
      // =====================================

      if (
        mode ===
        "register"
      ) {
        const {
          error,
        } =
          await supabase.auth.signUp(
            {
              email,
              password,
            }
          );

        if (
          error
        ) {
          throw error;
        }

        setMessage(
          "REGISTER SUCCESS"
        );

        setPassword("");

        setMode(
          "login"
        );

        return;
      }

      // =====================================
      // LOGIN
      // =====================================

      const {
        error,
      } =
        await supabase.auth
          .signInWithPassword(
            {
              email,
              password,
            }
          );

      if (
        error
      ) {
        throw error;
      }

      router.push(
        "/"
      );

      router.refresh();

    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Authentication failed"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // =====================================
  // ENTER KEY
  // =====================================

  function handleKeyDown(
    event:
      React.KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key ===
      "Enter"
    ) {
      handleSubmit();
    }
  }

  // =====================================
  // FORGOT PASSWORD
  // =====================================

  function openForgotPassword() {
    setMessage("");
    setErrorMessage("");

    router.push(
      "/forgot-password"
    );
  }

  // =====================================
  // PAGE
  // =====================================

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">

      {/* =====================================
          BACKGROUND
      ===================================== */}

      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        <div className="absolute top-[-300px] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full bg-cyan-500/10 blur-[180px]" />

        <div className="absolute bottom-[-300px] left-[-250px] w-[700px] h-[700px] rounded-full bg-purple-500/10 blur-[180px]" />

        <div className="absolute bottom-[-300px] right-[-250px] w-[700px] h-[700px] rounded-full bg-orange-400/8 blur-[180px]" />

        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(255,255,255,0.15) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,0.15) 1px,
                transparent 1px
              )
            `,

            backgroundSize:
              "42px 42px",
          }}
        />

      </div>

      {/* =====================================
          HUD LINES
      ===================================== */}

      <div className="absolute top-5 left-5 w-24 h-[1px] bg-cyan-400/60" />

      <div className="absolute top-5 left-5 w-[1px] h-24 bg-cyan-400/60" />

      <div className="absolute bottom-5 right-5 w-24 h-[1px] bg-purple-400/60" />

      <div className="absolute bottom-5 right-5 w-[1px] h-24 bg-purple-400/60" />

      {/* =====================================
          PAGE GRID
      ===================================== */}

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-10">

        <div className="w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">

          {/* =====================================
              LEFT BRAND PANEL
          ===================================== */}

          <section className="relative hidden lg:flex min-h-[680px] border border-cyan-400/20 bg-zinc-950/70 rounded-[30px] overflow-hidden p-10 flex-col justify-between">

            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/[0.06] via-transparent to-purple-500/[0.05]" />

            <div className="absolute top-0 left-0 w-28 h-[2px] bg-cyan-400" />

            <div className="absolute top-0 left-0 w-[2px] h-28 bg-cyan-400" />

            <div className="relative z-10">

              {/* LOGO */}

              <div className="flex items-center gap-4">

                <Image
                  src="/logo.png"
                  alt="LOOTFORM"
                  width={74}
                  height={74}
                  priority
                  className="object-contain"
                />

                <div>

                  <p className="text-white text-2xl font-black">
                    LOOTFORM
                  </p>

                  <p className="text-cyan-400 text-[9px] tracking-[0.35em] mt-1">
                    DIGITAL LOOT
                  </p>

                </div>

              </div>

              {/* HERO */}

              <div className="mt-16">

                <div className="inline-flex items-center gap-2 border border-cyan-400/20 bg-cyan-400/5 rounded-full px-4 py-2">

                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />

                  <span className="text-cyan-400 text-[9px] tracking-[0.3em]">
                    SYSTEM ONLINE
                  </span>

                </div>

                <h1 className="text-6xl xl:text-7xl font-black leading-[0.95] tracking-tight mt-7">

                  CRAFT

                  <br />

                  <span className="text-cyan-400">
                    YOUR
                  </span>

                  <br />

                  PHYSICAL

                  <br />

                  <span className="text-purple-400">
                    LOOT.
                  </span>

                </h1>

                <p className="text-zinc-500 max-w-lg leading-7 mt-7">
                  Enter the LOOTFORM system,
                  craft physical items,
                  unlock rarity and build
                  your collection.
                </p>

              </div>

            </div>

            {/* =====================================
                STATUS
            ===================================== */}

            <div className="relative z-10 grid grid-cols-3 gap-3">

              <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">

                <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                  SEASON
                </p>

                <p className="font-black mt-2">
                  S01
                </p>

              </div>

              <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">

                <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                  DROP
                </p>

                <p className="font-black mt-2">
                  LIVE
                </p>

              </div>

              <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">

                <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                  SYSTEM
                </p>

                <p className="text-lime-400 font-black mt-2">
                  ONLINE
                </p>

              </div>

            </div>

          </section>

          {/* =====================================
              LOGIN PANEL
          ===================================== */}

          <section className="relative min-h-[680px] border border-zinc-800 bg-zinc-950/80 rounded-[30px] overflow-hidden p-6 sm:p-9 flex flex-col justify-center backdrop-blur-xl">

            <div className="absolute top-0 right-0 w-24 h-[2px] bg-purple-400" />

            <div className="absolute top-0 right-0 w-[2px] h-24 bg-purple-400" />

            <div className="relative z-10 max-w-md w-full mx-auto">

              {/* =====================================
                  MOBILE LOGO
              ===================================== */}

              <div className="lg:hidden flex items-center justify-center gap-3 mb-10">

                <Image
                  src="/logo.png"
                  alt="LOOTFORM"
                  width={60}
                  height={60}
                  priority
                  className="object-contain"
                />

                <div>

                  <p className="text-white text-xl font-black">
                    LOOTFORM
                  </p>

                  <p className="text-cyan-400 text-[8px] tracking-[0.3em]">
                    DIGITAL LOOT
                  </p>

                </div>

              </div>

              {/* =====================================
                  HEADER
              ===================================== */}

              <p className="text-cyan-400 text-[9px] tracking-[0.35em]">
                PLAYER ACCESS
              </p>

              <h2 className="text-4xl sm:text-5xl font-black mt-3">

                {mode ===
                "login"
                  ? "WELCOME BACK"
                  : "CREATE PLAYER"}

              </h2>

              <p className="text-zinc-500 text-sm mt-3">

                {mode ===
                "login"
                  ? "เข้าสู่ระบบเพื่อเข้าถึง LOOTFORM"
                  : "สร้างบัญชีเพื่อเริ่ม Craft"}

              </p>

              {/* =====================================
                  MODE SWITCH
              ===================================== */}

              <div className="grid grid-cols-2 gap-2 mt-8 border border-zinc-800 bg-black/40 rounded-xl p-1.5">

                <button
                  type="button"
                  onClick={() => {
                    setMode(
                      "login"
                    );

                    setMessage(
                      ""
                    );

                    setErrorMessage(
                      ""
                    );
                  }}
                  className={`
                    py-3
                    rounded-lg
                    text-xs
                    font-black
                    transition

                    ${
                      mode ===
                      "login"
                        ? "bg-cyan-400 text-black"
                        : "text-zinc-500 hover:text-white"
                    }
                  `}
                >
                  LOGIN
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode(
                      "register"
                    );

                    setMessage(
                      ""
                    );

                    setErrorMessage(
                      ""
                    );
                  }}
                  className={`
                    py-3
                    rounded-lg
                    text-xs
                    font-black
                    transition

                    ${
                      mode ===
                      "register"
                        ? "bg-purple-400 text-black"
                        : "text-zinc-500 hover:text-white"
                    }
                  `}
                >
                  REGISTER
                </button>

              </div>

              {/* =====================================
                  EMAIL
              ===================================== */}

              <div className="mt-7">

                <label className="text-zinc-600 text-[9px] tracking-[0.25em]">
                  EMAIL
                </label>

                <input
                  type="email"
                  value={
                    email
                  }
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  placeholder="player@email.com"
                  autoComplete="email"
                  className="
                    w-full
                    mt-2
                    border
                    border-zinc-800
                    bg-black/50
                    rounded-xl
                    px-4
                    py-4
                    text-white
                    outline-none
                    placeholder:text-zinc-700
                    focus:border-cyan-400
                    focus:shadow-[0_0_25px_rgba(34,211,238,0.08)]
                    transition
                  "
                />

              </div>

              {/* =====================================
                  PASSWORD
              ===================================== */}

              <div className="mt-4">

                <label className="text-zinc-600 text-[9px] tracking-[0.25em]">
                  PASSWORD
                </label>

                <input
                  type="password"
                  value={
                    password
                  }
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  placeholder="••••••••"
                  autoComplete={
                    mode ===
                    "login"
                      ? "current-password"
                      : "new-password"
                  }
                  className="
                    w-full
                    mt-2
                    border
                    border-zinc-800
                    bg-black/50
                    rounded-xl
                    px-4
                    py-4
                    text-white
                    outline-none
                    placeholder:text-zinc-700
                    focus:border-purple-400
                    focus:shadow-[0_0_25px_rgba(168,85,247,0.08)]
                    transition
                  "
                />

              </div>

              {/* =====================================
                  FORGOT PASSWORD
              ===================================== */}

              {mode ===
                "login" && (
                <div className="flex justify-end mt-3">

                  <button
                    type="button"
                    onClick={
                      openForgotPassword
                    }
                    className="text-[10px] font-black tracking-[0.12em] text-zinc-500 hover:text-cyan-400 transition"
                  >
                    FORGOT PASSWORD?
                  </button>

                </div>
              )}

              {/* =====================================
                  SUBMIT
              ===================================== */}

              <button
                type="button"
                onClick={
                  handleSubmit
                }
                disabled={
                  loading
                }
                className={`
                  relative
                  overflow-hidden
                  w-full
                  min-h-[68px]
                  mt-6
                  rounded-xl
                  font-black
                  text-lg
                  disabled:opacity-40
                  disabled:cursor-not-allowed
                  transition

                  ${
                    mode ===
                    "login"
                      ? "bg-lime-400 text-black hover:bg-lime-300 shadow-[0_0_35px_rgba(163,230,53,0.12)]"
                      : "bg-purple-400 text-black hover:bg-purple-300 shadow-[0_0_35px_rgba(168,85,247,0.12)]"
                  }
                `}
              >

                {loading
                  ? "PROCESSING..."
                  : mode ===
                    "login"
                  ? "ENTER LOOTFORM"
                  : "CREATE PLAYER"}

              </button>

              {/* =====================================
                  SUCCESS
              ===================================== */}

              {message && (
                <div className="mt-4 border border-lime-400/30 bg-lime-400/[0.07] text-lime-400 rounded-xl p-4 text-center font-bold">

                  {message}

                </div>
              )}

              {/* =====================================
                  ERROR
              ===================================== */}

              {errorMessage && (
                <div className="mt-4 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-4 text-center text-sm">

                  {errorMessage}

                </div>
              )}

              {/* =====================================
                  INFO
              ===================================== */}

              <div className="mt-7 border border-zinc-800 bg-black/30 rounded-xl p-4">

                <div className="flex items-center gap-2">

                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />

                  <p className="text-zinc-500 text-[9px] tracking-[0.2em]">
                    SECURE PLAYER SESSION
                  </p>

                </div>

                <p className="text-zinc-700 text-xs leading-5 mt-2">
                  Authentication powered by LOOTFORM player system.
                </p>

              </div>

              <p className="text-center text-zinc-800 text-[9px] tracking-[0.3em] mt-8">
                DIGITAL LOOT. PHYSICAL FORM.
              </p>

            </div>

          </section>

        </div>

      </div>

    </main>
  );
}