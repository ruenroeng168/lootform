import {
  supabase,
} from "@/lib/supabase";

// =========================================================
// EVENT TYPES
// Must match public.game_events_event_type_check
// =========================================================

export type GameEventType =
  | "GAME_READY"
  | "GAME_START"
  | "SCORE"
  | "PROGRESS"
  | "CHECKPOINT"
  | "COMPLETE"
  | "FAIL"
  | "CUSTOM";

// =========================================================
// EVENT INPUT
// =========================================================

export type SendGameEventInput = {
  sessionId: string;

  eventType: GameEventType;

  eventName?:
    string | null;

  numericValue?:
    number | null;

  payload?:
    Record<
      string,
      unknown
    >;
};

// =========================================================
// API RESPONSE
// =========================================================

export type GameEventResponse = {
  ok: boolean;

  event?: {
    id: number;

    session_id: string;

    event_type:
      GameEventType;

    event_name:
      string | null;

    numeric_value:
      number | null;

    payload:
      Record<
        string,
        unknown
      >;

    created_at:
      string;
  };

  session?: {
    id: string;

    status: string;

    last_event_at:
      string;
  };

  game?: {
    id: number;

    code:
      string | null;

    version:
      string | null;

    engine:
      string | null;
  };

  code?: string;

  error?: string;
};

// =========================================================
// ERROR
// =========================================================

export class GameEventError extends Error {
  code: string;

  httpStatus: number;

  constructor(
    message: string,

    code =
      "GAME_EVENT_ERROR",

    httpStatus =
      500
  ) {
    super(
      message
    );

    this.name =
      "GameEventError";

    this.code =
      code;

    this.httpStatus =
      httpStatus;
  }
}

// =========================================================
// SEND GAME EVENT
// =========================================================

export async function sendGameEvent(
  input:
    SendGameEventInput
) {
  // =====================================================
  // 1. SESSION ID
  // =====================================================

  const sessionId =
    input.sessionId
      .trim();

  if (
    !sessionId
  ) {
    throw new GameEventError(
      "Game Session ID is required.",
      "SESSION_ID_REQUIRED",
      400
    );
  }

  // =====================================================
  // 2. EVENT NAME
  // =====================================================

  const eventName =
    input.eventName
      ?.trim()
      .toUpperCase() ||
    null;

  // =====================================================
  // 3. AUTH SESSION
  // =====================================================

  const {
    data: {
      session:
        authSession,
    },

    error:
      authError,
  } =
    await supabase
      .auth
      .getSession();

  if (
    authError
  ) {
    throw new GameEventError(
      authError.message,
      "AUTH_SESSION_ERROR",
      401
    );
  }

  if (
    !authSession
  ) {
    throw new GameEventError(
      "Player is not authenticated.",
      "UNAUTHORIZED",
      401
    );
  }

  // =====================================================
  // 4. REQUEST
  // =====================================================

  const response =
    await fetch(
      "/api/game/event",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${authSession.access_token}`,
        },

        body:
          JSON.stringify({
            session_id:
              sessionId,

            event_type:
              input.eventType,

            event_name:
              eventName,

            numeric_value:
              input.numericValue ??
              null,

            payload:
              input.payload ??
              {},
          }),

        cache:
          "no-store",
      }
    );

  // =====================================================
  // 5. RESPONSE
  // =====================================================

  let result:
    GameEventResponse;

  try {
    result =
      (await response.json()) as GameEventResponse;
  } catch {
    throw new GameEventError(
      "Invalid response from Game Event server.",
      "INVALID_SERVER_RESPONSE",
      response.status
    );
  }

  // =====================================================
  // 6. SERVER ERROR
  // =====================================================

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new GameEventError(
      result.error ||
        "Unable to send Game Event.",

      result.code ||
        "GAME_EVENT_FAILED",

      response.status
    );
  }

  // =====================================================
  // 7. REQUIRED RESULT
  // =====================================================

  if (
    !result.event
  ) {
    throw new GameEventError(
      "Game Event data was not returned.",
      "EVENT_DATA_MISSING",
      500
    );
  }

  return {
    event:
      result.event,

    session:
      result.session ??
      null,

    game:
      result.game ??
      null,
  };
}

// =========================================================
// CONVENIENCE HELPERS
// =========================================================

export async function sendGameStartEvent(
  sessionId:
    string,

  payload:
    Record<
      string,
      unknown
    > = {}
) {
  return sendGameEvent({
    sessionId,

    eventType:
      "GAME_START",

    eventName:
      "GRID_EXPEDITION_START",

    payload,
  });
}

export async function sendTreasureFoundEvent(
  sessionId:
    string,

  scoreGain:
    number,

  payload:
    Record<
      string,
      unknown
    > = {}
) {
  return sendGameEvent({
    sessionId,

    eventType:
      "CUSTOM",

    eventName:
      "TREASURE_FOUND",

    numericValue:
      scoreGain,

    payload,
  });
}

export async function sendMonsterDefeatedEvent(
  sessionId:
    string,

  scoreGain:
    number,

  payload:
    Record<
      string,
      unknown
    > = {}
) {
  return sendGameEvent({
    sessionId,

    eventType:
      "CUSTOM",

    eventName:
      "MONSTER_DEFEATED",

    numericValue:
      scoreGain,

    payload,
  });
}

export async function sendScoreEvent(
  sessionId:
    string,

  score:
    number,

  payload:
    Record<
      string,
      unknown
    > = {}
) {
  return sendGameEvent({
    sessionId,

    eventType:
      "SCORE",

    eventName:
      "RUN_SCORE",

    numericValue:
      score,

    payload,
  });
}

export async function sendCompleteEvent(
  sessionId:
    string,

  finalScore:
    number,

  payload:
    Record<
      string,
      unknown
    > = {}
) {
  return sendGameEvent({
    sessionId,

    eventType:
      "COMPLETE",

    eventName:
      "GRID_EXPEDITION_COMPLETE",

    numericValue:
      finalScore,

    payload,
  });
}

export async function sendFailEvent(
  sessionId:
    string,

  finalScore:
    number,

  reason:
    string,

  payload:
    Record<
      string,
      unknown
    > = {}
) {
  return sendGameEvent({
    sessionId,

    eventType:
      "FAIL",

    eventName:
      reason
        .trim()
        .toUpperCase() ||
      "GRID_EXPEDITION_FAILED",

    numericValue:
      finalScore,

    payload,
  });
}