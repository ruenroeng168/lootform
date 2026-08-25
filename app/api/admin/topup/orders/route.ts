import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM ADMIN TOP-UP ORDERS

   GET ?status=PENDING|PAID|REJECTED (default PENDING)

   Slip images live in the PRIVATE topup-slips bucket, so each
   order's slip_image_path is resolved to a short-lived signed URL
   here rather than exposing a public URL.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLIP_BUCKET = "topup-slips";
const SIGNED_URL_TTL_SECONDS = 600;

const SELECT = `
  id, reference, user_id, package_code, package_id, amount_thb,
  token_amount, rate_lt_per_thb_snapshot, status, payment_method,
  slip_image_path, reviewed_by, reviewed_at, reject_reason,
  environment_mode, created_at, paid_at, updated_at
`;

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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const statusParam = new URL(request.url).searchParams.get("status");
  const status = ["PENDING", "PAID", "REJECTED"].includes(statusParam ?? "")
    ? (statusParam as string)
    : "PENDING";

  const { data: orders, error } = await supabaseAdmin
    .from("topup_orders")
    .select(SELECT)
    .eq("status", status)
    .order("created_at", { ascending: status === "PENDING" });

  if (error) {
    console.error("ADMIN TOPUP ORDERS GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load top-up orders" },
      { status: 500 }
    );
  }

  const userIds = Array.from(new Set((orders ?? []).map((order) => order.user_id)));

  const emailByUserId = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    for (const user of userList?.users ?? []) {
      if (userIds.includes(user.id)) {
        emailByUserId.set(user.id, user.email ?? "");
      }
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
      };
    })
  );

  return NextResponse.json({ success: true, orders: enrichedOrders });
}
