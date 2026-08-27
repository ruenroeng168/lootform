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
    // 8. SNAPSHOT EFFECTIVE GAME STATS
    //
    // Server Authority (spec section 11/13):
    //   Auth Player -> Read current Equipment -> Read Item Stat
    //   Snapshot -> Calculate Effective Game Stats -> freeze onto
    //   the Session.
    //
    // Equipment changed after this point (including in another tab)
    // must never affect a Session that has already started.
    // =====================================================

    let statsSnapshot;

    try {
      statsSnapshot =
        await computeEffectiveGameStats(
          userId
        );
    } catch (
      statsError
    ) {
      console.error(
        "START GAME - EFFECTIVE STATS ERROR:",
        statsError
      );

      return jsonResponse(
        {
          ok: false,

          code:
            "GAME_STATS_UNAVAILABLE",

          error:
            "Unable to read player Game Stats.",
        },
        500
      );
    }

    // =====================================================
    // 9. CREATE SESSION
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

          stats_snapshot:
            statsSnapshot,
        })
        .select(`
          id,
          game_id,
          status,
          game_code_snapshot,
          game_version_snapshot,
          engine_snapshot,
          started_at,
          stats_snapshot
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
    // 9B. CREATE AUTHORITATIVE EXPEDITION STATE (STEP 2.6)
    //
    // start_x/y, exit_x/y and the map layout are the same fixed
    // constants app/game/play/page.tsx already renders (MAP_SIZE=15,
    // no randomization exists yet -- see STEP 2.6 report). This row
    // is what resolve_game_move() and finalize_game_session() treat
    // as truth; the client never writes to it directly.
    // =====================================================

    const GRID_EXPEDITION_MAP_SIZE = 15;

    let sessionState:
      | {
          current_x: number;
          current_y: number;
          start_x: number;
          start_y: number;
          exit_x: number;
          exit_y: number;
          turn_count: number;
          exit_reached: boolean;
          player_current_hp: number | null;
        }
      | null = null;

    if (
      game.code ===
      "LF-GRID-EXPEDITION"
    ) {
      const {
        data: stateData,

        error: stateError,
      } =
        await supabaseAdmin
          .from(
            "game_session_state"
          )
          .insert({
            session_id:
              sessionData.id,

            start_x: 0,
            start_y: 0,

            exit_x:
              GRID_EXPEDITION_MAP_SIZE -
              1,

            exit_y:
              GRID_EXPEDITION_MAP_SIZE -
              1,

            current_x: 0,
            current_y: 0,

            map_seed:
              "SECTOR-A-01-STATIC-V1",

            map_version:
              "SECTOR-A-01-V1",

            // AUTHORITATIVE (STEP 2.8): starting HP for Combat,
            // taken from the same stats_snapshot already frozen
            // onto the Session above -- never a client value.
            player_current_hp:
              statsSnapshot.effective.hp,
          })
          .select(`
            current_x,
            current_y,
            start_x,
            start_y,
            exit_x,
            exit_y,
            turn_count,
            exit_reached,
            player_current_hp
          `)
          .single();

      if (
        stateError ||
        !stateData
      ) {
        console.error(
          "START GAME - SESSION STATE INSERT ERROR:",
          stateError
        );

        return jsonResponse(
          {
            ok: false,

            code:
              "SESSION_STATE_CREATE_FAILED",

            error:
              "Unable to create expedition state.",
          },
          500
        );
      }

      sessionState =
        stateData;
    }

    // =====================================================
    // 9C. GENERATE AUTHORITATIVE ENCOUNTERS (STEP 2.7)
    //
    // Monster/Elite existence, position and tier are now decided
    // here, server-side, once per session -- the client can no
    // longer invent a monster that was never placed. Same
    // distribution the client's old createEntities() used (5
    // monsters, 50/35/15 SCOUT/GUARD/ELITE), so gameplay feel is
    // unchanged.
    // =====================================================

    let encounters:
      unknown[] = [];

    if (
      game.code ===
        "LF-GRID-EXPEDITION" &&
      sessionState
    ) {
      const {
        data: encounterData,

        error: encounterError,
      } =
        await supabaseAdmin
          .rpc(
            "generate_game_encounters",
            {
              p_session_id:
                sessionData.id,

              p_user_id:
                userId,

              p_count: 5,
            }
          );

      if (encounterError) {
        console.error(
          "START GAME - ENCOUNTER GENERATION ERROR:",
          encounterError
        );

        return jsonResponse(
          {
            ok: false,

            code:
              "ENCOUNTER_GENERATION_FAILED",

            error:
              "Unable to generate expedition encounters.",
          },
          500
        );
      }

      const encounterResult =
        encounterData as {
          encounters?: unknown[];
        };

      encounters =
        encounterResult
          ?.encounters ??
        [];
    }

    // =====================================================
    // 10. RESPONSE
    //
    // No EXP / LT / Item authority is sent to the game.
    // stats_snapshot is display data the server already computed
    // and already froze onto the Session row above.
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

          stats_snapshot:
            sessionData.stats_snapshot,

          state:
            sessionState,

          encounters,
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