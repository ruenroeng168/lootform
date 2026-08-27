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

export type SessionStatsSnapshot = {
  effective: {
    hp: number;
    attack: number;
    defense: number;
    luck: number;
    heal: number;
    vision: number;
  };

  equipment: {
    slot: string;

    ability_code:
      string | null;

    ability_config:
      Record<string, unknown> | null;
  }[];
};

// =========================================================
// AUTHORITATIVE EXPEDITION STATE (STEP 2.6)
//
// Server-tracked position/turn/exit-reached. Written only by
// resolve_game_move() -- never set from a client-supplied x/y.
// =========================================================

export type GameSessionStateRow = {
  current_x: number;
  current_y: number;

  start_x: number;
  start_y: number;

  exit_x: number;
  exit_y: number;

  turn_count: number;

  exit_reached: boolean;

  // AUTHORITATIVE as of STEP 2.8. null only for rows created before
  // this migration ran.
  player_current_hp:
    number | null;
};

// =========================================================
// AUTHORITATIVE ENCOUNTERS (STEP 2.7)
//
// Server-owned Monster/Elite. Written only by
// generate_game_encounters() / resolve_game_move() /
// resolve_encounter_defeat() -- the client never invents one or
// sets its status directly.
// =========================================================

export type EncounterStatus =
  | "AVAILABLE"
  | "ACTIVE"
  | "DEFEATED"
  | "SKIPPED";

export type MonsterTier =
  | "SCOUT"
  | "GUARD"
  | "ELITE";

export type GameEncounterRow = {
  id: number;

  tier: MonsterTier;

  monster_code: string;

  x: number;
  y: number;

  max_hp: number;
  current_hp: number;

  status: EncounterStatus;

  created_at?: string;
  started_at?: string | null;
  resolved_at?: string | null;
};

export type StartGameSessionResponse = {
  ok: boolean;

  session?: {
    id: string;

    status:
      GameSessionStatus;

    started_at:
      string;

    stats_snapshot:
      SessionStatsSnapshot | null;

    state:
      GameSessionStateRow | null;

    encounters?:
      GameEncounterRow[];
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

// =========================================================
// AUTHORITATIVE MOVE (STEP 2.6)
//
// Client sends only session_id + direction. The server computes
// and returns the new position -- this function does not accept
// or invent an x/y; whatever the response says is where the
// player actually is.
// =========================================================

export type ResolveMoveResponse = {
  ok: boolean;

  state?:
    GameSessionStateRow;

  blocked?: boolean;

  block_reason?:
    string | null;

  encounter?:
    GameEncounterRow | null;

  code?: string;
  error?: string;
};

export async function moveGameSession(
  sessionId: string,

  direction:
    "UP" | "DOWN" | "LEFT" | "RIGHT"
) {
  const trimmedSessionId =
    sessionId.trim();

  if (!trimmedSessionId) {
    throw new GameSessionError(
      "Game Session ID is required.",
      "SESSION_ID_REQUIRED",
      400
    );
  }

  const {
    data: {
      session: authSession,
    },

    error: authError,
  } =
    await supabase
      .auth
      .getSession();

  if (authError) {
    throw new GameSessionError(
      authError.message,
      "AUTH_SESSION_ERROR",
      401
    );
  }

  if (!authSession) {
    throw new GameSessionError(
      "Player is not authenticated.",
      "UNAUTHORIZED",
      401
    );
  }

  const response =
    await fetch(
      "/api/game/action/move",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${authSession.access_token}`,
        },

        body:
          JSON.stringify({
            session_id:
              trimmedSessionId,

            direction,
          }),

        cache: "no-store",
      }
    );

  let result: ResolveMoveResponse;

  try {
    result =
      (await response.json()) as ResolveMoveResponse;
  } catch {
    throw new GameSessionError(
      "Invalid response from Move server.",
      "INVALID_SERVER_RESPONSE",
      response.status
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new GameSessionError(
      result.error ||
        "Unable to resolve movement.",

      result.code ||
        "MOVE_FAILED",

      response.status
    );
  }

  if (!result.state) {
    throw new GameSessionError(
      "Expedition state was not returned.",
      "STATE_DATA_MISSING",
      500
    );
  }

  return {
    state:
      result.state,

    blocked:
      result.blocked ??
      false,

    blockReason:
      result.block_reason ??
      null,

    encounter:
      result.encounter ??
      null,
  };
}

// =========================================================
// AUTHORITATIVE COMBAT (STEP 2.8)
//
// Client sends only session_id + encounter_id -- "I am fighting
// this encounter." The server (resolve_combat) reads Player ATK/DEF
// from the Session's frozen stats_snapshot, Player HP from
// game_session_state, Monster stats from game_monster_rules,
// computes the entire fight, and returns the same round-by-round
// shape the existing CombatScene animation already expects. Damage,
// HP and the win/loss outcome are never trusted from the client.
// =========================================================

export type CombatRound = {
  round: number;
  heroDamage: number;
  monsterDamage: number;
  heroHpAfter: number;
  monsterHpAfter: number;
};

export type ResolveCombatResponse = {
  ok: boolean;

  won?: boolean;

  round_count?: number;

  player_hp?: number;
  monster_hp?: number;

  monster?: {
    name: string;
    tier: MonsterTier;
    hp: number;
    atk: number;
    def: number;
    score: number;
  };

  rounds?:
    CombatRound[];

  coin_earned?: number;
  coin_balance?: number;

  drops?:
    RunLootEntry[];

  code?: string;
  error?: string;
};

// GAME MATERIAL DROP (STEP 4B). AUTHORITATIVE -- rolled and inserted
// server-side inside resolve_combat() via roll_and_grant_item_drop().
// UNEXTRACTED: belongs to this session+user, not permanent inventory
// yet (STEP 4C decides EXTRACTED vs LOST).
export type RunLootEntry = {
  item_code: string;
  item_name: string;
  rarity: string;
  quantity: number;
};

export async function resolveCombat(
  sessionId: string,

  encounterId: number
) {
  const trimmedSessionId =
    sessionId.trim();

  if (!trimmedSessionId) {
    throw new GameSessionError(
      "Game Session ID is required.",
      "SESSION_ID_REQUIRED",
      400
    );
  }

  const {
    data: {
      session: authSession,
    },

    error: authError,
  } =
    await supabase
      .auth
      .getSession();

  if (authError) {
    throw new GameSessionError(
      authError.message,
      "AUTH_SESSION_ERROR",
      401
    );
  }

  if (!authSession) {
    throw new GameSessionError(
      "Player is not authenticated.",
      "UNAUTHORIZED",
      401
    );
  }

  const response =
    await fetch(
      "/api/game/action/attack",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${authSession.access_token}`,
        },

        body:
          JSON.stringify({
            session_id:
              trimmedSessionId,

            encounter_id:
              encounterId,
          }),

        cache: "no-store",
      }
    );

  let result: ResolveCombatResponse;

  try {
    result =
      (await response.json()) as ResolveCombatResponse;
  } catch {
    throw new GameSessionError(
      "Invalid response from Combat server.",
      "INVALID_SERVER_RESPONSE",
      response.status
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new GameSessionError(
      result.error ||
        "Unable to resolve combat.",

      result.code ||
        "COMBAT_RESOLVE_FAILED",

      response.status
    );
  }

  if (
    result.won === undefined ||
    !result.monster ||
    !result.rounds
  ) {
    throw new GameSessionError(
      "Combat result data was not returned.",
      "COMBAT_DATA_MISSING",
      500
    );
  }

  return {
    won:
      result.won,

    roundCount:
      result.round_count ??
      result.rounds.length,

    playerHp:
      result.player_hp ??
      0,

    monsterHp:
      result.monster_hp ??
      0,

    monster:
      result.monster,

    rounds:
      result.rounds,

    coinEarned:
      result.coin_earned ??
      0,

    coinBalance:
      result.coin_balance ??
      0,

    drops:
      result.drops ??
      [],
  };
}

// =========================================================
// ACTIVE SESSION LOOKUP (STEP 2.6 refresh recovery)
//
// Read-only: "do I already have an ACTIVE session for this game."
// Never creates or abandons anything. Used on page mount so a
// refresh restores the server's real position instead of calling
// Session Start again (which would abandon the in-progress session
// and reset to Player Start).
// =========================================================

export type ActiveGameSessionResponse = {
  ok: boolean;

  session?: {
    id: string;
    status: GameSessionStatus;
    started_at: string;
    stats_snapshot: SessionStatsSnapshot | null;
  } | null;

  state?:
    GameSessionStateRow | null;

  encounters?:
    GameEncounterRow[];

  run_loot?:
    RunLootEntry[];

  code?: string;
  error?: string;
};

export async function getActiveGameSession(
  gameCode: string
) {
  const normalizedGameCode =
    gameCode
      .trim()
      .toUpperCase();

  const {
    data: {
      session: authSession,
    },

    error: authError,
  } =
    await supabase
      .auth
      .getSession();

  if (authError) {
    throw new GameSessionError(
      authError.message,
      "AUTH_SESSION_ERROR",
      401
    );
  }

  if (!authSession) {
    throw new GameSessionError(
      "Player is not authenticated.",
      "UNAUTHORIZED",
      401
    );
  }

  const response =
    await fetch(
      `/api/game/session/active?game_code=${encodeURIComponent(normalizedGameCode)}`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${authSession.access_token}`,
        },

        cache: "no-store",
      }
    );

  let result: ActiveGameSessionResponse;

  try {
    result =
      (await response.json()) as ActiveGameSessionResponse;
  } catch {
    throw new GameSessionError(
      "Invalid response from Active Session server.",
      "INVALID_SERVER_RESPONSE",
      response.status
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new GameSessionError(
      result.error ||
        "Unable to load active session.",

      result.code ||
        "ACTIVE_SESSION_QUERY_FAILED",

      response.status
    );
  }

  return {
    session:
      result.session ??
      null,

    state:
      result.state ??
      null,

    encounters:
      result.encounters ??
      [],

    runLoot:
      result.run_loot ??
      [],
  };
}

// =========================================================
// GAME RESULT
//
// TRUST CLASSIFICATION (STEP 2.5, updated STEP 2.6, STEP 2.7,
// STEP 2.8, STEP 3) -- read before wiring a Reward System to any of
// this. See
// supabase/migrations/202608260003_game_result_trust_classification.sql,
// .../202608260004_authoritative_expedition_state.sql,
// .../202608260005_authoritative_encounters.sql,
// .../202608260006_authoritative_combat.sql, and
// .../202608270001_game_coin_foundation.sql for the same
// classification embedded as DB column comments.
//
// GAME_COIN (STEP 3): coin_earned / coin_balance returned by
// resolveCombat() and finalizeGameSession() are AUTHORITATIVE --
// computed and credited server-side inside resolve_combat() /
// finalize_game_session() from game_coin_reward_rules, never from
// the client. GAME_COIN is a separate, non-tradable gameplay
// currency (public.game_coin_wallets / game_coin_transactions) and
// is never LT (public.wallets) -- gameplay must never mint or
// reward LT.
//
// ITEM DROP (STEP 4B): drops[] returned by resolveCombat(), and
// run_loot[] returned by getActiveGameSession(), are AUTHORITATIVE
// -- rolled server-side by roll_and_grant_item_drop() (called only
// from resolve_combat) from public.game_item_drop_rules, written to
// public.game_session_loot with status UNEXTRACTED. This is NOT
// permanent inventory (public.player_game_inventory) -- STEP 4C
// Extraction decides EXTRACTED vs LOST. LUCK is not applied to drop
// rolls yet (LUCK_DROP_PENDING_BALANCE, see
// supabase/migrations/202608270002_item_drop_foundation.sql).
//
// EXTRACTION (STEP 4C): extraction.status / extraction.items
// returned by finalizeGameSession() are AUTHORITATIVE -- settled
// server-side inside finalize_game_session() via
// extract_session_loot() (SECURITY DEFINER), atomically in the same
// transaction as the COMPLETE/FAIL result itself. COMPLETE (proven
// by exit_reached) credits every UNEXTRACTED loot row into
// public.player_game_inventory and marks it EXTRACTED; FAIL marks it
// LOST and never touches permanent inventory. Both transitions are
// terminal -- a settled row is never rerolled or re-settled, even on
// a retried finalize call (idempotent replay reads the already-
// settled status back from the database).
//
// AUTHORITATIVE (safe for Reward System to key off of):
//   session_id, user_id, duration_seconds, stats_snapshot,
//   started_at, completed_at, fail_reason (constrained enum),
//   result = "COMPLETE" (proven by game_session_state.exit_reached),
//   game_session_state (position/turn_count/exit/player_current_hp),
//   game_encounters existence/id/tier/position/status, and as of
//   STEP 2.8: monsters_killed / elites_killed / score for kills that
//   went through resolve_combat() -- the server computes damage/HP
//   and is the one that marks an encounter DEFEATED and inserts the
//   MONSTER_DEFEATED event (tagged payload.authoritative = true).
//
// TELEMETRY_ONLY:
//   loot_collected, explored_tiles, explored_percent -- Treasure and
//   fog-of-war exploration were explicitly out of STEP 2.8's scope
//   and remain entirely client-reported. Ability effects
//   (BERSERK/FORTIFIED/etc.) are also not yet computed anywhere,
//   server or client.
//
// result = "FAIL" remains a client-initiated request, validated
// only for ownership + ACTIVE session (unchanged from STEP 2.5).
// =========================================================

export type GameResultRow = {
  id: number;

  session_id: string;
  user_id: string;
  game_id: number;

  result:
    "COMPLETE" | "FAIL";

  fail_reason:
    string | null;

  score: number;

  monsters_killed: number;
  elites_killed: number;
  loot_collected: number;

  explored_tiles:
    number | null;

  explored_percent:
    number | null;

  duration_seconds:
    number | null;

  stats_snapshot:
    SessionStatsSnapshot | null;

  started_at:
    string | null;

  completed_at: string;
};

export type FinalizeGameSessionResponse = {
  ok: boolean;

  result?: GameResultRow;

  session?: {
    id: string;

    status: string;
  };

  idempotent_replay?: boolean;

  coin_earned?: number;
  coin_balance?: number;

  extraction?:
    ExtractionSettlement;

  code?: string;
  error?: string;
};

// EXTRACTION SETTLEMENT (STEP 4C). AUTHORITATIVE -- settled
// server-side inside finalize_game_session() via
// extract_session_loot(). status EXTRACTED means every item listed
// was just credited into player_game_inventory; LOST means the run's
// UNEXTRACTED loot was discarded and never touched permanent
// inventory. Never rerolled, never computed from client input.
export type ExtractionSettlement = {
  status:
    "EXTRACTED" | "LOST";

  items:
    RunLootEntry[];
};

export type FinalizeGameSessionInput = {
  sessionId: string;

  result:
    "COMPLETE" | "FAIL";

  exploredTiles?:
    number | null;

  mapTotalTiles?:
    number | null;

  failReason?:
    "PLAYER_HP_DEPLETED" | "STAMINA_DEPLETED" | null;
};

/*
  Finalize is Authority for the Expedition's outcome. The client sends
  only non-authoritative gameplay telemetry (session id, which outcome,
  how many tiles it explored) -- score / monsters_killed / elites_killed
  / loot_collected are computed server-side from game_events already
  recorded during the run, never trusted from here.
*/
export async function finalizeGameSession(
  input: FinalizeGameSessionInput
) {
  const sessionId =
    input.sessionId
      .trim();

  if (!sessionId) {
    throw new GameSessionError(
      "Game Session ID is required.",
      "SESSION_ID_REQUIRED",
      400
    );
  }

  const {
    data: {
      session: authSession,
    },

    error: authError,
  } =
    await supabase
      .auth
      .getSession();

  if (authError) {
    throw new GameSessionError(
      authError.message,
      "AUTH_SESSION_ERROR",
      401
    );
  }

  if (!authSession) {
    throw new GameSessionError(
      "Player is not authenticated.",
      "UNAUTHORIZED",
      401
    );
  }

  const response =
    await fetch(
      "/api/game/session/finalize",
      {
        method: "POST",

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

            result:
              input.result,

            explored_tiles:
              input.exploredTiles ??
              null,

            map_total_tiles:
              input.mapTotalTiles ??
              null,

            fail_reason:
              input.failReason ??
              null,
          }),

        cache: "no-store",
      }
    );

  let result: FinalizeGameSessionResponse;

  try {
    result =
      (await response.json()) as FinalizeGameSessionResponse;
  } catch {
    throw new GameSessionError(
      "Invalid response from Finalize server.",
      "INVALID_SERVER_RESPONSE",
      response.status
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new GameSessionError(
      result.error ||
        "Unable to finalize Game Session.",

      result.code ||
        "FINALIZE_FAILED",

      response.status
    );
  }

  if (!result.result) {
    throw new GameSessionError(
      "Game Result data was not returned.",
      "RESULT_DATA_MISSING",
      500
    );
  }

  return {
    result:
      result.result,

    session:
      result.session ??
      null,

    idempotentReplay:
      result.idempotent_replay ??
      false,

    coinEarned:
      result.coin_earned ??
      0,

    coinBalance:
      result.coin_balance ??
      0,

    extraction:
      result.extraction ??
      null,
  };
}

// =========================================================
// GAME COIN BALANCE (STEP 3)
//
// Read-only lookup of the caller's own GAME_COIN wallet. Never
// creates a wallet row (credit_game_coin() does that lazily on the
// first reward) -- if none exists yet, balance is reported as 0.
// GAME_COIN is a separate, non-tradable gameplay currency; this is
// never the LT wallet (public.wallets).
// =========================================================

export type GameCoinBalanceResponse = {
  ok: boolean;

  balance?: number;
  lifetime_earned?: number;
  lifetime_spent?: number;

  code?: string;
  error?: string;
};

export async function getGameCoinBalance(
  gameCode: string
) {
  const normalizedGameCode =
    gameCode
      .trim()
      .toUpperCase();

  const {
    data: {
      session: authSession,
    },

    error: authError,
  } =
    await supabase
      .auth
      .getSession();

  if (authError) {
    throw new GameSessionError(
      authError.message,
      "AUTH_SESSION_ERROR",
      401
    );
  }

  if (!authSession) {
    throw new GameSessionError(
      "Player is not authenticated.",
      "UNAUTHORIZED",
      401
    );
  }

  const response =
    await fetch(
      `/api/game/coin/balance?game_code=${encodeURIComponent(normalizedGameCode)}`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${authSession.access_token}`,
        },

        cache: "no-store",
      }
    );

  let result: GameCoinBalanceResponse;

  try {
    result =
      (await response.json()) as GameCoinBalanceResponse;
  } catch {
    throw new GameSessionError(
      "Invalid response from Game Coin server.",
      "INVALID_SERVER_RESPONSE",
      response.status
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new GameSessionError(
      result.error ||
        "Unable to load Game Coin balance.",

      result.code ||
        "GAME_COIN_QUERY_FAILED",

      response.status
    );
  }

  return {
    balance:
      result.balance ??
      0,

    lifetimeEarned:
      result.lifetime_earned ??
      0,

    lifetimeSpent:
      result.lifetime_spent ??
      0,
  };
}