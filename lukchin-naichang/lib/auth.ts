import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "./supabase/server";

export type AppRole = "admin" | "staff" | "rider";

export type StaffContext = {
  userId: string;
  email: string | null;
  role: AppRole;
  displayName: string | null;
  storeId: string | null;
};

export type AuthResult =
  | { ok: true; ctx: StaffContext }
  | { ok: false; reason: "not_configured" | "forbidden" };

// Server-side gate for every staff/rider/admin page. Fails closed: missing
// config, missing session, missing/inactive profile or wrong role all deny.
export async function requireRole(allowed: AppRole[]): Promise<AuthResult> {
  // Always evaluate per request; never prerender a protected page.
  await connection();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, reason: "not_configured" };

  // getUser() validates the JWT with Supabase Auth; getSession() would trust
  // the cookie as-is.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/staff/login");

  // RLS lets a user read only their own staff_profiles row.
  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role, display_name, store_id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return { ok: false, reason: "forbidden" };
  const role = profile.role as AppRole;
  if (!allowed.includes(role)) return { ok: false, reason: "forbidden" };

  return {
    ok: true,
    ctx: {
      userId: user.id,
      email: user.email ?? null,
      role,
      displayName: profile.display_name,
      storeId: profile.store_id,
    },
  };
}

export function landingPathForRole(role: AppRole): string {
  if (role === "admin") return "/admin";
  if (role === "rider") return "/rider";
  return "/staff/orders";
}
