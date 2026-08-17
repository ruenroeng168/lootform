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
// GET PLAYERS
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
    // AUTH USERS
    // =====================================

    const {
      data: userData,
      error: usersError,
    } =
      await supabaseAdmin.auth.admin.listUsers(
        {
          page: 1,
          perPage: 1000,
        }
      );

    if (usersError) {
      throw usersError;
    }

    const users =
      userData.users ?? [];

    // =====================================
    // WALLETS
    // =====================================

    const {
      data: wallets,
      error: walletsError,
    } = await supabaseAdmin
      .from("wallets")
      .select(`
        user_id,
        balance,
        created_at,
        updated_at
      `);

    if (walletsError) {
      throw walletsError;
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
        level,
        size,
        owner_id,
        production_status,
        tracking_number,
        created_at
      `)
      .order("id", {
        ascending: false,
      });

    if (itemsError) {
      throw itemsError;
    }

    const safeWallets =
      wallets ?? [];

    const safeItems =
      items ?? [];

    // =====================================
    // BUILD PLAYER DATA
    // =====================================

    const players =
      users.map(
        (user) => {
          const wallet =
            safeWallets.find(
              (wallet) =>
                wallet.user_id ===
                user.id
            );

          const playerItems =
            safeItems.filter(
              (item) =>
                item.owner_id ===
                user.id
            );

          const gradeStats = {
            COMMON:
              playerItems.filter(
                (item) =>
                  item.grade ===
                  "COMMON"
              ).length,

            RARE:
              playerItems.filter(
                (item) =>
                  item.grade ===
                  "RARE"
              ).length,

            EPIC:
              playerItems.filter(
                (item) =>
                  item.grade ===
                  "EPIC"
              ).length,

            LEGENDARY:
              playerItems.filter(
                (item) =>
                  item.grade ===
                  "LEGENDARY"
              ).length,
          };

          return {
            id:
              user.id,

            email:
              user.email ??
              "NO EMAIL",

            created_at:
              user.created_at,

            last_sign_in_at:
              user.last_sign_in_at ??
              null,

            wallet: {
              balance:
                Number(
                  wallet?.balance ??
                    0
                ),
            },

            stats: {
              totalItems:
                playerItems.length,

              grade:
                gradeStats,
            },

            items:
              playerItems.slice(
                0,
                12
              ),
          };
        }
      );

    players.sort(
      (a, b) =>
        new Date(
          b.created_at
        ).getTime() -
        new Date(
          a.created_at
        ).getTime()
    );

    return NextResponse.json({
      success: true,

      admin: {
        email:
          auth.user.email,
      },

      players,
    });
  } catch (error) {
    console.error(
      "ADMIN PLAYERS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load Admin Players",
      },
      {
        status: 500,
      }
    );
  }
}