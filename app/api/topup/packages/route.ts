import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM PLAYER TOP-UP OPTIONS

   Authenticated (any player, not admin-only): active packages,
   bank details, QR image and the current THB->LT rate needed to
   render the top-up page.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const token = authorization.slice(7).trim();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json(
      { success: false, message: "Invalid or expired session" },
      { status: 401 }
    );
  }

  const [{ data: settings, error: settingsError }, { data: packages, error: packagesError }] =
    await Promise.all([
      supabaseAdmin
        .from("topup_settings")
        .select(
          "bank_name, bank_account_name, bank_account_number, qr_image_url, rate_lt_per_thb"
        )
        .eq("id", 1)
        .maybeSingle(),
      supabaseAdmin
        .from("topup_packages")
        .select("id, amount_thb, label, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("amount_thb", { ascending: true }),
    ]);

  if (settingsError) {
    console.error("TOPUP PACKAGES SETTINGS ERROR:", settingsError);
    return NextResponse.json(
      { success: false, message: "Unable to load top-up settings" },
      { status: 500 }
    );
  }

  if (packagesError) {
    console.error("TOPUP PACKAGES LOAD ERROR:", packagesError);
    return NextResponse.json(
      { success: false, message: "Unable to load top-up packages" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    settings: settings ?? null,
    packages: packages ?? [],
  });
}
