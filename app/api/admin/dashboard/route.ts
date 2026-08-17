import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

// =====================================
// ADMIN EMAILS
// =====================================

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// =====================================
// VERIFY ADMIN
// =====================================

async function verifyAdmin(request: Request) {
  const authHeader =
    request.headers.get("authorization");

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    return {
      user: null,
      status: 401,
      message: "กรุณา Login ใหม่",
    };
  }

  const token =
    authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (
    error ||
    !user ||
    !user.email
  ) {
    return {
      user: null,
      status: 401,
      message: "กรุณา Login ใหม่",
    };
  }

  const isAdmin =
    getAdminEmails().includes(
      user.email.toLowerCase()
    );

  if (!isAdmin) {
    return {
      user: null,
      status: 403,
      message:
        "คุณไม่มีสิทธิ์เข้าหน้า Admin",
    };
  }

  return {
    user,
    status: 200,
    message: null,
  };
}

// =====================================
// GET DASHBOARD
// =====================================

export async function GET(
  request: Request
) {
  try {
    const auth =
      await verifyAdmin(request);

    if (!auth.user) {
      return NextResponse.json(
        {
          success: false,
          message: auth.message,
        },
        {
          status: auth.status,
        }
      );
    }

    // =====================================
    // ITEMS
    // =====================================

    const {
      data: items,
      error: itemsError,
    } = await supabaseAdmin
      .from("items")
      .select(`
        id,
        serial,
        product,
        season,
        grade,
        production_status,
        created_at
      `)
      .order("id", {
        ascending: false,
      });

    if (itemsError) {
      throw itemsError;
    }

    // =====================================
    // WALLETS
    // =====================================

    const {
      data: wallets,
      error: walletsError,
    } = await supabaseAdmin
      .from("wallets")
      .select(`
        id,
        user_id,
        balance
      `);

    if (walletsError) {
      throw walletsError;
    }

    // =====================================
    // TRANSACTIONS
    // =====================================

    const {
      data: transactions,
      error: transactionsError,
    } = await supabaseAdmin
      .from("wallet_transactions")
      .select(`
        id,
        type,
        amount,
        created_at
      `)
      .order("id", {
        ascending: false,
      })
      .limit(20);

    if (transactionsError) {
      throw transactionsError;
    }

    const safeItems =
      items ?? [];

    const safeWallets =
      wallets ?? [];

    const safeTransactions =
      transactions ?? [];

    // =====================================
    // GRADE STATS
    // =====================================

    const gradeStats = {
      COMMON: safeItems.filter(
        (item) =>
          item.grade === "COMMON"
      ).length,

      RARE: safeItems.filter(
        (item) =>
          item.grade === "RARE"
      ).length,

      EPIC: safeItems.filter(
        (item) =>
          item.grade === "EPIC"
      ).length,

      LEGENDARY: safeItems.filter(
        (item) =>
          item.grade === "LEGENDARY"
      ).length,
    };

    // =====================================
    // PRODUCTION STATS
    // =====================================

    const productionStats = {
      CRAFTED: safeItems.filter(
        (item) =>
          item.production_status === "CRAFTED"
      ).length,

      PRODUCTION: safeItems.filter(
        (item) =>
          item.production_status === "PRODUCTION"
      ).length,

      QC: safeItems.filter(
        (item) =>
          item.production_status === "QC"
      ).length,

      PACKING: safeItems.filter(
        (item) =>
          item.production_status === "PACKING"
      ).length,

      SHIPPED: safeItems.filter(
        (item) =>
          item.production_status === "SHIPPED"
      ).length,

      DELIVERED: safeItems.filter(
        (item) =>
          item.production_status === "DELIVERED"
      ).length,
    };

    // =====================================
    // WALLET STATS
    // =====================================

    const totalWalletBalance =
      safeWallets.reduce(
        (sum, wallet) =>
          sum +
          Number(
            wallet.balance ?? 0
          ),
        0
      );

    // =====================================
    // RECENT TRANSACTION STATS
    // =====================================

    const recentTopup =
      safeTransactions
        .filter(
          (transaction) =>
            Number(
              transaction.amount
            ) > 0
        )
        .reduce(
          (
            sum,
            transaction
          ) =>
            sum +
            Number(
              transaction.amount
            ),
          0
        );

    const recentSpent =
      safeTransactions
        .filter(
          (transaction) =>
            Number(
              transaction.amount
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
                transaction.amount
              )
            ),
          0
        );

    const recentCrafts =
      safeTransactions.filter(
        (transaction) =>
          transaction.type === "CRAFT"
      ).length;

    // =====================================
    // RESPONSE
    // =====================================

    return NextResponse.json({
      success: true,

      admin: {
        email: auth.user.email,
      },

      stats: {
        totalItems:
          safeItems.length,

        totalWallets:
          safeWallets.length,

        totalWalletBalance,

        grade:
          gradeStats,

        production:
          productionStats,

        transactions: {
          recentTopup,
          recentSpent,
          recentCrafts,
        },
      },

      latestItems:
        safeItems.slice(0, 5),

      recentTransactions:
        safeTransactions.slice(
          0,
          8
        ),
    });
  } catch (error) {
    console.error(
      "ADMIN DASHBOARD ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load Admin Dashboard",
      },
      {
        status: 500,
      }
    );
  }
}