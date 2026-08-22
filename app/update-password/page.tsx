"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router =
    useRouter();

  const [
    ready,
    setReady,
  ] = useState(false);

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

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

  useEffect(() => {
    let mounted =
      true;

    async function checkRecoverySession() {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (
        mounted
      ) {
        setReady(
          !!session
        );
      }
    }

    checkRecoverySession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            event,
            session
          ) => {
            if (
              event ===
                "PASSWORD_RECOVERY" ||
              session
            ) {
              setReady(
                true
              );
            }
          }
        );

    return () => {
      mounted =
        false;

      subscription.unsubscribe();
    };
  }, []);

  async function updatePassword(
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

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        "Password ทั้งสองช่องไม่ตรงกัน"
      );

      return;
    }

    setSaving(true);
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
        "✓ ตั้ง Password ใหม่เรียบร้อยแล้ว"
      );

      setTimeout(
        () => {
          router.push(
            "/login"
          );
        },
        1800
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
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-12">

      <section className="w-full max-w-lg border border-purple-400/25 bg-zinc-950/90 rounded-[30px] p-7 sm:p-9">

        <p className="text-purple-400 text-[9px] tracking-[0.35em]">
          LOOTFORM ACCOUNT RECOVERY
        </p>

        <h1 className="text-4xl font-black mt-3">
          NEW{" "}

          <span className="text-purple-400">
            PASSWORD
          </span>
        </h1>

        {!ready && (
          <div className="mt-6 border border-orange-400/30 bg-orange-400/[0.07] text-orange-400 rounded-xl p-4 text-sm">
            กำลังตรวจสอบ Recovery Link... ถ้าหน้านี้ไม่พร้อมใช้งาน ให้เปิดลิงก์จาก Email Reset Password อีกครั้ง
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-4 text-sm">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 border border-lime-400/30 bg-lime-400/[0.07] text-lime-400 rounded-xl p-4 text-sm">
            {successMessage}
          </div>
        )}

        <form
          onSubmit={
            updatePassword
          }
          className="mt-7"
        >

          <label className="block">

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
              disabled={
                !ready
              }
              className="w-full mt-2 bg-black border border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-purple-400 disabled:opacity-40"
              placeholder="อย่างน้อย 8 ตัวอักษร"
            />

          </label>

          <label className="block mt-4">

            <span className="text-zinc-500 text-[9px]">
              CONFIRM PASSWORD
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
              disabled={
                !ready
              }
              className="w-full mt-2 bg-black border border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-purple-400 disabled:opacity-40"
              placeholder="พิมพ์ Password อีกครั้ง"
            />

          </label>

          <button
            type="submit"
            disabled={
              saving ||
              !ready
            }
            className="w-full mt-6 bg-purple-400 text-black rounded-xl py-4 text-sm font-black hover:bg-purple-300 disabled:opacity-50"
          >
            {saving
              ? "UPDATING..."
              : "SET NEW PASSWORD"}
          </button>

        </form>

      </section>

    </main>
  );
}