import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

/* =========================================================
   LOOTFORM ADMIN SHOP ORDERS

   GET ?status=PENDING|APPROVED|REJECTED (default PENDING)

   Slip images live in the PRIVATE shop-order-slips bucket, so each
   order's slip_image_path is resolved to a short-lived signed URL
   here rather than exposing a public URL. Mirrors
   /api/admin/topup/orders/route.ts.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLIP_BUCKET = "shop-order-slips";
const SIGNED_URL_TTL_SECONDS = 600;

const SELECT = `
  id, reference, user_id, shop_item_id, item_name_snapshot,
  price_thb_snapshot, size, quantity, total_thb, shipping_address_id,
  slip_image_path, status, reviewed_by, reviewed_at, reject_reason,
  created_at, updated_at
`;

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAdmin(request);

  if (authError === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  if (authError === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
  }

  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const statusParam = new URL(request.url).searchParams.get("status");
  const status = ["PENDING", "APPROVED", "REJECTED"].includes(statusParam ?? "")
    ? (statusParam as string)
    : "PENDING";

  const { data: orders, error } = await supabaseAdmin
    .from("shop_orders")
    .select(SELECT)
    .eq("status", status)
    .order("created_at", { ascending: status === "PENDING" });

  if (error) {
    console.error("ADMIN SHOP ORDERS GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load shop orders" },
      { status: 500 }
    );
  }

  const userIds = Array.from(new Set((orders ?? []).map((order) => order.user_id)));
  const addressIds = Array.from(
    new Set((orders ?? []).map((order) => order.shipping_address_id).filter(Boolean))
  );

  const emailByUserId = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    for (const authUser of userList?.users ?? []) {
      if (userIds.includes(authUser.id)) {
        emailByUserId.set(authUser.id, authUser.email ?? "");
      }
    }
  }

  const addressById = new Map<number, Record<string, unknown>>();

  if (addressIds.length > 0) {
    const { data: addresses } = await supabaseAdmin
      .from("shipping_addresses")
      .select("id, recipient_name, phone, address_line, subdistrict, district, province, postal_code")
      .in("id", addressIds as number[]);

    for (const address of addresses ?? []) {
      addressById.set(address.id, address);
    }
  }

  const enrichedOrders = await Promise.all(
    (orders ?? []).map(async (order) => {
      let slipUrl: string | null = null;

      if (order.slip_image_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from(SLIP_BUCKET)
          .createSignedUrl(order.slip_image_path, SIGNED_URL_TTL_SECONDS);

        slipUrl = signed?.signedUrl ?? null;
      }

      return {
        ...order,
        user_email: emailByUserId.get(order.user_id) ?? "",
        slip_image_signed_url: slipUrl,
        shipping_address: order.shipping_address_id
          ? addressById.get(order.shipping_address_id) ?? null
          : null,
      };
    })
  );

  return NextResponse.json({ success: true, orders: enrichedOrders });
}
