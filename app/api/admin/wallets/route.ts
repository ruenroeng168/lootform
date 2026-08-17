import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyAdmin(
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
      status: 401,
      message:
        "กรุณา Login ใหม่",
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
      status: 401,
      message:
        "กรุณา Login ใหม่",
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

export async function GET(
  request: Request
) {
  try {
    const auth =
      await verifyAdmin(
        request
      );

    if (!auth.user) {
      return NextResponse.json(
        {
          success: false,
          message:
            auth.message,
        },
        {
          status:
            auth.status,
        }
      );
    }

    const {
      data: userData,
      error: userError,
    } =
      await supabaseAdmin.auth.admin.listUsers(
        {
          page: 1,
          perPage: 1000,
        }
      );

    if (userError) {
      throw userError;
    }

    const {
      data: wallets,
      error: walletError,
    } = await supabaseAdmin
      .from("wallets")
      .select(`
        id,
        user_id,
        balance,
        created_at,
        updated_at
      `)
      .order("balance", {
        ascending: false,
      });

    if (walletError) {
      throw walletError;
    }

    const {
      data: transactions,
      error:
        transactionError,
    } = await supabaseAdmin
      .from(
        "wallet_transactions"
      )
      .select(`
        id,
        user_id,
        type,
        amount,
        description,
        item_id,
        created_at
      `)
      .order("id", {
        ascending: false,
      })
      .limit(500);

    if (transactionError) {
      throw transactionError;
    }

    const users =
      userData.users ?? [];

    const safeWallets =
      wallets ?? [];

    const safeTransactions =
      transactions ?? [];

    const walletRows =
      safeWallets.map(
        (wallet) => {
          const user =
            users.find(
              (user) =>
                user.id ===
                wallet.user_id
            );

          const userTransactions =
            safeTransactions.filter(
              (transaction) =>
                transaction.user_id ===
                wallet.user_id
            );

          const totalTopup =
            userTransactions
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

          const totalSpent =
            userTransactions
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

          return {
            id: wallet.id,

            user_id:
              wallet.user_id,

            email:
              user?.email ??
              "NO EMAIL",

            balance:
              Number(
                wallet.balance ??
                  0
              ),

            created_at:
              wallet.created_at,

            updated_at:
              wallet.updated_at,

            totalTopup,

            totalSpent,

            transactionCount:
              userTransactions.length,

            transactions:
              userTransactions.slice(
                0,
                20
              ),
          };
        }
      );

    const totalBalance =
      walletRows.reduce(
        (sum, wallet) =>
          sum +
          wallet.balance,
        0
      );

    const totalTopup =
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

    const totalSpent =
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

    return NextResponse.json({
      success: true,

      admin: {
        email:
          auth.user.email,
      },

      stats: {
        totalWallets:
          walletRows.length,

        totalBalance,

        totalTopup,

        totalSpent,

        transactionCount:
          safeTransactions.length,
      },

      wallets:
        walletRows,

      recentTransactions:
        safeTransactions.slice(
          0,
          30
        ),
    });
  } catch (error) {
    console.error(
      "ADMIN WALLETS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load Admin Wallets",
      },
      {
        status: 500,
      }
    );
  }
}