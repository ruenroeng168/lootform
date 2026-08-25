import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM ADMIN TOP-UP ORDER REVIEW

   PATCH { order_id, action: "APPROVE" | "REJECT", reject_reason? }

   Delegates to the topup_review_atomic() RPC, which locks the
   order row, guards against double-review, and (on APPROVE) credits
   the wallet + inserts the ledger entry in the same DB transaction.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false as const, status: 401, message: "Invalid or expired session" };
  }

  const email = (data.user.email ?? "").trim().toLowerCase();

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!email || !adminEmails.includes(email)) {
    return { ok: false as const, status: 403, message: "Admin access required" };
  }

  return { ok: true as const, userId: data.user.id, email };
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
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

  const { data, error } = await supabaseAdmin.rpc("topup_review_atomic", {
    p_order_id: orderId,
    p_admin_id: auth.userId,
    p_action: action,
    p_reject_reason: action === "REJECT" ? rejectReason : null,
  });

  if (error) {
    console.error("ADMIN TOPUP REVIEW RPC ERROR:", error);

    const message =
      error.message === "LOOTFORM_TOPUP_ALREADY_REVIEWED"
        ? "Order นี้ถูกตรวจสอบไปแล้ว"
        : error.message === "LOOTFORM_TOPUP_ORDER_NOT_FOUND"
        ? "ไม่พบ Order นี้"
        : error.message === "LOOTFORM_WALLET_NOT_FOUND"
        ? "ไม่พบ Wallet ของผู้เล่นคนนี้"
        : "Unable to review top-up order";

    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  return NextResponse.json({ success: true, result: data });
}
