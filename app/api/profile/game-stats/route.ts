import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

import {
  computeEffectiveGameStats,
} from "@/lib/game-stats";

export const dynamic =
  "force-dynamic";

function jsonResponse(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(body, {
    status,

    headers: {
      "Cache-Control":
        "no-store",
    },
  });
}

// =========================================================
// GET
//
// Returns the authenticated player's real, server-computed
// Effective Game Stats: Base character stats + the sum of
// currently equipped items' frozen Craft-time stat snapshots.
//
// This is the same calculation Session Start uses, exposed
// read-only for the Member Home "GAME STATS" panel.
// =========================================================

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
      return jsonResponse(
        {
          ok: false,
          code: "UNAUTHORIZED",
          error: "Missing access token.",
        },
        401
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
      return jsonResponse(
        {
          ok: false,
          code: "UNAUTHORIZED",
          error: "Invalid or expired access token.",
        },
        401
      );
    }

    const stats =
      await computeEffectiveGameStats(
        userData.user.id
      );

    return jsonResponse(
      {
        ok: true,
        stats,
      },
      200
    );
  } catch (error) {
    console.error(
      "GET PROFILE GAME STATS ERROR:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        code: "INTERNAL_SERVER_ERROR",
        error: "Unable to load Game Stats.",
      },
      500
    );
  }
}
