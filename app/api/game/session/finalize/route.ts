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
   TYPES
========================================================= */

type FinalizeRequestBody = {
  session_id?: string;
  sessionId?: string;

  result?: string;

  explored_tiles?: number | null;
  exploredTiles?: number | null;

  map_total_tiles?: number | null;
  mapTotalTiles?: number | null;

  fail_reason?: string | null;
  failReason?: string | null;
};

const ALLOWED_RESULTS = [
  "COMPLETE",
  "FAIL",
] as const;

const ALLOWED_FAIL_REASONS = [
  "PLAYER_HP_DEPLETED",
  "STAMINA_DEPLETED",
] as const;

/* =========================================================
   HELPERS
========================================================= */

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

function safeInteger(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const numeric =
    Number(value);

  if (
    !Number.isFinite(numeric)
  ) {
    return null;
  }

  return Math.round(numeric);
}

/* =========================================================
   POST
   Auth Player -> Session ownership -> ACTIVE -> Finalize
   (finalize_game_session is the sole Authority: it re-verifies
   ownership/status itself, aggregates score/monsters/elites/loot
   from already-recorded game_events, and creates game_results.
   This route only authenticates and forwards non-authoritative
   gameplay telemetry.)
========================================================= */

export async function POST(
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

    if (!accessToken) {
      return jsonResponse(
        {
          ok: false,
          code: "UNAUTHORIZED",
          error: "Missing access token.",
        },
        401
      );
    }

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

    let body: FinalizeRequestBody;

    try {
      body =
        (await request.json()) as FinalizeRequestBody;
    } catch {
      return jsonResponse(
        {
          ok: false,
          code: "INVALID_JSON",
          error: "Invalid request body.",
        },
        400
      );
    }

    const sessionId =
      (
        body.session_id ??
        body.sessionId ??
        ""
      ).trim();

    if (!sessionId) {
      return jsonResponse(
        {
          ok: false,
          code: "SESSION_ID_REQUIRED",
          error: "session_id is required.",
        },
        400
      );
    }

    const result =
      (body.result ?? "")
        .trim()
        .toUpperCase();

    if (
      !(
        ALLOWED_RESULTS as readonly string[]
      ).includes(result)
    ) {
      return jsonResponse(
        {
          ok: false,
          code: "INVALID_RESULT",
          error: `result must be one of: ${ALLOWED_RESULTS.join(", ")}`,
        },
        400
      );
    }

    const rawFailReason =
      body.fail_reason ??
      body.failReason ??
      null;

    let failReason:
      string | null = null;

    if (
      result === "FAIL" &&
      rawFailReason !== null
    ) {
      const normalized =
        String(rawFailReason)
          .trim()
          .toUpperCase();

      if (
        !(
          ALLOWED_FAIL_REASONS as readonly string[]
        ).includes(normalized)
      ) {
        return jsonResponse(
          {
            ok: false,
            code: "INVALID_FAIL_REASON",
            error: `fail_reason must be one of: ${ALLOWED_FAIL_REASONS.join(", ")}`,
          },
          400
        );
      }

      failReason = normalized;
    }

    const exploredTiles =
      safeInteger(
        body.explored_tiles ??
          body.exploredTiles
      );

    const mapTotalTiles =
      safeInteger(
        body.map_total_tiles ??
          body.mapTotalTiles
      );

    const {
      data: rpcData,
      error: rpcError,
    } =
      await supabaseAdmin
        .rpc(
          "finalize_game_session",
          {
            p_session_id: sessionId,
            p_user_id: userId,
            p_result: result,
            p_explored_tiles: exploredTiles,
            p_map_total_tiles: mapTotalTiles,
            p_fail_reason: failReason,
          }
        );

    if (rpcError) {
      console.error(
        "FINALIZE GAME SESSION RPC ERROR:",
        rpcError
      );

      const message =
        rpcError.message ??
        "";

      if (
        message.includes(
          "GAME_SESSION_NOT_FOUND"
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            code: "SESSION_NOT_FOUND",
            error: "Game Session not found.",
          },
          404
        );
      }

      if (
        message.includes(
          "GAME_SESSION_FORBIDDEN"
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            code: "SESSION_FORBIDDEN",
            error: "This Game Session does not belong to the authenticated player.",
          },
          403
        );
      }

      if (
        message.includes(
          "GAME_SESSION_NOT_ACTIVE"
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            code: "SESSION_NOT_ACTIVE",
            error: "This Game Session is not active.",
          },
          409
        );
      }

      return jsonResponse(
        {
          ok: false,
          code: "FINALIZE_FAILED",
          error: "Unable to finalize Game Session.",
        },
        500
      );
    }

    return jsonResponse(
      {
        ok: true,
        ...(rpcData as Record<
          string,
          unknown
        >),
      },
      201
    );
  } catch (error) {
    console.error(
      "FINALIZE GAME SESSION API ERROR:",
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
