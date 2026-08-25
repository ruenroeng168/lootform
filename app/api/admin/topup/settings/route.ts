import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM ADMIN TOP-UP SETTINGS

   Singleton row (id=1): bank details + QR + THB->LT rate.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TopupSettings = {
  id: number;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  qr_image_url: string | null;
  qr_image_path: string | null;
  rate_lt_per_thb: number;
  updated_at: string;
};

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

const SELECT = `
  id, bank_name, bank_account_name, bank_account_number,
  qr_image_url, qr_image_path, rate_lt_per_thb, updated_at
`;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const { data, error } = await supabaseAdmin
    .from("topup_settings")
    .select(SELECT)
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("ADMIN TOPUP SETTINGS GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load top-up settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, settings: data as TopupSettings });
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

  const bankName = String(body.bank_name ?? "").trim();
  const bankAccountName = String(body.bank_account_name ?? "").trim();
  const bankAccountNumber = String(body.bank_account_number ?? "").trim();
  const rate = Number(body.rate_lt_per_thb);

  if (!bankName) {
    return NextResponse.json({ success: false, message: "กรุณาใส่ชื่อธนาคาร" }, { status: 400 });
  }

  if (!bankAccountName) {
    return NextResponse.json(
      { success: false, message: "กรุณาใส่ชื่อบัญชี" },
      { status: 400 }
    );
  }

  if (!bankAccountNumber) {
    return NextResponse.json(
      { success: false, message: "กรุณาใส่เลขบัญชี" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json(
      { success: false, message: "อัตราแลกเปลี่ยนต้องมากกว่า 0" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("topup_settings")
    .update({
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_number: bankAccountNumber,
      rate_lt_per_thb: rate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select(SELECT)
    .single();

  if (error) {
    console.error("ADMIN TOPUP SETTINGS PATCH ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update top-up settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, settings: data as TopupSettings });
}
