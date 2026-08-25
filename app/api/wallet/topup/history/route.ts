import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

// =====================================
// VERIFY USER
// =====================================

async function getUser(
  request: Request
) {
  const authHeader =
    request.headers.get(
      "authorization"
    );

  if (
    !authHeader ||
    !authHeader.startsWith(
      "Bearer "
    )
  ) {
    return {
      user: null,
      error: "UNAUTHORIZED",
    };
  }

  const token =
    authHeader.replace(
      "Bearer ",
      ""
    );

  const {
    data: { user },
    error,
  } =
    await supabaseAdmin.auth.getUser(
      token
    );

  if (
    error ||
    !user
  ) {
    return {
      user: null,
      error: "UNAUTHORIZED",
    };
  }

  return {
    user,
    error: null,
  };
}

// =====================================
// GET TOP-UP HISTORY
// =====================================

export async function GET(
  request: Request
) {
  try {
    // =====================================
    // AUTH
    // =====================================

    const {
      user,
      error: authError,
    } =
      await getUser(
        request
      );

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณา Login ใหม่",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================
    // LOAD ORDERS
    // =====================================

    const {
      data: orders,
      error: orderError,
    } =
      await supabaseAdmin
        .from(
          "topup_orders"
        )
        .select(`
          id,
          reference,
          user_id,
          package_code,
          amount_thb,
          token_amount,
          status,
          payment_method,
          provider_reference,
          reject_reason,
          environment_mode,
          created_at,
          paid_at,
          updated_at
        `)
        .eq(
          "user_id",
          user.id
        )
        .order(
          "id",
          {
            ascending: false,
          }
        )
        .limit(50);

    if (
      orderError
    ) {
      console.error(
        "TOPUP HISTORY ERROR:",
        orderError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่สามารถโหลดประวัติ Top-up ได้",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================
    // STATS
    // =====================================

    const safeOrders =
      orders ?? [];

    const paidOrders =
      safeOrders.filter(
        (order) =>
          order.status ===
          "PAID"
      );

    const totalTokens =
      paidOrders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.token_amount ??
              0
          ),
        0
      );

    const totalTHB =
      paidOrders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.amount_thb ??
              0
          ),
        0
      );

    // =====================================
    // RESPONSE
    // =====================================

    return NextResponse.json({
      success: true,

      stats: {
        totalOrders:
          safeOrders.length,

        paidOrders:
          paidOrders.length,

        totalTokens,

        totalTHB,
      },

      orders:
        safeOrders,
    });
  } catch (error) {
    console.error(
      "TOPUP HISTORY API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load Top-up History",
      },
      {
        status: 500,
      }
    );
  }
}