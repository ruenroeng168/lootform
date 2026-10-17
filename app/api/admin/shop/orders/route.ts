import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireShopAdmin } from "@/lib/shop-data";

/* =========================================================
   LOOTFORM ADMIN SHOP ORDERS

   GET   ?status=PENDING|PAID|SHIPPED|DELIVERED|CANCELLED
         (default PENDING). Slips live in the PRIVATE store-slips
         bucket and are returned as short-lived signed URLs.
   POST  { order_id, action, reason?, tracking_carrier?, tracking_number? }
         action: APPROVE | REJECT | SHIP | DELIVER | CANCEL
         Runs store_order_transition_atomic(); REJECT/CANCEL
         restore stock in the same transaction.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLIP_BUCKET = "store-slips";
const SIGNED_URL_TTL_SECONDS = 600;
const STATUSES = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];
const ACTIONS = ["APPROVE", "REJECT", "SHIP", "DELIVER", "CANCEL"];

const RPC_ERRORS: Record<string, string> = {
  LOOTFORM_SHOP_INVALID_ACTION: "Action ไม่ถูกต้อง",
  LOOTFORM_SHOP_ORDER_NOT_FOUND: "ไม่พบคำสั่งซื้อ",
  LOOTFORM_SHOP_INVALID_STATUS: "สถานะคำสั่งซื้อเปลี่ยนไปแล้ว กรุณารีเฟรช",
  LOOTFORM_SHOP_REASON_REQUIRED: "กรุณาระบุเหตุผล",
  LOOTFORM_SHOP_TRACKING_REQUIRED: "กรุณาระบุขนส่งและเลขพัสดุ",
};

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(request: NextRequest) {
  const auth = await requireShopAdmin(request);
  if (!auth.ok) return fail(auth.message, auth.status);

  const statusParam = new URL(request.url).searchParams.get("status") ?? "";
  const status = STATUSES.includes(statusParam) ? statusParam : "PENDING";

  const { data: orders, error } = await supabaseAdmin
    .from("store_orders")
    .select(
      `id, reference, user_id, status, subtotal_thb, shipping_fee_thb, total_thb,
       recipient_name, phone, address_line, subdistrict, district, province,
       postal_code, note, slip_image_path, tracking_carrier, tracking_number,
       cancel_reason, reviewed_at, created_at, paid_at, shipped_at, delivered_at,
       items:store_order_items ( id, product_name, size, image_url,
                                unit_price_thb, quantity, line_total_thb )`
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "PENDING" || status === "PAID" })
    .limit(200);

  if (error) {
    console.error("ADMIN SHOP ORDERS GET ERROR:", error);
    return fail("Unable to load orders", 500);
  }

  const userIds = new Set((orders ?? []).map((order) => order.user_id));
  const emailByUserId = new Map<string, string>();

  if (userIds.size > 0) {
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    for (const user of userList?.users ?? []) {
      if (userIds.has(user.id)) emailByUserId.set(user.id, user.email ?? "");
    }
  }

  const enriched = await Promise.all(
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
      };
    })
  );

  return NextResponse.json({ success: true, orders: enriched });
}

export async function POST(request: NextRequest) {
  const auth = await requireShopAdmin(request);
  if (!auth.ok) return fail(auth.message, auth.status);

  const body = await request.json();
  const orderId = Number(body.order_id);
  const action = typeof body.action === "string" ? body.action : "";

  if (!Number.isInteger(orderId) || orderId <= 0) return fail("Invalid order id");
  if (!ACTIONS.includes(action)) return fail("Action ไม่ถูกต้อง");

  const { data, error } = await supabaseAdmin.rpc("store_order_transition_atomic", {
    p_order_id: orderId,
    p_admin_id: auth.userId,
    p_action: action,
    p_reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
    p_tracking_carrier:
      typeof body.tracking_carrier === "string" ? body.tracking_carrier.slice(0, 60) : null,
    p_tracking_number:
      typeof body.tracking_number === "string" ? body.tracking_number.slice(0, 60) : null,
  });

  if (error) {
    const code = Object.keys(RPC_ERRORS).find((key) => error.message?.includes(key));
    if (!code) console.error("ADMIN SHOP ORDER TRANSITION ERROR:", error);
    return fail(code ? RPC_ERRORS[code] : "Unable to update order", code ? 409 : 500);
  }

  return NextResponse.json({ success: true, order: (data as { order: unknown }).order });
}
