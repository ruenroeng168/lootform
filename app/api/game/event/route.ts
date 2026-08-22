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
// EVENT TYPES
// Must match public.game_events_event_type_check
// =========================================================

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

// =========================================================
// REQUEST
// =========================================================

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

// =========================================================
// SESSION
// =========================================================

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

// =========================================================
// HELPERS
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

function isAllowedEventType(
  value: string
): value is GameEventType {
  return (
    ALLOWED_EVENT_TYPES as readonly string[]
  ).includes(
    value
  );
}

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

// =========================================================
// POST
// =========================================================

export async function POST(
  request: NextRequest
) {
  try {
    // =====================================================
    // 1. AUTH HEADER
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
    // 3. BODY
    // =====================================================

    let body:
      GameEventRequestBody;

    try {
      body =
        (await request.json()) as GameEventRequestBody;
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

    // =====================================================
    // 4. SESSION ID
    // =====================================================

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

          code:
            "SESSION_ID_REQUIRED",

          error:
            "session_id is required.",
        },
        400
      );
    }

    // =====================================================
    // 5. EVENT TYPE
    // =====================================================

    const eventType =
      (
        body.event_type ??
        body.eventType ??
        ""
      )
        .trim()
        .toUpperCase();

    if (!eventType) {
      return jsonResponse(
        {
          ok: false,

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
          ok: false,

          code:
            "INVALID_EVENT_TYPE",

          error:
            `Unsupported event_type: ${eventType}`,
        },
        400
      );
    }

    // =====================================================
    // 6. EVENT NAME
    // =====================================================

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
            ok: false,

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
            ok: false,

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

    // =====================================================
    // 7. NUMERIC VALUE
    // =====================================================

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
            ok: false,

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

    // =====================================================
    // 8. PAYLOAD
    // Only JSON object is accepted.
    // =====================================================

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
          ok: false,

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
          ok: false,

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
          ok: false,

          code:
            "PAYLOAD_TOO_LARGE",

          error:
            "payload is too large.",
        },
        413
      );
    }

    // =====================================================
    // 9. LOAD GAME SESSION
    // Browser cannot choose user_id or game_id.
    // Both are resolved from the real session.
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
          ok: false,

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

    if (!gameSession) {
      return jsonResponse(
        {
          ok: false,

          code:
            "SESSION_NOT_FOUND",

          error:
            "Game Session not found.",
        },
        404
      );
    }

    // =====================================================
    // 10. VERIFY SESSION OWNERSHIP
    // =====================================================

    if (
      gameSession.user_id !==
      userId
    ) {
      return jsonResponse(
        {
          ok: false,

          code:
            "SESSION_FORBIDDEN",

          error:
            "This Game Session does not belong to the authenticated player.",
        },
        403
      );
    }

    // =====================================================
    // 11. SESSION MUST BE ACTIVE
    // =====================================================

    if (
      gameSession.status !==
      "ACTIVE"
    ) {
      return jsonResponse(
        {
          ok: false,

          code:
            "SESSION_NOT_ACTIVE",

          error:
            `Game Session status is ${gameSession.status}.`,
        },
        409
      );
    }

    // =====================================================
    // 12. EVENT-SPECIFIC BASIC RULES
    // =====================================================

    if (
      eventType ===
        "SCORE" &&
      numericValue ===
        null
    ) {
      return jsonResponse(
        {
          ok: false,

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
          ok: false,

          code:
            "CUSTOM_EVENT_NAME_REQUIRED",

          error:
            "CUSTOM event requires event_name.",
        },
        400
      );
    }

    // =====================================================
    // 13. INSERT GAME EVENT
    // =====================================================

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
          ok: false,

          code:
            "EVENT_CREATE_FAILED",

          error:
            "Unable to create Game Event.",
        },
        500
      );
    }

    // =====================================================
    // 14. UPDATE SESSION HEARTBEAT
    //
    // Event insert is the important record.
    // last_event_at keeps session activity visible.
    // =====================================================

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

    // =====================================================
    // 15. IMPORTANT SECURITY RULE
    //
    // This API records gameplay telemetry only.
    //
    // It does NOT:
    // - Add EXP
    // - Add LT
    // - Add Items
    // - Change Wallet
    // - Change Collection Score
    // - Change Global Rank
    //
    // Browser gameplay is never reward authority.
    // =====================================================

    return jsonResponse(
      {
        ok: true,

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