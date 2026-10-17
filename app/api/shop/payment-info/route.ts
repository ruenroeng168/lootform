import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM SHOP PAYMENT INFO (public)

   Bank account + QR the customer transfers to at checkout.
   Reuses the singleton topup_settings row Admin already
   manages in /admin/topup, so there is one place to update
   payment details.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("topup_settings")
    .select("bank_name, bank_account_name, bank_account_number, qr_image_url")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("SHOP PAYMENT INFO ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load payment details" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      payment: {
        bank_name: data?.bank_name ?? "",
        bank_account_name: data?.bank_account_name ?? "",
        bank_account_number: data?.bank_account_number ?? "",
        qr_image_url: data?.qr_image_url ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
