import { NextResponse } from "next/server";
import { getActiveProducts } from "@/lib/shop-data";

/* =========================================================
   LOOTFORM SHOP PRODUCTS (public)

   Active products with current price and per-size stock. The
   cart page uses this to reconcile its localStorage snapshot
   (price changes, sold-out sizes) before checkout.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getActiveProducts();

    return NextResponse.json(
      { success: true, products },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("SHOP PRODUCTS API ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load products" },
      { status: 500 }
    );
  }
}
