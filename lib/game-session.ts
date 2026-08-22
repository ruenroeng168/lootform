import {
  supabase,
} from "@/lib/supabase";

// =========================================================
// TYPES
// =========================================================

export type GameSessionStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "FAILED"
  | "ABANDONED";

export type GameEngine =
  | "INTERNAL"
  | "CONSTRUCT3"
  | "GDEVELOP"
  | "HTML5";

export type StartGameSessionResponse = {
  ok: boolean;

  session?: {
    id: string;

    status:
      GameSessionStatus;

    started_at:
      string;
  };

  game?: {
    id: number;

    code: string;

    name: string;

    engine:
      GameEngine;

    version:
      string;

    launch_url:
      string | null;
  };

  bridge?: {
    version:
      string;

    allowed_origin:
      string | null;

    supports: {
      score:
        boolean;

      progress:
        boolean;

      events:
        boolean;
    };
  };

  code?: string;

  error?: string;
};

// =========================================================
// ERROR
// =========================================================

export class GameSessionError extends Error {
  code:
    string;

  httpStatus:
    number;

  constructor(
    message:
      string,

    code =
      "GAME_SESSION_ERROR",

    httpStatus =
      500
  ) {
    super(
      message
    );

    this.name =
      "GameSessionError";

    this.code =
      code;

    this.httpStatus =
      httpStatus;
  }
}

// =========================================================
// START GAME SESSION
// =========================================================

export async function startGameSession(
  gameCode:
    string
) {
  // =====================================================
  // 1. VALIDATE GAME CODE
  // =====================================================

  const normalizedGameCode =
    gameCode
      .trim()
      .toUpperCase();

  if (
    !normalizedGameCode
  ) {
    throw new GameSessionError(
      "Game code is required.",
      "GAME_CODE_REQUIRED",
      400
    );
  }

  // =====================================================
  // 2. GET AUTH SESSION
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
    throw new GameSessionError(
      authError.message,
      "AUTH_SESSION_ERROR",
      401
    );
  }

  if (
    !authSession
  ) {
    throw new GameSessionError(
      "Player is not authenticated.",
      "UNAUTHORIZED",
      401
    );
  }

  // =====================================================
  // 3. START SERVER GAME SESSION
  // =====================================================

  const response =
    await fetch(
      "/api/game/session/start",
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
            game_code:
              normalizedGameCode,
          }),

        cache:
          "no-store",
      }
    );

  // =====================================================
  // 4. READ RESPONSE
  // =====================================================

  let result:
    StartGameSessionResponse;

  try {
    result =
      (await response.json()) as StartGameSessionResponse;
  } catch {
    throw new GameSessionError(
      "Invalid response from Game Session server.",
      "INVALID_SERVER_RESPONSE",
      response.status
    );
  }

  // =====================================================
  // 5. SERVER ERROR
  // =====================================================

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new GameSessionError(
      result.error ||
        "Unable to start Game Session.",

      result.code ||
        "SESSION_START_FAILED",

      response.status
    );
  }

  // =====================================================
  // 6. VERIFY REQUIRED SESSION DATA
  // =====================================================

  if (
    !result.session?.id
  ) {
    throw new GameSessionError(
      "Game Session ID was not returned.",
      "SESSION_ID_MISSING",
      500
    );
  }

  if (
    !result.game
  ) {
    throw new GameSessionError(
      "Game information was not returned.",
      "GAME_DATA_MISSING",
      500
    );
  }

  // =====================================================
  // 7. RETURN VERIFIED RESULT
  // =====================================================

  return {
    session:
      result.session,

    game:
      result.game,

    bridge:
      result.bridge ??
      null,
  };
}