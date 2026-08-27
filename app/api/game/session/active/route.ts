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
   GET /api/game/session/active?game_code=LF-GRID-EXPEDITION

   STEP 2.6 refresh recovery: lets the client ask "do I already
   have an ACTIVE Session for this game" instead of assuming none
   and calling Session Start again (which would abandon the real,
   in-progress one and reset position to Player Start).

   Read-only. Never creates or abandons anything.
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
        "GET ACTIVE SESSION - GAME QUERY ERROR:",
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
          session: null,
          state: null,
        },
        200
      );
    }

    const {
      data: sessionRow,

      error: sessionError,
    } =
      await supabaseAdmin
        .from("game_sessions")
        .select(`
          id,
          status,
          started_at,
          stats_snapshot
        `)
        .eq("user_id", userId)
        .eq("game_id", gameRow.id)
        .eq("status", "ACTIVE")
        .order("started_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (sessionError) {
      console.error(
        "GET ACTIVE SESSION - SESSION QUERY ERROR:",
        sessionError
      );

      return jsonResponse(
        {
          ok: false,
          code: "SESSION_QUERY_FAILED",
          error: "Unable to load active session.",
        },
        500
      );
    }

    if (!sessionRow) {
      return jsonResponse(
        {
          ok: true,
          session: null,
          state: null,
        },
        200
      );
    }

    const {
      data: stateRow,

      error: stateError,
    } =
      await supabaseAdmin
        .from("game_session_state")
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
        .eq("session_id", sessionRow.id)
        .maybeSingle();

    if (stateError) {
      console.error(
        "GET ACTIVE SESSION - STATE QUERY ERROR:",
        stateError
      );

      return jsonResponse(
        {
          ok: false,
          code: "SESSION_STATE_QUERY_FAILED",
          error: "Unable to load expedition state.",
        },
        500
      );
    }

    // =====================================================
    // ENCOUNTERS (STEP 2.7 refresh recovery)
    //
    // Only AVAILABLE/ACTIVE -- DEFEATED ones stay resolved and are
    // not needed to redraw the grid.
    // =====================================================

    const {
      data: encounterRows,

      error: encounterError,
    } =
      await supabaseAdmin
        .from("game_encounters")
        .select(`
          id,
          tier,
          monster_code,
          x,
          y,
          max_hp,
          current_hp,
          status
        `)
        .eq("session_id", sessionRow.id)
        .in("status", ["AVAILABLE", "ACTIVE"]);

    if (encounterError) {
      console.error(
        "GET ACTIVE SESSION - ENCOUNTER QUERY ERROR:",
        encounterError
      );

      return jsonResponse(
        {
          ok: false,
          code: "SESSION_ENCOUNTERS_QUERY_FAILED",
          error: "Unable to load expedition encounters.",
        },
        500
      );
    }

    // =====================================================
    // RUN LOOT (STEP 4B refresh recovery)
    //
    // UNEXTRACTED loot already rolled by resolve_combat() for this
    // session. Read-only, aggregated by item -- never written here.
    // =====================================================

    const {
      data: lootRows,

      error: lootError,
    } =
      await supabaseAdmin
        .from("game_session_loot")
        .select(`
          item_definition_id,
          quantity,
          rarity_snapshot,
          status,
          game_item_definitions (
            code,
            name
          )
        `)
        .eq("session_id", sessionRow.id)
        .eq("status", "UNEXTRACTED");

    if (lootError) {
      console.error(
        "GET ACTIVE SESSION - RUN LOOT QUERY ERROR:",
        lootError
      );

      return jsonResponse(
        {
          ok: false,
          code: "SESSION_RUN_LOOT_QUERY_FAILED",
          error: "Unable to load run loot.",
        },
        500
      );
    }

    const runLootByItem = new Map<
      number,
      {
        item_code: string;
        item_name: string;
        rarity: string;
        quantity: number;
      }
    >();

    for (const row of lootRows ?? []) {
      const definition =
        row.game_item_definitions as unknown as
          | { code: string; name: string }
          | null;

      if (!definition) {
        continue;
      }

      const existing =
        runLootByItem.get(
          row.item_definition_id
        );

      runLootByItem.set(row.item_definition_id, {
        item_code: definition.code,
        item_name: definition.name,
        rarity: row.rarity_snapshot,
        quantity:
          (existing?.quantity ?? 0) +
          row.quantity,
      });
    }

    return jsonResponse(
      {
        ok: true,

        session: {
          id: sessionRow.id,
          status: sessionRow.status,
          started_at: sessionRow.started_at,
          stats_snapshot: sessionRow.stats_snapshot,
        },

        state: stateRow ?? null,

        encounters: encounterRows ?? [],

        run_loot: Array.from(
          runLootByItem.values()
        ),
      },
      200
    );
  } catch (error) {
    console.error(
      "GET ACTIVE SESSION API ERROR:",
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
