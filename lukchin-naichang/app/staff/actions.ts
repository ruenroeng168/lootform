"use server";

import { redirect } from "next/navigation";
import { landingPathForRole, type AppRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

const GENERIC_ERROR = "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีนี้ไม่มีสิทธิ์พนักงาน";

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "ระบบยืนยันตัวตนยังไม่ได้เชื่อมต่อ" };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password || email.length > 254 || password.length > 128) {
    return { error: GENERIC_ERROR };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: GENERIC_ERROR };

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role, is_active")
    .eq("user_id", data.user.id)
    .maybeSingle();

  // Only staff accounts may hold a session through this form.
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: GENERIC_ERROR };
  }

  redirect(landingPathForRole(profile.role as AppRole));
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/staff/login");
}
