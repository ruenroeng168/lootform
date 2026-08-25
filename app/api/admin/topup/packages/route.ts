import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM ADMIN TOP-UP PACKAGES

   GET    - list all packages (active + inactive)
   POST   - create a package
   PATCH  - update a package (amount_thb / label / is_active / sort_order)
   DELETE - remove a package (?id=)
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT = "id, amount_thb, label, is_active, sort_order, created_at, updated_at";

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

  const { data, error } = await supabaseAdmin
    .from("topup_packages")
    .select(SELECT)
    .order("sort_order", { ascending: true })
    .order("amount_thb", { ascending: true });

  if (error) {
    console.error("ADMIN TOPUP PACKAGES GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load packages" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, packages: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const amountThb = Number(body.amount_thb);
  const label = String(body.label ?? "").trim();
  const sortOrder = Number.isInteger(Number(body.sort_order)) ? Number(body.sort_order) : 0;

  if (!Number.isFinite(amountThb) || amountThb <= 0) {
    return NextResponse.json(
      { success: false, message: "จำนวนเงินต้องมากกว่า 0" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("topup_packages")
    .insert({
      amount_thb: amountThb,
      label: label || null,
      sort_order: sortOrder,
      is_active: true,
    })
    .select(SELECT)
    .single();

  if (error) {
    console.error("ADMIN TOPUP PACKAGES POST ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create package" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, package: data });
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

  const id = Number(body.id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ success: false, message: "Package ID ไม่ถูกต้อง" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.amount_thb !== undefined) {
    const amountThb = Number(body.amount_thb);

    if (!Number.isFinite(amountThb) || amountThb <= 0) {
      return NextResponse.json(
        { success: false, message: "จำนวนเงินต้องมากกว่า 0" },
        { status: 400 }
      );
    }

    update.amount_thb = amountThb;
  }

  if (body.label !== undefined) {
    const label = String(body.label ?? "").trim();
    update.label = label || null;
  }

  if (body.is_active !== undefined) {
    update.is_active = body.is_active === true;
  }

  if (body.sort_order !== undefined) {
    const sortOrder = Number(body.sort_order);
    update.sort_order = Number.isInteger(sortOrder) ? sortOrder : 0;
  }

  const { data, error } = await supabaseAdmin
    .from("topup_packages")
    .update(update)
    .eq("id", id)
    .select(SELECT)
    .single();

  if (error) {
    console.error("ADMIN TOPUP PACKAGES PATCH ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update package" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, package: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const id = Number(new URL(request.url).searchParams.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ success: false, message: "Package ID ไม่ถูกต้อง" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("topup_packages").delete().eq("id", id);

  if (error) {
    console.error("ADMIN TOPUP PACKAGES DELETE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Unable to delete package" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
