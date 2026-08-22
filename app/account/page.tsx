"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingName,
    setSavingName,
  ] = useState(false);

  const [
    savingPassword,
    setSavingPassword,
  ] = useState(false);

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    displayName,
    setDisplayName,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    async function loadAccount() {
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
            ""
        );

        const {
          data:
            profile,
          error:
            profileError,
        } =
          await supabase
            .from(
              "player_profiles"
            )
            .select(
              "display_name"
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

        setDisplayName(
          profile
            ?.display_name ??
            user.email
              ?.split("@")[0] ??
            "PLAYER"
        );
      } catch (
        error
      ) {
        setErrorMessage(
          error instanceof
          Error
            ? error.message
            : "Unable to load account"
        );
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, [router]);

  async function saveCharacterName(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanName =
      displayName.trim();

    if (
      cleanName.length <
      3
    ) {
      setErrorMessage(
        "Character name ต้องมีอย่างน้อย 3 ตัวอักษร"
      );

      setSuccessMessage("");

      return;
    }

    if (
      cleanName.length >
      24
    ) {
      setErrorMessage(
        "Character name ต้องไม่เกิน 24 ตัวอักษร"
      );

      setSuccessMessage("");

      return;
    }

    setSavingName(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
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

      const {
        error,
      } =
        await supabase
          .from(
            "player_profiles"
          )
          .update({
            display_name:
              cleanName,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "user_id",
            user.id
          );

      if (
        error
      ) {
        throw error;
      }

      setDisplayName(
        cleanName
      );

      setSuccessMessage(
        "✓ เปลี่ยนชื่อ Character เรียบร้อยแล้ว"
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to update character name"
      );
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      password.length <
      8
    ) {
      setErrorMessage(
        "Password ใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"
      );

      setSuccessMessage("");

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        "Password ทั้งสองช่องไม่ตรงกัน"
      );

      setSuccessMessage("");

      return;
    }

    setSavingPassword(
      true
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } =
        await supabase.auth.updateUser({
          password,
        });

      if (
        error
      ) {
        throw error;
      }

      setPassword("");
      setConfirmPassword("");

      setSuccessMessage(
        "✓ เปลี่ยน Password เรียบร้อยแล้ว"
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to update password"
      );
    } finally {
      setSavingPassword(
        false
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
            LOADING ACCOUNT...
          </p>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">

      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-10">

        <p className="text-cyan-400 text-[9px] tracking-[0.35em]">
          LOOTFORM PLAYER SYSTEM
        </p>

        <h1 className="text-4xl sm:text-6xl font-black mt-2">
          ACCOUNT{" "}

          <span className="text-cyan-400">
            SETTINGS
          </span>
        </h1>

        <p className="text-zinc-600 text-sm mt-3">
          {email}
        </p>

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 border border-lime-400/30 bg-lime-400/[0.07] text-lime-400 rounded-xl p-5">
            {successMessage}
          </div>
        )}

        <section className="grid lg:grid-cols-2 gap-6 mt-8">

          <form
            onSubmit={
              saveCharacterName
            }
            className="border border-cyan-400/25 bg-zinc-950/80 rounded-[28px] p-6"
          >

            <p className="text-cyan-400 text-[9px] tracking-[0.3em]">
              CHARACTER IDENTITY
            </p>

            <h2 className="text-2xl font-black mt-2">
              CHARACTER NAME
            </h2>

            <p className="text-zinc-600 text-xs mt-2">
              ชื่อนี้จะแสดงบนหน้า MY CHARACTER
            </p>

            <label className="block mt-6">

              <span className="text-zinc-500 text-[9px]">
                DISPLAY NAME
              </span>

              <input
                value={
                  displayName
                }
                onChange={(
                  event
                ) =>
                  setDisplayName(
                    event.target.value
                  )
                }
                maxLength={24}
                className="w-full mt-2 bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white font-black outline-none focus:border-cyan-400"
                placeholder="PLAYER NAME"
              />

            </label>

            <p className="text-zinc-700 text-[9px] mt-2">
              3–24 ตัวอักษร
            </p>

            <button
              type="submit"
              disabled={
                savingName
              }
              className="w-full mt-6 bg-cyan-400 text-black rounded-xl py-4 text-sm font-black hover:bg-cyan-300 disabled:opacity-50"
            >
              {savingName
                ? "SAVING..."
                : "SAVE CHARACTER NAME"}
            </button>

          </form>

          <form
            onSubmit={
              changePassword
            }
            className="border border-purple-400/25 bg-zinc-950/80 rounded-[28px] p-6"
          >

            <p className="text-purple-400 text-[9px] tracking-[0.3em]">
              ACCOUNT SECURITY
            </p>

            <h2 className="text-2xl font-black mt-2">
              CHANGE PASSWORD
            </h2>

            <p className="text-zinc-600 text-xs mt-2">
              สำหรับ User ที่ Login อยู่
            </p>

            <label className="block mt-6">

              <span className="text-zinc-500 text-[9px]">
                NEW PASSWORD
              </span>

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
                autoComplete="new-password"
                className="w-full mt-2 bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white outline-none focus:border-purple-400"
                placeholder="อย่างน้อย 8 ตัวอักษร"
              />

            </label>

            <label className="block mt-4">

              <span className="text-zinc-500 text-[9px]">
                CONFIRM NEW PASSWORD
              </span>

              <input
                type="password"
                value={
                  confirmPassword
                }
                onChange={(
                  event
                ) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                autoComplete="new-password"
                className="w-full mt-2 bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white outline-none focus:border-purple-400"
                placeholder="พิมพ์ Password อีกครั้ง"
              />

            </label>

            <button
              type="submit"
              disabled={
                savingPassword
              }
              className="w-full mt-6 bg-purple-400 text-black rounded-xl py-4 text-sm font-black hover:bg-purple-300 disabled:opacity-50"
            >
              {savingPassword
                ? "UPDATING..."
                : "CHANGE PASSWORD"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/forgot-password"
                )
              }
              className="w-full mt-3 border border-zinc-800 text-zinc-400 rounded-xl py-4 text-xs font-black hover:border-cyan-400 hover:text-cyan-400"
            >
              FORGOT PASSWORD
            </button>

          </form>

        </section>

        <button
          onClick={() =>
            router.push("/")
          }
          className="mt-6 text-zinc-500 hover:text-white text-xs font-black"
        >
          ← BACK TO CHARACTER
        </button>

      </div>

    </main>
  );
}