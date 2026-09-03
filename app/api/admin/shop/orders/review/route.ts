import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

/* =========================================================
   LOOTFORM ADMIN SHOP ORDER REVIEW

   PATCH { order_id, action: "APPROVE" | "REJECT", reject_reason? }

   Delegates to shop_order_review_atomic(), which locks the order
   row and guards against double-review. Unlike topup_review_atomic,
   APPROVE never touches wallets/wallet_transactions -- this is a
   plain physical-goods sale, not an LT credit.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
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

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const orderId = Number(body.order_id);
  const action = String(body.action ?? "").toUpperCase();
  const rejectReason = String(body.reject_reason ?? "").trim();

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ success: false, message: "Order ID ไม่ถูกต้อง" }, { status: 400 });
  }

  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ success: false, message: "Action ไม่ถูกต้อง" }, { status: 400 });
  }

  if (action === "REJECT" && !rejectReason) {
    return NextResponse.json(
      { success: false, message: "กรุณาระบุเหตุผลที่ปฏิเสธ" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.rpc("shop_order_review_atomic", {
    p_order_id: orderId,
    p_admin_id: user.id,
    p_action: action,
    p_reject_reason: action === "REJECT" ? rejectReason : null,
  });

  if (error) {
    console.error("ADMIN SHOP ORDER REVIEW RPC ERROR:", error);

    const message =
      error.message === "LOOTFORM_SHOP_ORDER_ALREADY_REVIEWED"
        ? "Order นี้ถูกตรวจสอบไปแล้ว"
        : error.message === "LOOTFORM_SHOP_ORDER_NOT_FOUND"
        ? "ไม่พบ Order นี้"
        : "Unable to review shop order";

    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  return NextResponse.json({ success: true, result: data });
}
