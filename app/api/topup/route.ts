import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_AMOUNTS = [100, 500, 1000, 2000];

export async function POST(request: Request) {
  try {
    // ==============================
    // 1. ตรวจ Authorization
    // ==============================

    const authHeader =
      request.headers.get("authorization");

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "กรุณาเข้าสู่ระบบ",
        },
        {
          status: 401,
        }
      );
    }

    const token =
      authHeader.replace("Bearer ", "");

    // ==============================
    // 2. ตรวจ User
    // ==============================

    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        token
      );

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session หมดอายุ กรุณา Login ใหม่",
        },
        {
          status: 401,
        }
      );
    }

    // ==============================
    // 3. อ่านจำนวน Token
    // ==============================

    const body = await request.json();

    const amount = Number(body.amount);

    if (
      !ALLOWED_AMOUNTS.includes(amount)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "จำนวน Token ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    // ==============================
    // 4. อ่าน Wallet
    // ==============================

    const {
      data: wallet,
      error: walletError,
    } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        {
          success: false,
          message: "ไม่พบ Wallet",
        },
        {
          status: 400,
        }
      );
    }

    // ==============================
    // 5. คำนวณยอดใหม่
    // ==============================

    const newBalance =
      wallet.balance + amount;

    // ==============================
    // 6. Update Wallet
    // ==============================

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("wallets")
      .update({
        balance: newBalance,
        updated_at:
          new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    // ==============================
    // 7. บันทึก Transaction
    // ==============================

    const {
      error: transactionError,
    } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        user_id: user.id,
        type: "TOPUP",
        amount,
        description:
          `Test Top Up ${amount} LT`,
      });

    if (transactionError) {
      throw transactionError;
    }

    // ==============================
    // 8. ส่งผลกลับ
    // ==============================

    return NextResponse.json({
      success: true,

      topup: {
        amount,
      },

      wallet: {
        balance: newBalance,
      },
    });
  } catch (error) {
    console.error(
      "TOPUP ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Top Up failed",
      },
      {
        status: 500,
      }
    );
  }
}