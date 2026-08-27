import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

export const dynamic =
  "force-dynamic";

type AttackRequestBody = {
  session_id?: string;
  sessionId?: string;

  encounter_id?: number;
  encounterId?: number;
};

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
   Authoritative combat (STEP 2.8).

   Client sends only session_id + encounter_id -- "I am fighting
   this encounter." resolve_combat() is the sole Authority: it
   re-verifies ownership/ACTIVE session/ACTIVE encounter, reads
   Player ATK/DEF from the Session's own frozen stats_snapshot,
   reads Player HP from game_session_state, reads Monster stats
   from game_monster_rules, computes the entire fight, and is the
   one that marks the encounter DEFEATED and records the kill event
   on a win. The client never sends or is trusted for damage, HP,
   or the outcome.
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

    let body: AttackRequestBody;

    try {
      body =
        (await request.json()) as AttackRequestBody;
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

    const rawEncounterId =
      body.encounter_id ??
      body.encounterId;

    const encounterId =
      typeof rawEncounterId ===
        "number" &&
      Number.isFinite(
        rawEncounterId
      )
        ? rawEncounterId
        : null;

    if (encounterId === null) {
      return jsonResponse(
        {
          ok: false,
          code: "ENCOUNTER_ID_REQUIRED",
          error: "encounter_id is required.",
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
          "resolve_combat",
          {
            p_session_id: sessionId,
            p_user_id: userId,
            p_encounter_id: encounterId,
          }
        );

    if (rpcError) {
      console.error(
        "RESOLVE COMBAT RPC ERROR:",
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
          "ENCOUNTER_NOT_FOUND"
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            code: "ENCOUNTER_NOT_FOUND",
            error: "Encounter not found.",
          },
          404
        );
      }

      if (
        message.includes(
          "ENCOUNTER_SESSION_MISMATCH"
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            code: "ENCOUNTER_FORBIDDEN",
            error:
              "This encounter does not belong to this session.",
          },
          403
        );
      }

      if (
        message.includes(
          "ENCOUNTER_NOT_ACTIVE"
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            code: "ENCOUNTER_NOT_ACTIVE",
            error:
              "This encounter is not currently active.",
          },
          409
        );
      }

      if (
        message.includes(
          "MONSTER_RULE_NOT_FOUND"
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            code: "MONSTER_RULE_NOT_FOUND",
            error:
              "Unable to resolve monster rules for this encounter.",
          },
          500
        );
      }

      return jsonResponse(
        {
          ok: false,
          code: "COMBAT_RESOLVE_FAILED",
          error: "Unable to resolve combat.",
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
      "GAME ACTION ATTACK API ERROR:",
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
