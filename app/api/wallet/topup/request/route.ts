import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM PLAYER TOP-UP REQUEST

   Player picks an Admin-configured package and uploads a payment
   slip. This ONLY creates a PENDING order + stores the slip — the
   wallet is NOT credited here. Only an Admin approving the order
   via topup_review_atomic() (see /api/admin/topup/orders/review)
   can credit the wallet, so an uploaded slip alone can never grant
   tokens.

   BUCKET: topup-slips (PRIVATE)
   MAX: 5 MB
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "topup-slips";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function getFileExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return "webp";
}

function generateReference() {
  const now = new Date();

  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, "");

  const randomPart = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

  return `TP-${datePart}-${timePart}-${randomPart}`;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401);
    }

    const token = authorization.slice(7).trim();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return errorResponse("Invalid or expired session", 401);
    }

    const user = userData.user;

    const formData = await request.formData();
    const packageId = Number(formData.get("package_id"));
    const fileValue = formData.get("file");

    if (!Number.isInteger(packageId) || packageId <= 0) {
      return errorResponse("กรุณาเลือกแพ็คเกจ");
    }

    if (!(fileValue instanceof File)) {
      return errorResponse("กรุณาแนบสลิปการโอนเงิน");
    }

    const file = fileValue;

    if (file.size <= 0) {
      return errorResponse("ไฟล์สลิปว่างเปล่า");
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("สลิปต้องมีขนาดไม่เกิน 5 MB");
    }

    if (!VALID_MIME_TYPES.includes(file.type)) {
      return errorResponse("รองรับเฉพาะไฟล์ JPEG, PNG และ WEBP");
    }

    const [{ data: pkg, error: pkgError }, { data: settings, error: settingsError }, { data: systemSettings }] =
      await Promise.all([
        supabaseAdmin
          .from("topup_packages")
          .select("id, amount_thb, is_active")
          .eq("id", packageId)
          .maybeSingle(),
        supabaseAdmin
          .from("topup_settings")
          .select("rate_lt_per_thb")
          .eq("id", 1)
          .maybeSingle(),
        supabaseAdmin.from("system_settings").select("environment_mode").eq("id", 1).maybeSingle(),
      ]);

    if (pkgError) {
      console.error("TOPUP REQUEST PACKAGE LOAD ERROR:", pkgError);
      return errorResponse("Unable to load package", 500);
    }

    if (!pkg || !pkg.is_active) {
      return errorResponse("แพ็คเกจนี้ไม่พร้อมใช้งาน");
    }

    if (settingsError || !settings) {
      console.error("TOPUP REQUEST SETTINGS LOAD ERROR:", settingsError);
      return errorResponse("Unable to load top-up settings", 500);
    }

    const rate = Number(settings.rate_lt_per_thb);
    const amountThb = Number(pkg.amount_thb);
    const tokenAmount = Math.round(amountThb * rate);

    const extension = getFileExtension(file);
    const storagePath = `${user.id}/${Date.now()}-${randomUUID()}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        cacheControl: "0",
        upsert: false,
      });

    if (uploadError) {
      console.error("TOPUP SLIP STORAGE ERROR:", uploadError);
      return errorResponse("ไม่สามารถอัปโหลดสลิปได้", 500);
    }

    const reference = generateReference();

    const { data: order, error: orderError } = await supabaseAdmin
      .from("topup_orders")
      .insert({
        reference,
        user_id: user.id,
        package_code: `PKG-${pkg.id}`,
        package_id: pkg.id,
        amount_thb: amountThb,
        token_amount: tokenAmount,
        rate_lt_per_thb_snapshot: rate,
        status: "PENDING",
        payment_method: "BANK_TRANSFER",
        slip_image_path: storagePath,
        environment_mode: systemSettings?.environment_mode ?? "LIVE",
      })
      .select(
        "id, reference, amount_thb, token_amount, status, created_at"
      )
      .single();

    if (orderError) {
      console.error("TOPUP REQUEST ORDER INSERT ERROR:", orderError);

      const { error: cleanupError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([storagePath]);

      if (cleanupError) {
        console.error("TOPUP SLIP CLEANUP ERROR:", cleanupError);
      }

      return errorResponse("Unable to create top-up order", 500);
    }

    return NextResponse.json(
      { success: true, order },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("TOPUP REQUEST API INTERNAL ERROR:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to submit top-up request",
      500
    );
  }
}
