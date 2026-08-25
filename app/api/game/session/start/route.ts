import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

export const dynamic =
  "force-dynamic";

// =========================================================
// TYPES
// =========================================================

type StartGameRequestBody = {
  game_code?: string;
  gameCode?: string;
};

type GameRow = {
  id: number;

  code: string;
  name: string;

  description:
    | string
    | null;

  engine:
    | "CONSTRUCT3"
    | "GDEVELOP"
    | "HTML5"
    | "INTERNAL";

  version: string;

  thumbnail_url:
    | string
    | null;

  launch_url:
    | string
    | null;

  allowed_origin:
    | string
    | null;

  status:
    | "DRAFT"
    | "ACTIVE"
    | "MAINTENANCE"
    | "ARCHIVED";

  supports_score: boolean;
  supports_progress: boolean;
  supports_events: boolean;

  bridge_version: string;

  is_active: boolean;
};

// =========================================================
// RESPONSE
// =========================================================

function jsonResponse(
  body: Record<
    string,
    unknown
  >,
  status: number
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

// =========================================================
// POST
// =========================================================

export async function POST(
  request: NextRequest
) {
  try {
    // =====================================================
    // 1. AUTH TOKEN
    // =====================================================

    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return jsonResponse(
        {
          ok: false,

          code:
            "UNAUTHORIZED",

          error:
            "Missing access token.",
        },
        401
      );
    }

    const accessToken =
      authorization
        .slice(
          "Bearer ".length
        )
        .trim();

    if (!accessToken) {
      return jsonResponse(
        {
          ok: false,

          code:
            "UNAUTHORIZED",

          error:
            "Missing access token.",
        },
        401
      );
    }

    // =====================================================
    // 2. VERIFY PLAYER
    //
    // Browser cannot submit user_id.
    // Server gets user_id from verified Supabase Auth.
    // =====================================================

    const {
      data:
        userData,

      error:
        userError,
    } =
      await supabaseAdmin
        .auth
        .getUser(
          accessToken
        );

    if (
      userError ||
      !userData.user
    ) {
      return jsonResponse(
        {
          ok: false,

          code:
            "UNAUTHORIZED",

          error:
            "Invalid or expired access token.",
        },
        401
      );
    }

    const userId =
      userData.user.id;

    // =====================================================
    // 3. REQUEST BODY
    // =====================================================

    let body:
      StartGameRequestBody;

    try {
      body =
        (await request.json()) as StartGameRequestBody;
    } catch {
      return jsonResponse(
        {
          ok: false,

          code:
            "INVALID_JSON",

          error:
            "Invalid request body.",
        },
        400
      );
    }

    const gameCode =
      (
        body.game_code ??
        body.gameCode ??
        ""
      )
        .trim()
        .toUpperCase();

    if (!gameCode) {
      return jsonResponse(
        {
          ok: false,

          code:
            "GAME_CODE_REQUIRED",

          error:
            "game_code is required.",
        },
        400
      );
    }

    // =====================================================
    // 4. LOAD GAME CATALOG
    // =====================================================

    const {
      data:
        gameData,

      error:
        gameError,
    } =
      await supabaseAdmin
        .from(
          "games"
        )
        .select(`
          id,
          code,
          name,
          description,
          engine,
          version,
          thumbnail_url,
          launch_url,
          allowed_origin,
          status,
          supports_score,
          supports_progress,
          supports_events,
          bridge_version,
          is_active
        `)
        .eq(
          "code",
          gameCode
        )
        .maybeSingle();

    if (gameError) {
      console.error(
        "START GAME - GAME QUERY ERROR:",
        gameError
      );

      return jsonResponse(
        {
          ok: false,

          code:
            "GAME_QUERY_FAILED",

          error:
            "Unable to load game.",
        },
        500
      );
    }

    const game =
      gameData as
        | GameRow
        | null;

    if (!game) {
      return jsonResponse(
        {
          ok: false,

          code:
            "GAME_NOT_FOUND",

          error:
            "Game not found.",
        },
        404
      );
    }

    // =====================================================
    // 5. GAME STATUS
    // =====================================================

    if (!game.is_active) {
      return jsonResponse(
        {
          ok: false,

          code:
            "GAME_DISABLED",

          error:
            "This game is disabled.",
        },
        409
      );
    }

    if (
      game.status !==
      "ACTIVE"
    ) {
      return jsonResponse(
        {
          ok: false,

          code:
            "GAME_NOT_ACTIVE",

          error:
            `Game status is ${game.status}.`,
        },
        409
      );
    }

    // =====================================================
    // 6. EXTERNAL GAME CHECK
    //
    // Construct 3 / GDevelop / HTML5 need launch_url.
    // INTERNAL games do not.
    // =====================================================

    if (
      game.engine !==
        "INTERNAL" &&
      !game.launch_url
    ) {
      return jsonResponse(
        {
          ok: false,

          code:
            "GAME_LAUNCH_NOT_READY",

          error:
            "Game launch URL is not configured.",
        },
        409
      );
    }

    // =====================================================
    // 7. CLOSE PREVIOUS ACTIVE SESSION FOR THIS GAME
    //
    // Keep one active session per player/game. Starting a new
    // run abandons the previous unfinished run instead of
    // leaving ACTIVE sessions behind indefinitely.
    // =====================================================

    const now =
      new Date()
        .toISOString();

    const {
      error:
        abandonError,
    } =
      await supabaseAdmin
        .from(
          "game_sessions"
        )
        .update({
          status:
            "ABANDONED",

          completed_at:
            now,

          last_event_at:
            now,
        })
        .eq(
          "user_id",
          userId
        )
        .eq(
          "game_id",
          game.id
        )
        .eq(
          "status",
          "ACTIVE"
        );

    if (abandonError) {
      console.error(
        "START GAME - ABANDON PREVIOUS SESSION ERROR:",
        abandonError
      );

      return jsonResponse(
        {
          ok: false,

          code:
            "SESSION_CLEANUP_FAILED",

          error:
            "Unable to prepare a new game session.",
        },
        500
      );
    }

    // =====================================================
    // 8. CREATE SESSION
    // =====================================================

    const {
      data:
        sessionData,

      error:
        sessionError,
    } =
      await supabaseAdmin
        .from(
          "game_sessions"
        )
        .insert({
          game_id:
            game.id,

          user_id:
            userId,

          status:
            "ACTIVE",

          game_code_snapshot:
            game.code,

          game_version_snapshot:
            game.version,

          engine_snapshot:
            game.engine,

          started_at:
            now,

          last_event_at:
            null,

          completed_at:
            null,

          final_score:
            null,

          result_payload:
            {},
        })
        .select(`
          id,
          game_id,
          status,
          game_code_snapshot,
          game_version_snapshot,
          engine_snapshot,
          started_at
        `)
        .single();

    if (
      sessionError ||
      !sessionData
    ) {
      console.error(
        "START GAME - SESSION INSERT ERROR:",
        sessionError
      );

      return jsonResponse(
        {
          ok: false,

          code:
            "SESSION_CREATE_FAILED",

          error:
            "Unable to create game session.",
        },
        500
      );
    }

    // =====================================================
    // 9. RESPONSE
    //
    // No EXP / LT / Item authority is sent to the game.
    // =====================================================

    return jsonResponse(
      {
        ok: true,

        session: {
          id:
            sessionData.id,

          status:
            sessionData.status,

          started_at:
            sessionData.started_at,
        },

        game: {
          id:
            game.id,

          code:
            game.code,

          name:
            game.name,

          engine:
            game.engine,

          version:
            game.version,

          launch_url:
            game.launch_url,
        },

        bridge: {
          version:
            game.bridge_version,

          allowed_origin:
            game.allowed_origin,

          supports: {
            score:
              game.supports_score,

            progress:
              game.supports_progress,

            events:
              game.supports_events,
          },
        },
      },
      201
    );
  } catch (error) {
    console.error(
      "START GAME SESSION API ERROR:",
      error
    );

    return jsonResponse(
      {
        ok: false,

        code:
          "INTERNAL_SERVER_ERROR",

        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500
    );
  }
}