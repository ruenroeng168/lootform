import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

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

/* =========================================================
   GET /api/game/coin/balance?game_code=LF-GRID-EXPEDITION

   STEP 3: read-only lookup of the caller's own GAME_COIN wallet.
   Never creates or credits anything -- credit_game_coin() (called
   only from resolve_combat / finalize_game_session) does that. If
   no wallet row exists yet, balance is reported as 0 rather than
   creating one here.

   This is GAME_COIN, a separate non-tradable gameplay currency --
   never the LT wallet (public.wallets).
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

    const userId =
      userData.user.id;

    const gameCode =
      request.nextUrl
        .searchParams
        .get("game_code")
        ?.trim()
        .toUpperCase();

    if (!gameCode) {
      return jsonResponse(
        {
          ok: false,
          code: "GAME_CODE_REQUIRED",
          error: "game_code is required.",
        },
        400
      );
    }

    const {
      data: gameRow,

      error: gameError,
    } =
      await supabaseAdmin
        .from("games")
        .select("id")
        .eq("code", gameCode)
        .maybeSingle();

    if (gameError) {
      console.error(
        "GET GAME COIN BALANCE - GAME QUERY ERROR:",
        gameError
      );

      return jsonResponse(
        {
          ok: false,
          code: "GAME_QUERY_FAILED",
          error: "Unable to load game.",
        },
        500
      );
    }

    if (!gameRow) {
      return jsonResponse(
        {
          ok: true,
          balance: 0,
          lifetime_earned: 0,
          lifetime_spent: 0,
        },
        200
      );
    }

    const {
      data: walletRow,

      error: walletError,
    } =
      await supabaseAdmin
        .from("game_coin_wallets")
        .select(`
          balance,
          lifetime_earned,
          lifetime_spent
        `)
        .eq("user_id", userId)
        .eq("game_id", gameRow.id)
        .maybeSingle();

    if (walletError) {
      console.error(
        "GET GAME COIN BALANCE - WALLET QUERY ERROR:",
        walletError
      );

      return jsonResponse(
        {
          ok: false,
          code: "WALLET_QUERY_FAILED",
          error: "Unable to load Game Coin balance.",
        },
        500
      );
    }

    return jsonResponse(
      {
        ok: true,

        balance:
          walletRow?.balance ??
          0,

        lifetime_earned:
          walletRow?.lifetime_earned ??
          0,

        lifetime_spent:
          walletRow?.lifetime_spent ??
          0,
      },
      200
    );
  } catch (error) {
    console.error(
      "GET GAME COIN BALANCE API ERROR:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        code: "INTERNAL_SERVER_ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500
    );
  }
}
