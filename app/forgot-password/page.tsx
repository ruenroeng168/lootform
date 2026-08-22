"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function sendResetEmail(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanEmail =
      email.trim()
        .toLowerCase();

    if (
      !cleanEmail
    ) {
      setErrorMessage(
        "กรุณากรอก Email"
      );

      return;
    }

    setSending(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const redirectTo =
        `${window.location.origin}/update-password`;

      const {
        error,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            cleanEmail,
            {
              redirectTo,
            }
          );

      if (
        error
      ) {
        throw error;
      }

      setSuccessMessage(
        "ส่งลิงก์ Reset Password แล้ว กรุณาตรวจสอบ Email ของคุณ"
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to send reset email"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-12">

      <section className="w-full max-w-lg border border-cyan-400/25 bg-zinc-950/90 rounded-[30px] p-7 sm:p-9">

        <p className="text-cyan-400 text-[9px] tracking-[0.35em]">
          LOOTFORM ACCOUNT RECOVERY
        </p>

        <h1 className="text-4xl font-black mt-3">
          FORGOT{" "}

          <span className="text-cyan-400">
            PASSWORD
          </span>
        </h1>

        <p className="text-zinc-600 text-sm mt-3">
          กรอก Email ที่ใช้สมัคร LOOTFORM แล้วระบบจะส่งลิงก์สำหรับตั้ง Password ใหม่
        </p>

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
            sendResetEmail
          }
          className="mt-7"
        >

          <label className="block">

            <span className="text-zinc-500 text-[9px]">
              EMAIL
            </span>

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
              autoComplete="email"
              className="w-full mt-2 bg-black border border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-cyan-400"
              placeholder="you@example.com"
            />

          </label>

          <button
            type="submit"
            disabled={
              sending
            }
            className="w-full mt-5 bg-cyan-400 text-black rounded-xl py-4 text-sm font-black hover:bg-cyan-300 disabled:opacity-50"
          >
            {sending
              ? "SENDING..."
              : "SEND RESET LINK"}
          </button>

        </form>

        <button
          onClick={() =>
            router.push(
              "/login"
            )
          }
          className="w-full mt-4 border border-zinc-800 rounded-xl py-4 text-xs font-black text-zinc-400 hover:text-white hover:border-zinc-600"
        >
          ← BACK TO LOGIN
        </button>

      </section>

    </main>
  );
}