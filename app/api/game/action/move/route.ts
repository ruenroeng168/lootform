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

type MoveRequestBody = {
  session_id?: string;
  sessionId?: string;

  direction?: string;
};

const ALLOWED_DIRECTIONS = [
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
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

/* =========================================================
   POST
   Authoritative movement (STEP 2.6).

   Client sends session_id + direction only. resolve_game_move()
   is the sole Authority: it re-verifies ownership/ACTIVE status,
   loads the CURRENT server position, computes the target tile,
   checks bounds/walls, and only then updates position -- this
   route never accepts or trusts a client-supplied position.
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

    let body: MoveRequestBody;

    try {
      body =
        (await request.json()) as MoveRequestBody;
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

    const direction =
      (body.direction ?? "")
        .trim()
        .toUpperCase();

    if (
      !(
        ALLOWED_DIRECTIONS as readonly string[]
      ).includes(direction)
    ) {
      return jsonResponse(
        {
          ok: false,
          code: "INVALID_DIRECTION",
          error: `direction must be one of: ${ALLOWED_DIRECTIONS.join(", ")}`,
        },
        400
      );
    }

    const {
      data: rpcData,
      error: rpcError,
    } =
      await supabaseAdmin
        .rpc(
          "resolve_game_move",
          {
            p_session_id: sessionId,
            p_user_id: userId,
            p_direction: direction,
          }
        );

    if (rpcError) {
      console.error(
        "RESOLVE GAME MOVE RPC ERROR:",
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

      if (
        message.includes(
          "GAME_SESSION_STATE_NOT_FOUND"
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            code: "SESSION_STATE_NOT_FOUND",
            error: "This Game Session has no expedition state.",
          },
          409
        );
      }

      return jsonResponse(
        {
          ok: false,
          code: "MOVE_FAILED",
          error: "Unable to resolve movement.",
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
      200
    );
  } catch (error) {
    console.error(
      "GAME ACTION MOVE API ERROR:",
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
