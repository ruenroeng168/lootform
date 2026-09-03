import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   ADMIN EMAILS
========================================================= */

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/* =========================================================
   VERIFY ADMIN

   Shared helper for new admin routes. Same check already
   duplicated ad hoc across app/api/admin/beta/reset/route.ts,
   app/api/admin/topup/orders/route.ts, etc. -- not refactored
   into those existing (working) routes, only used by new ones.
========================================================= */

export async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "UNAUTHORIZED" as const };
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user || !user.email) {
    return { user: null, error: "UNAUTHORIZED" as const };
  }

  const isAdmin = getAdminEmails().includes(user.email.toLowerCase());

  if (!isAdmin) {
    return { user: null, error: "FORBIDDEN" as const };
  }

  return { user, error: null };
}
