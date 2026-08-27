import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

export const dynamic =
  "force-dynamic";

/* =========================================================
   GET /api/game/access

   Temporary Phase 2 gate for the Game section. Only called by the
   client when NEXT_PUBLIC_GAME_COMING_SOON="true" (see
   lib/game-access.ts) -- when that flag is off/absent, the client
   never calls this route at all and everyone gets in immediately.

   While the gate is on: allowed=true only for emails in the same
   ADMIN_EMAILS allowlist app/api/admin/products/route.ts already
   uses, so the team can keep developing/playtesting while real
   players see a "COMING SOON" screen instead of the actual game.

   This is a presentation/rollout gate only -- it grants no gameplay
   authority and never touches game_sessions, GAME_COIN, drops, or
   inventory.
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          ok: true,
          allowed: false,
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const accessToken =
      authorization
        .slice("Bearer ".length)
        .trim();

    const {
      data: userData,
      error: userError,
    } =
      await supabaseAdmin
        .auth
        .getUser(accessToken);

    if (
      userError ||
      !userData.user
    ) {
      return NextResponse.json(
        {
          ok: true,
          allowed: false,
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const email =
      (
        userData.user.email ??
        ""
      )
        .trim()
        .toLowerCase();

    const adminEmails =
      (
        process.env.ADMIN_EMAILS ??
        ""
      )
        .split(",")
        .map((item) =>
          item
            .trim()
            .toLowerCase()
        )
        .filter(Boolean);

    const allowed =
      email.length > 0 &&
      adminEmails.includes(
        email
      );

    return NextResponse.json(
      {
        ok: true,
        allowed,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "GAME ACCESS CHECK ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: true,
        allowed: false,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}
