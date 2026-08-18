import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

// =====================================
// ADMIN EMAILS
// =====================================

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) =>
      email.trim().toLowerCase()
    )
    .filter(Boolean);
}

// =====================================
// VERIFY ADMIN
// =====================================

async function getAdminUser(
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
    !user ||
    !user.email
  ) {
    return {
      user: null,
      error: "UNAUTHORIZED",
    };
  }

  const adminEmails =
    getAdminEmails();

  const isAdmin =
    adminEmails.includes(
      user.email.toLowerCase()
    );

  if (!isAdmin) {
    return {
      user: null,
      error: "FORBIDDEN",
    };
  }

  return {
    user,
    error: null,
  };
}

// =====================================
// GET BETA RESET PREVIEW
// =====================================

export async function GET(
  request: Request
) {
  try {
    const {
      user,
      error: authError,
    } =
      await getAdminUser(
        request
      );

    if (
      authError ===
      "UNAUTHORIZED"
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

    if (
      authError ===
      "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "คุณไม่มีสิทธิ์เข้าถึง BETA CONTROL",
        },
        {
          status: 403,
        }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin verification failed",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================
    // SYSTEM SETTINGS
    // =====================================

    const {
      data: settings,
      error: settingsError,
    } =
      await supabaseAdmin
        .from(
          "system_settings"
        )
        .select(`
          id,
          environment_mode,
          beta_name,
          beta_started_at,
          beta_ends_at,
          updated_at
        `)
        .eq(
          "id",
          1
        )
        .maybeSingle();

    if (
      settingsError
    ) {
      throw settingsError;
    }

    if (!settings) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบ system_settings",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================
    // TEST ITEMS
    // =====================================

    const {
      count:
        testItemCount,

      error:
        itemCountError,
    } =
      await supabaseAdmin
        .from(
          "items"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "environment_mode",
          "TEST"
        );

    if (
      itemCountError
    ) {
      throw itemCountError;
    }

    // =====================================
    // TEST TRANSACTIONS
    // =====================================

    const {
      data:
        testTransactions,

      error:
        transactionError,
    } =
      await supabaseAdmin
        .from(
          "wallet_transactions"
        )
        .select(`
          id,
          user_id,
          type,
          amount,
          item_id,
          created_at
        `)
        .eq(
          "environment_mode",
          "TEST"
        );

    if (
      transactionError
    ) {
      throw transactionError;
    }

    const transactions =
      testTransactions ??
      [];

    // =====================================
    // TEST TOP-UP ORDERS
    // =====================================

    const {
      data:
        testTopupOrders,

      error:
        topupOrderError,
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
          environment_mode,
          created_at
        `)
        .eq(
          "environment_mode",
          "TEST"
        );

    if (
      topupOrderError
    ) {
      throw topupOrderError;
    }

    const topupOrders =
      testTopupOrders ??
      [];

    // =====================================
    // UNIQUE TEST PLAYERS
    //
    // รวมทั้ง Transaction และ Top-up
    // =====================================

    const transactionUserIds =
      transactions
        .map(
          (transaction) =>
            transaction.user_id
        )
        .filter(Boolean);

    const topupUserIds =
      topupOrders
        .map(
          (order) =>
            order.user_id
        )
        .filter(Boolean);

    const testPlayerIds =
      Array.from(
        new Set([
          ...transactionUserIds,
          ...topupUserIds,
        ])
      );

    // =====================================
    // TRANSACTION STATS
    // =====================================

    const totalTestTopup =
      transactions
        .filter(
          (transaction) =>
            transaction.type ===
            "TOPUP" &&
            Number(
              transaction.amount ??
                0
            ) > 0
        )
        .reduce(
          (
            sum,
            transaction
          ) =>
            sum +
            Number(
              transaction.amount ??
                0
            ),
          0
        );

    const totalTestSpent =
      transactions
        .filter(
          (transaction) =>
            Number(
              transaction.amount ??
                0
            ) < 0
        )
        .reduce(
          (
            sum,
            transaction
          ) =>
            sum +
            Math.abs(
              Number(
                transaction.amount ??
                  0
              )
            ),
          0
        );

    // =====================================
    // TEST TOP-UP THB VALUE
    // =====================================

    const totalTestTopupTHB =
      topupOrders
        .filter(
          (order) =>
            order.status ===
            "PAID"
        )
        .reduce(
          (
            sum,
            order
          ) =>
            sum +
            Number(
              order.amount_thb ??
                0
            ),
          0
        );

    // =====================================
    // WALLET COUNT
    // =====================================

    let affectedWalletCount =
      0;

    if (
      testPlayerIds.length >
      0
    ) {
      const {
        count,
        error:
          walletCountError,
      } =
        await supabaseAdmin
          .from(
            "wallets"
          )
          .select(
            "id",
            {
              count: "exact",
              head: true,
            }
          )
          .in(
            "user_id",
            testPlayerIds
          );

      if (
        walletCountError
      ) {
        throw walletCountError;
      }

      affectedWalletCount =
        count ?? 0;
    }

    // =====================================
    // RESET LOG COUNT
    // =====================================

    const {
      count:
        resetLogCount,

      error:
        resetLogError,
    } =
      await supabaseAdmin
        .from(
          "system_reset_logs"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        );

    if (
      resetLogError
    ) {
      throw resetLogError;
    }

    // =====================================
    // RESPONSE
    // =====================================

    return NextResponse.json({
      success: true,

      admin: {
        email:
          user.email,
      },

      system: {
        environmentMode:
          settings.environment_mode,

        betaName:
          settings.beta_name,

        betaStartedAt:
          settings.beta_started_at,

        betaEndsAt:
          settings.beta_ends_at,

        updatedAt:
          settings.updated_at,
      },

      preview: {
        testItems:
          testItemCount ??
          0,

        testTransactions:
          transactions.length,

        testTopupOrders:
          topupOrders.length,

        affectedPlayers:
          testPlayerIds.length,

        affectedWallets:
          affectedWalletCount,

        totalTestTopup,

        totalTestTopupTHB,

        totalTestSpent,

        previousResets:
          resetLogCount ??
          0,
      },

      resetPlan: {
        deleteTestItems:
          true,

        deleteTestTransactions:
          true,

        deleteTestTopupOrders:
          true,

        resetAffectedWallets:
          true,

        deleteUsers:
          false,

        deleteShippingAddresses:
          false,

        deleteSeasonSettings:
          false,

        deleteSystemSettings:
          false,
      },
    });
  } catch (error) {
    console.error(
      "BETA PREVIEW ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load Beta Reset Preview",
      },
      {
        status: 500,
      }
    );
  }
}