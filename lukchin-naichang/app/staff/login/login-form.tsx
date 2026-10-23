"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "../actions";

const initial: LoginState = { error: null };

export function LoginForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={disabled || pending} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-stone-700">
            อีเมล
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none disabled:bg-stone-100"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-stone-700">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none disabled:bg-stone-100"
          />
        </div>
        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-full bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
        >
          {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </fieldset>
    </form>
  );
}
