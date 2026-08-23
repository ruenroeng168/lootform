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
   EVENT TYPES
   Must match public.game_events_event_type_check
========================================================= */

const ALLOWED_EVENT_TYPES = [
  "GAME_READY",
  "GAME_START",
  "SCORE",
  "PROGRESS",
  "CHECKPOINT",
  "COMPLETE",
  "FAIL",
  "CUSTOM",
] as const;

type GameEventType =
  (typeof ALLOWED_EVENT_TYPES)[number];

/* =========================================================
   MONSTER
========================================================= */

const MONSTER_TIERS = [
  "SCOUT",
  "GUARD",
  "ELITE",
] as const;

type MonsterTier =
  (typeof MONSTER_TIERS)[number];

/* =========================================================
   REQUEST
========================================================= */

type GameEventRequestBody = {
  session_id?: string;
  sessionId?: string;

  event_type?: string;
  eventType?: string;

  event_name?: string | null;
  eventName?: string | null;

  numeric_value?: number | null;
  numericValue?: number | null;

  payload?: unknown;
};

/* =========================================================
   SESSION
========================================================= */

type GameSessionRow = {
  id: string;

  game_id: number;

  user_id: string;

  status: string;

  game_code_snapshot:
    | string
    | null;

  game_version_snapshot:
    | string
    | null;

  engine_snapshot:
    | string
    | null;

  started_at:
    | string
    | null;

  last_event_at:
    | string
    | null;

  completed_at:
    | string
    | null;

  final_score:
    | number
    | null;
};

/* =========================================================
   MONSTER RULE
========================================================= */

type MonsterRuleRow = {
  id: number;

  code: string;

  name: string;

  tier: string;

  base_hp: number;

  base_atk: number;

  base_def: number;

  base_exp: number;

  base_score: number;

  is_boss: boolean;

  is_active: boolean;
};

/* =========================================================
   MAP RULE
========================================================= */

type GameMapRow = {
  id: number;

  code: string;

  name: string;

  map_number: number;

  map_level: number;

  monster_exp_multiplier:
    | number
    | string;

  status: string;

  is_active: boolean;
};

/* =========================================================
   EXP CANDIDATE

   IMPORTANT:
   This is NOT a persistent EXP award.

   The server calculates what EXP the gameplay event
   would be worth from trusted DB rules.

   Actual profile EXP will only be awarded after
   server-side monster/entity validation exists.
========================================================= */

type MonsterExpCandidate = {
  eligible: boolean;

  persistent_award: false;

  reason: string;

  monster:
    | {
        id: number;

        code: string;

        name: string;

        tier: MonsterTier;

        base_exp: number;
      }
    | null;

  map:
    | {
        id: number;

        code: string;

        name: string;

        map_number: number;

        map_level: number;

        exp_multiplier: number;

        status: string;

        is_active: boolean;
      }
    | null;

  calculated_exp: number | null;
};

/* =========================================================
   HELPERS
========================================================= */

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

/* =========================================================
   ALLOWED EVENT
========================================================= */

function isAllowedEventType(
  value: string
): value is GameEventType {
  return (
    ALLOWED_EVENT_TYPES as readonly string[]
  ).includes(
    value
  );
}

/* =========================================================
   PLAIN OBJECT
========================================================= */

function isPlainObject(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value
    )
  );
}

/* =========================================================
   CLEAN TEXT
========================================================= */

function cleanText(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}

/* =========================================================
   MONSTER TIER
========================================================= */

function normalizeMonsterTier(
  value: unknown
): MonsterTier | null {
  const tier =
    cleanText(
      value
    ).toUpperCase();

  if (
    !(
      MONSTER_TIERS as readonly string[]
    ).includes(
      tier
    )
  ) {
    return null;
  }

  return tier as MonsterTier;
}

/* =========================================================
   MAP CODE

   Browser prototype currently may send:

   SECTOR_A_01

   Database map code is:

   SECTOR-A-01

   Normalize both forms to the DB form.
========================================================= */

function normalizeMapCode(
  value: unknown
) {
  return cleanText(
    value
  )
    .toUpperCase()
    .replace(
      /_/g,
      "-"
    )
    .replace(
      /\s+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    );
}

/* =========================================================
   SAFE POSITIVE NUMBER
========================================================= */

function positiveNumber(
  value: unknown,
  fallback: number
) {
  const numeric =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numeric
    ) ||
    numeric <=
      0
  ) {
    return fallback;
  }

  return numeric;
}

/* =========================================================
   SERVER EXP CANDIDATE RESOLUTION

   IMPORTANT SECURITY RULE:

   Browser does NOT send EXP amount.

   Server resolves:
   1. Game
   2. Monster Tier
   3. Monster DB Rule
   4. Map DB Rule
   5. Map EXP Multiplier
   6. Calculated EXP

   BUT:

   We DO NOT call award_player_exp() yet.

   Why?

   The current game client can still report
   MONSTER_DEFEATED itself.

   Before persistent EXP is allowed,
   the server must know that this exact Monster
   really existed in this exact Game Session
   and has not already been defeated.

   That will be the next Server Authority step.
========================================================= */

async function resolveMonsterExpCandidate(
  gameSession: GameSessionRow,
  eventType: GameEventType,
  eventName: string | null,
  payload: Record<
    string,
    unknown
  >
): Promise<
  MonsterExpCandidate | null
> {
  /* -------------------------------------------------------
     Only MONSTER_DEFEATED is relevant
  ------------------------------------------------------- */

  if (
    eventType !==
      "CUSTOM" ||
    eventName !==
      "MONSTER_DEFEATED"
  ) {
    return null;
  }

  /* -------------------------------------------------------
     GRID EXPEDITION ONLY
  ------------------------------------------------------- */

  if (
    cleanText(
      gameSession.game_code_snapshot
    ).toUpperCase() !==
    "LF-GRID-EXPEDITION"
  ) {
    return {
      eligible:
        false,

      persistent_award:
        false,

      reason:
        "UNSUPPORTED_GAME",

      monster:
        null,

      map:
        null,

      calculated_exp:
        null,
    };
  }

  /* -------------------------------------------------------
     MONSTER TIER

     Current prototype sends:
     payload.tier

     Future engines may send:
     payload.monster_tier
  ------------------------------------------------------- */

  const monsterTier =
    normalizeMonsterTier(
      payload.tier ??
        payload.monster_tier
    );

  if (
    !monsterTier
  ) {
    return {
      eligible:
        false,

      persistent_award:
        false,

      reason:
        "MONSTER_TIER_REQUIRED",

      monster:
        null,

      map:
        null,

      calculated_exp:
        null,
    };
  }

  /* -------------------------------------------------------
     LOAD MONSTER RULE

     EXP comes from Database.
     Never from numeric_value.
     Never from payload.exp.
  ------------------------------------------------------- */

  const {
    data:
      monsterRuleData,

    error:
      monsterRuleError,
  } =
    await supabaseAdmin
      .from(
        "game_monster_rules"
      )
      .select(`
        id,
        code,
        name,
        tier,
        base_hp,
        base_atk,
        base_def,
        base_exp,
        base_score,
        is_boss,
        is_active,
        sort_order
      `)
      .eq(
        "game_id",
        gameSession.game_id
      )
      .eq(
        "tier",
        monsterTier
      )
      .eq(
        "is_boss",
        false
      )
      .eq(
        "is_active",
        true
      )
      .order(
        "sort_order",
        {
          ascending:
            true,
        }
      )
      .limit(
        1
      )
      .maybeSingle();

  if (
    monsterRuleError
  ) {
    console.error(
      "GAME EVENT - MONSTER RULE QUERY ERROR:",
      monsterRuleError
    );

    return {
      eligible:
        false,

      persistent_award:
        false,

      reason:
        "MONSTER_RULE_QUERY_FAILED",

      monster:
        null,

      map:
        null,

      calculated_exp:
        null,
    };
  }

  const monsterRule =
    monsterRuleData as
      | MonsterRuleRow
      | null;

  if (
    !monsterRule
  ) {
    return {
      eligible:
        false,

      persistent_award:
        false,

      reason:
        "MONSTER_RULE_NOT_FOUND",

      monster:
        null,

      map:
        null,

      calculated_exp:
        null,
    };
  }

  /* -------------------------------------------------------
     MAP

     Prototype sends:
     SECTOR_A_01

     DB:
     SECTOR-A-01
  ------------------------------------------------------- */

  const mapCode =
    normalizeMapCode(
      payload.map ??
        payload.map_code
    );

  if (
    !mapCode
  ) {
    return {
      eligible:
        false,

      persistent_award:
        false,

      reason:
        "MAP_CODE_REQUIRED",

      monster: {
        id:
          monsterRule.id,

        code:
          monsterRule.code,

        name:
          monsterRule.name,

        tier:
          monsterTier,

        base_exp:
          Number(
            monsterRule.base_exp
          ),
      },

      map:
        null,

      calculated_exp:
        null,
    };
  }

  /* -------------------------------------------------------
     LOAD MAP RULE
  ------------------------------------------------------- */

  const {
    data:
      mapData,

    error:
      mapError,
  } =
    await supabaseAdmin
      .from(
        "game_maps"
      )
      .select(`
        id,
        code,
        name,
        map_number,
        map_level,
        monster_exp_multiplier,
        status,
        is_active
      `)
      .eq(
        "game_id",
        gameSession.game_id
      )
      .eq(
        "code",
        mapCode
      )
      .maybeSingle();

  if (
    mapError
  ) {
    console.error(
      "GAME EVENT - MAP RULE QUERY ERROR:",
      mapError
    );

    return {
      eligible:
        false,

      persistent_award:
        false,

      reason:
        "MAP_RULE_QUERY_FAILED",

      monster: {
        id:
          monsterRule.id,

        code:
          monsterRule.code,

        name:
          monsterRule.name,

        tier:
          monsterTier,

        base_exp:
          Number(
            monsterRule.base_exp
          ),
      },

      map:
        null,

      calculated_exp:
        null,
    };
  }

  const gameMap =
    mapData as
      | GameMapRow
      | null;

  if (
    !gameMap
  ) {
    return {
      eligible:
        false,

      persistent_award:
        false,

      reason:
        "MAP_RULE_NOT_FOUND",

      monster: {
        id:
          monsterRule.id,

        code:
          monsterRule.code,

        name:
          monsterRule.name,

        tier:
          monsterTier,

        base_exp:
          Number(
            monsterRule.base_exp
          ),
      },

      map:
        null,

      calculated_exp:
        null,
    };
  }

  /* -------------------------------------------------------
     CALCULATE EXP

     FINAL EXP
     =
     Monster Base EXP
     ×
     Map Monster EXP Multiplier
  ------------------------------------------------------- */

  const baseExp =
    Math.max(
      0,
      Math.round(
        Number(
          monsterRule.base_exp
        )
      )
    );

  const expMultiplier =
    positiveNumber(
      gameMap.monster_exp_multiplier,
      1
    );

  const calculatedExp =
    Math.max(
      0,
      Math.round(
        baseExp *
          expMultiplier
      )
    );

  return {
    eligible:
      calculatedExp >
      0,

    persistent_award:
      false,

    reason:
      calculatedExp >
      0
        ? "SERVER_EXP_RULE_RESOLVED"
        : "EXP_RULE_ZERO",

    monster: {
      id:
        monsterRule.id,

      code:
        monsterRule.code,

      name:
        monsterRule.name,

      tier:
        monsterTier,

      base_exp:
        baseExp,
    },

    map: {
      id:
        gameMap.id,

      code:
        gameMap.code,

      name:
        gameMap.name,

      map_number:
        gameMap.map_number,

      map_level:
        gameMap.map_level,

      exp_multiplier:
        expMultiplier,

      status:
        gameMap.status,

      is_active:
        gameMap.is_active,
    },

    calculated_exp:
      calculatedExp,
  };
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    /* =====================================================
       1. AUTH HEADER
    ===================================================== */

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
          ok:
            false,

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

    if (
      !accessToken
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "UNAUTHORIZED",

          error:
            "Missing access token.",
        },
        401
      );
    }

    /* =====================================================
       2. VERIFY PLAYER
    ===================================================== */

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
          ok:
            false,

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

    /* =====================================================
       3. BODY
    ===================================================== */

    let body:
      GameEventRequestBody;

    try {
      body =
        (
          await request.json()
        ) as GameEventRequestBody;
    } catch {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "INVALID_JSON",

          error:
            "Invalid request body.",
        },
        400
      );
    }

    /* =====================================================
       4. SESSION ID
    ===================================================== */

    const sessionId =
      (
        body.session_id ??
        body.sessionId ??
        ""
      ).trim();

    if (
      !sessionId
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "SESSION_ID_REQUIRED",

          error:
            "session_id is required.",
        },
        400
      );
    }

    /* =====================================================
       5. EVENT TYPE
    ===================================================== */

    const eventType =
      (
        body.event_type ??
        body.eventType ??
        ""
      )
        .trim()
        .toUpperCase();

    if (
      !eventType
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "EVENT_TYPE_REQUIRED",

          error:
            "event_type is required.",
        },
        400
      );
    }

    if (
      !isAllowedEventType(
        eventType
      )
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "INVALID_EVENT_TYPE",

          error:
            `Unsupported event_type: ${eventType}`,
        },
        400
      );
    }

    /* =====================================================
       6. EVENT NAME
    ===================================================== */

    const rawEventName =
      body.event_name ??
      body.eventName ??
      null;

    let eventName:
      string | null =
        null;

    if (
      rawEventName !==
      null
    ) {
      if (
        typeof rawEventName !==
        "string"
      ) {
        return jsonResponse(
          {
            ok:
              false,

            code:
              "INVALID_EVENT_NAME",

            error:
              "event_name must be a string or null.",
          },
          400
        );
      }

      const normalized =
        rawEventName
          .trim()
          .toUpperCase();

      if (
        normalized.length >
        100
      ) {
        return jsonResponse(
          {
            ok:
              false,

            code:
              "EVENT_NAME_TOO_LONG",

            error:
              "event_name is too long.",
          },
          400
        );
      }

      eventName =
        normalized ||
        null;
    }

    /* =====================================================
       7. NUMERIC VALUE
    ===================================================== */

    const rawNumericValue =
      body.numeric_value ??
      body.numericValue ??
      null;

    let numericValue:
      number | null =
        null;

    if (
      rawNumericValue !==
      null
    ) {
      if (
        typeof rawNumericValue !==
          "number" ||
        !Number.isFinite(
          rawNumericValue
        )
      ) {
        return jsonResponse(
          {
            ok:
              false,

            code:
              "INVALID_NUMERIC_VALUE",

            error:
              "numeric_value must be a finite number or null.",
          },
          400
        );
      }

      numericValue =
        rawNumericValue;
    }

    /* =====================================================
       8. PAYLOAD
       Only JSON object is accepted.
    ===================================================== */

    const rawPayload =
      body.payload ??
      {};

    if (
      !isPlainObject(
        rawPayload
      )
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "INVALID_PAYLOAD",

          error:
            "payload must be a JSON object.",
        },
        400
      );
    }

    let serializedPayload:
      string;

    try {
      serializedPayload =
        JSON.stringify(
          rawPayload
        );
    } catch {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "INVALID_PAYLOAD",

          error:
            "payload could not be serialized.",
        },
        400
      );
    }

    if (
      serializedPayload.length >
      20000
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "PAYLOAD_TOO_LARGE",

          error:
            "payload is too large.",
        },
        413
      );
    }

    /* =====================================================
       9. LOAD GAME SESSION

       Browser cannot choose:
       - user_id
       - game_id

       Both are resolved from real Game Session.
    ===================================================== */

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
        .select(`
          id,
          game_id,
          user_id,
          status,
          game_code_snapshot,
          game_version_snapshot,
          engine_snapshot,
          started_at,
          last_event_at,
          completed_at,
          final_score
        `)
        .eq(
          "id",
          sessionId
        )
        .maybeSingle();

    if (
      sessionError
    ) {
      console.error(
        "GAME EVENT - SESSION QUERY ERROR:",
        sessionError
      );

      return jsonResponse(
        {
          ok:
            false,

          code:
            "SESSION_QUERY_FAILED",

          error:
            "Unable to load Game Session.",
        },
        500
      );
    }

    const gameSession =
      sessionData as
        | GameSessionRow
        | null;

    if (
      !gameSession
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "SESSION_NOT_FOUND",

          error:
            "Game Session not found.",
        },
        404
      );
    }

    /* =====================================================
       10. VERIFY SESSION OWNERSHIP
    ===================================================== */

    if (
      gameSession.user_id !==
      userId
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "SESSION_FORBIDDEN",

          error:
            "This Game Session does not belong to the authenticated player.",
        },
        403
      );
    }

    /* =====================================================
       11. SESSION MUST BE ACTIVE
    ===================================================== */

    if (
      gameSession.status !==
      "ACTIVE"
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "SESSION_NOT_ACTIVE",

          error:
            `Game Session status is ${gameSession.status}.`,
        },
        409
      );
    }

    /* =====================================================
       12. EVENT-SPECIFIC BASIC RULES
    ===================================================== */

    if (
      eventType ===
        "SCORE" &&
      numericValue ===
        null
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "SCORE_VALUE_REQUIRED",

          error:
            "SCORE event requires numeric_value.",
        },
        400
      );
    }

    if (
      eventType ===
        "CUSTOM" &&
      !eventName
    ) {
      return jsonResponse(
        {
          ok:
            false,

          code:
            "CUSTOM_EVENT_NAME_REQUIRED",

          error:
            "CUSTOM event requires event_name.",
        },
        400
      );
    }

    /* =====================================================
       13. INSERT GAME EVENT
    ===================================================== */

    const now =
      new Date()
        .toISOString();

    const {
      data:
        eventData,

      error:
        eventError,
    } =
      await supabaseAdmin
        .from(
          "game_events"
        )
        .insert({
          session_id:
            gameSession.id,

          game_id:
            gameSession.game_id,

          user_id:
            userId,

          event_type:
            eventType,

          event_name:
            eventName,

          numeric_value:
            numericValue,

          payload:
            rawPayload,
        })
        .select(`
          id,
          session_id,
          game_id,
          user_id,
          event_type,
          event_name,
          numeric_value,
          payload,
          created_at
        `)
        .single();

    if (
      eventError ||
      !eventData
    ) {
      console.error(
        "GAME EVENT - INSERT ERROR:",
        eventError
      );

      return jsonResponse(
        {
          ok:
            false,

          code:
            "EVENT_CREATE_FAILED",

          error:
            "Unable to create Game Event.",
        },
        500
      );
    }

    /* =====================================================
       14. UPDATE SESSION HEARTBEAT
    ===================================================== */

    const {
      error:
        heartbeatError,
    } =
      await supabaseAdmin
        .from(
          "game_sessions"
        )
        .update({
          last_event_at:
            now,
        })
        .eq(
          "id",
          gameSession.id
        )
        .eq(
          "user_id",
          userId
        );

    if (
      heartbeatError
    ) {
      console.error(
        "GAME EVENT - HEARTBEAT UPDATE ERROR:",
        heartbeatError
      );
    }

    /* =====================================================
       15. SERVER EXP RULE RESOLUTION

       This is the important STEP 15C-4F change.

       MONSTER_DEFEATED
       ↓
       Server reads Monster Rule
       ↓
       Server reads Map Rule
       ↓
       Server calculates EXP candidate

       NO persistent EXP is awarded yet.
    ===================================================== */

    let expCandidate:
      MonsterExpCandidate | null =
        null;

    try {
      expCandidate =
        await resolveMonsterExpCandidate(
          gameSession,
          eventType,
          eventName,
          rawPayload
        );
    } catch (
      expCandidateError
    ) {
      console.error(
        "GAME EVENT - EXP CANDIDATE ERROR:",
        expCandidateError
      );

      expCandidate = {
        eligible:
          false,

        persistent_award:
          false,

        reason:
          "EXP_CANDIDATE_INTERNAL_ERROR",

        monster:
          null,

        map:
          null,

        calculated_exp:
          null,
      };
    }

    /* =====================================================
       16. SECURITY RULE

       This endpoint still records gameplay telemetry.

       It does NOT:
       - Add persistent EXP yet
       - Add Game Coin
       - Add LT
       - Add Items
       - Change LT Wallet
       - Change Collection Score
       - Change Global Rank

       Browser gameplay is NOT reward authority.

       Persistent EXP requires the next layer:

       GAME SESSION
       ↓
       SERVER ENTITY / MONSTER INSTANCE
       ↓
       VALIDATED MONSTER DEFEAT
       ↓
       award_player_exp()
    ===================================================== */

    return jsonResponse(
      {
        ok:
          true,

        event: {
          id:
            eventData.id,

          session_id:
            eventData.session_id,

          event_type:
            eventData.event_type,

          event_name:
            eventData.event_name,

          numeric_value:
            eventData.numeric_value,

          payload:
            eventData.payload,

          created_at:
            eventData.created_at,
        },

        session: {
          id:
            gameSession.id,

          status:
            gameSession.status,

          last_event_at:
            now,
        },

        game: {
          id:
            gameSession.game_id,

          code:
            gameSession.game_code_snapshot,

          version:
            gameSession.game_version_snapshot,

          engine:
            gameSession.engine_snapshot,
        },

        reward_authority: {
          mode:
            "TELEMETRY_ONLY",

          exp_awarded:
            false,

          exp_candidate:
            expCandidate,

          next_requirement:
            expCandidate?.eligible
              ? "SERVER_MONSTER_INSTANCE_VALIDATION"
              : null,
        },
      },
      201
    );
  } catch (
    error
  ) {
    console.error(
      "GAME EVENT API ERROR:",
      error
    );

    return jsonResponse(
      {
        ok:
          false,

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