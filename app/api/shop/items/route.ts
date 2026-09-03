import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM PLAIN SHOP CATALOG

   Public, no auth -- guests must be able to browse. Mirrors
   /api/catalog's no-auth shape, just without season/grade data.
========================================================= */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("shop_items")
    .select(
      "id, name, category, description, price_thb, available_sizes, image_url, sort_order"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("SHOP ITEMS LOAD ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load shop items" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, items: data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120" } }
  );
}
