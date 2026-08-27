"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  Press_Start_2P,
} from "next/font/google";

import Navbar from "@/components/Navbar";

import LootformHeroSprite, {
  type HeroDirection,
  type HeroGrade,
} from "@/components/game/LootformHeroSprite";

import MobileDpad from "@/components/game/MobileDpad";
import StageIntroOverlay from "@/components/game/StageIntroOverlay";
import GameComingSoonScreen from "@/components/game/GameComingSoonScreen";

import {
  useGameAccessGate,
} from "@/lib/game-access";

import CombatScene, {
  type BattleRound,
} from "@/components/game/CombatScene";

import {
  GameSessionError,
  startGameSession,
  finalizeGameSession,
  moveGameSession,
  getActiveGameSession,
  resolveCombat,
  getGameCoinBalance,
  type RunLootEntry,
  type ExtractionSettlement,
  type SessionStatsSnapshot,
  type GameResultRow,
  type GameSessionStateRow,
  type GameEncounterRow,
} from "@/lib/game-session";

import {
  GameEventError,
  sendGameStartEvent,
  sendTreasureFoundEvent,
} from "@/lib/game-event";

import {
  supabase,
} from "@/lib/supabase";

// =========================================================
// PIXEL DISPLAY FONT (handheld-era HUD chrome only -- generic 8-bit
// typeface, not a Pokemon/Nintendo asset. Reserved for short UI
// chrome: HUD labels, Stage identity, result headlines. Never used
// for body copy/logs -- illegible at that size in a chunky font).
// =========================================================

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
});

// =========================================================
// TYPES
// =========================================================

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type LoadoutSlot =
  | "HEAD"
  | "TOP"
  | "BOTTOM";

type EquipmentItem = {
  id: number;

  serial: string;

  product?:
    | string
    | null;

  product_name_snapshot?:
    | string
    | null;

  grade:
    Grade;

  upgrade_level:
    | number
    | null;

  thumbnail_url_snapshot:
    | string
    | null;
};

type EquipmentEntry = {
  id: number;

  slot: string;

  item_id: number;

  item:
    | EquipmentItem
    | null;
};

type EquipmentApiResponse = {
  ok: boolean;

  slots?: {
    HEAD?:
      | EquipmentEntry
      | null;

    TOP?:
      | EquipmentEntry
      | null;

    BOTTOM?:
      | EquipmentEntry
      | null;
  };

  error?: string;
};

type PlayerStats = {
  maxStamina: number;

  sightRange: number;

  maxHp: number;

  atk: number;

  def: number;

  power: number;
};

// =========================================================
// SESSION RUNTIME STATS
//
// Authoritative for one Expedition once STARTED: frozen from
// game_sessions.stats_snapshot at Session Start (server-computed
// from real equipped item snapshots). Equipment is never re-read
// during PLAYING -- changing gear in another tab cannot affect a
// Session already in progress.
//
// Stamina has no equivalent in the Crafted Shirt Game Stats spec,
// so it intentionally keeps using the existing equipment-preview
// PlayerStats (unchanged, unread again after mount).
// =========================================================

type SessionRuntimeStats = {
  maxHp: number;

  atk: number;

  def: number;

  vision: number;

  luck: number;

  heal: number;

  power: number;

  abilityCode:
    string | null;

  abilityConfig:
    Record<string, unknown> | null;
};

type GameStatus =
  | "READY"
  | "PLAYING"
  | "FINALIZING"
  | "STAMINA_OUT"
  | "DEFEATED"
  | "COMPLETE";

type MonsterTier =
  | "SCOUT"
  | "GUARD"
  | "ELITE";

type TreasureEntity = {
  id: string;

  x: number;

  y: number;

  type:
    "TREASURE";
};

type MonsterEntity = {
  id: string;

  x: number;

  y: number;

  type:
    "MONSTER";

  tier:
    MonsterTier;

  // AUTHORITATIVE (STEP 2.7): the server-owned game_encounters.id
  // this visual monster represents. Combat is triggered from the
  // server's resolve_game_move() response, never from finding this
  // entity in the local array -- this field is render/reporting
  // only.
  encounterId:
    number;
};

type Entity =
  | TreasureEntity
  | MonsterEntity;

type TreasurePopup = {
  title: string;

  sub: string;

  gain: number;
} | null;

type MonsterDefinition = {
  name: string;

  hp: number;

  atk: number;

  def: number;

  score: number;
};

type BattleResult = {
  won: boolean;

  roundCount: number;

  playerHp: number;

  monsterHp: number;

  monster:
    MonsterDefinition;

  rounds:
    BattleRound[];

  drops?:
    RunLootEntry[];
};

type ActiveBattle = {
  entity:
    MonsterEntity;

  targetX:
    number;

  targetY:
    number;

  nextStamina:
    number;

  nextStep:
    number;

  result:
    BattleResult;
};

type LiveGameSession = {
  id: string;

  status: string;

  startedAt: string;

  gameVersion: string;

  engine: string;
};

// =========================================================
// GAME CONFIG
// =========================================================

const GAME_CODE =
  "LF-GRID-EXPEDITION";

const MAP_SIZE =
  15;

const START_X =
  0;

const START_Y =
  0;

const EXIT_X =
  MAP_SIZE - 1;

const EXIT_Y =
  MAP_SIZE - 1;

const MOVE_COST =
  1;

// =========================================================
// BASE STATS
// =========================================================

const BASE_STATS = {
  stamina:
    20,

  sight:
    2,

  hp:
    100,

  atk:
    8,

  def:
    8,
};

// =========================================================
// GRADE MULTIPLIER
// =========================================================

const GRADE_MULTIPLIER:
  Record<
    Grade,
    number
  > = {
    COMMON:
      1,

    RARE:
      1.25,

    EPIC:
      1.6,

    LEGENDARY:
      2,
  };

// =========================================================
// SLOT FACTORS
// =========================================================

const SLOT_FACTORS:
  Record<
    LoadoutSlot,
    {
      stamina: number;
      sight: number;
      atk: number;
      def: number;
    }
  > = {
    HEAD: {
      stamina:
        2,

      sight:
        0.8,

      atk:
        1,

      def:
        1,
    },

    TOP: {
      stamina:
        8,

      sight:
        0.1,

      atk:
        3,

      def:
        4,
    },

    BOTTOM: {
      stamina:
        6,

      sight:
        0.1,

      atk:
        2,

      def:
        4,
    },
  };

// =========================================================
// WALLS
// =========================================================

const WALLS =
  new Set([
    "3,1",
    "3,2",
    "3,3",

    "3,5",
    "3,6",

    "1,4",
    "2,4",

    "5,2",
    "6,2",
    "7,2",

    "6,4",
    "6,5",
    "6,6",

    "8,1",
    "8,2",

    "9,4",
    "10,4",

    "1,8",
    "2,8",
    "3,8",

    "5,8",
    "6,8",

    "8,7",
    "8,8",

    "10,7",
    "10,8",
    "10,9",

    "4,10",
    "5,10",
    "6,10",
  ]);

// =========================================================
// STAGE IDENTITY (STEP 4A)
//
// A client-only presentation seam -- the authoritative map itself
// (size/walls/start/exit) is still entirely server-driven via
// grid_expedition_map_size()/grid_expedition_walls() and is only
// mirrored here for rendering. This object exists so a future
// STAGE 1-2 can be added by defining a second config + swapping
// which one is active, without rewriting the renderer below.
// Naming/labels only -- never a second source of collision truth.
// =========================================================

type StageConfig = {
  id: string;
  zoneId: string;
  zoneName: string;
  stageLabel: string;
  stageName: string;
};

const STAGE_1_1: StageConfig = {
  id: "1-1",
  zoneId: "ZONE 01",
  zoneName: "NEON OUTSKIRTS",
  stageLabel: "STAGE 1-1",
  stageName: "BACK ALLEY",
};

// How many tiles the camera shows on each side of the Player --
// this only changes which tiles get drawn, never posX/posY itself.
// VIEW_RADIUS 5 -> an 11x11 viewport (STEP 4A.1).
const VIEW_RADIUS = 5;

// Deterministic decorative prop per non-walkable/floor tile --
// presentation only, never affects collision (walls remain
// server-mirrored via WALLS above). Re-derives the same prop for the
// same tile on every render/refresh instead of re-rolling randomly.
const FLOOR_PROPS = [
  "PIPE",
  "VENT",
  "CRATE",
  "NEON_SIGN",
  "PANEL",
] as const;

function floorPropAt(
  x: number,
  y: number
): (typeof FLOOR_PROPS)[number] | null {
  const hash =
    (x * 928371 +
      y * 137549 +
      17) %
    47;

  if (
    hash % 11 !==
    0
  ) {
    return null;
  }

  return FLOOR_PROPS[
    Math.abs(
      hash
    ) %
      FLOOR_PROPS.length
  ];
}

// =========================================================
// BASIC HELPERS
// =========================================================

function tileKey(
  x: number,
  y: number
) {
  return `${x},${y}`;
}

function isInsideMap(
  x: number,
  y: number
) {
  return (
    x >=
      0 &&
    x <
      MAP_SIZE &&
    y >=
      0 &&
    y <
      MAP_SIZE
  );
}

// GAME MATERIAL RUN LOOT (STEP 4B). Purely additive display merge --
// the server already decided every quantity; this only combines
// same-item drops into one line for the HUD/reveal.
function mergeRunLoot(
  current: RunLootEntry[],
  incoming: RunLootEntry[] | undefined
): RunLootEntry[] {
  if (
    !incoming ||
    incoming.length === 0
  ) {
    return current;
  }

  const next =
    new Map(
      current.map(
        (entry) => [
          entry.item_code,
          entry,
        ]
      )
    );

  for (const drop of incoming) {
    const existing =
      next.get(
        drop.item_code
      );

    next.set(drop.item_code, {
      item_code:
        drop.item_code,

      item_name:
        drop.item_name,

      rarity:
        drop.rarity,

      quantity:
        (existing?.quantity ??
          0) +
        drop.quantity,
    });
  }

  return Array.from(
    next.values()
  );
}

function rarityTextClass(
  rarity: string
): string {
  switch (
    rarity
  ) {
    case "LEGENDARY":
      return "text-orange-400";
    case "EPIC":
      return "text-purple-400";
    case "RARE":
      return "text-cyan-400";
    case "UNCOMMON":
      return "text-lime-400";
    default:
      return "text-zinc-400";
  }
}

function rarityBorderClass(
  rarity: string
): string {
  switch (
    rarity
  ) {
    case "LEGENDARY":
      return "border-orange-400/40 bg-orange-400/[0.06]";
    case "EPIC":
      return "border-purple-400/40 bg-purple-400/[0.06]";
    case "RARE":
      return "border-cyan-400/40 bg-cyan-400/[0.06]";
    case "UNCOMMON":
      return "border-lime-400/40 bg-lime-400/[0.06]";
    default:
      return "border-zinc-700 bg-zinc-900";
  }
}

function isWall(
  x: number,
  y: number
) {
  return WALLS.has(
    tileKey(
      x,
      y
    )
  );
}

function isWalkable(
  x: number,
  y: number
) {
  return (
    isInsideMap(
      x,
      y
    ) &&
    !isWall(
      x,
      y
    )
  );
}

function getItemName(
  item:
    | EquipmentItem
    | null
    | undefined
) {
  if (
    !item
  ) {
    return "EMPTY SLOT";
  }

  return (
    item.product_name_snapshot ||
    item.product ||
    item.serial ||
    "LOOTFORM ITEM"
  );
}

function shortSessionId(
  value:
    string
) {
  if (
    value.length <=
    12
  ) {
    return value;
  }

  return `${value.slice(
    0,
    8
  )}...${value.slice(
    -4
  )}`;
}

// =========================================================
// FORMAT DURATION
// =========================================================

function formatDuration(
  totalSeconds:
    number | null
) {
  if (
    totalSeconds === null ||
    !Number.isFinite(
      totalSeconds
    )
  ) {
    return "-";
  }

  const clamped =
    Math.max(
      0,
      Math.round(
        totalSeconds
      )
    );

  const minutes =
    Math.floor(
      clamped / 60
    );

  const seconds =
    clamped % 60;

  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    seconds
  ).padStart(
    2,
    "0"
  )}`;
}

// =========================================================
// HERO GRADE
// =========================================================

function getHighestGrade(
  equipment:
    Record<
      LoadoutSlot,
      EquipmentEntry | null
    >
): HeroGrade {
  const grades =
    (
      [
        "HEAD",
        "TOP",
        "BOTTOM",
      ] as LoadoutSlot[]
    )
      .map(
        (
          slot
        ) =>
          equipment[
            slot
          ]?.item
            ?.grade
      )
      .filter(
        Boolean
      ) as Grade[];

  if (
    grades.includes(
      "LEGENDARY"
    )
  ) {
    return "LEGENDARY";
  }

  if (
    grades.includes(
      "EPIC"
    )
  ) {
    return "EPIC";
  }

  if (
    grades.includes(
      "RARE"
    )
  ) {
    return "RARE";
  }

  return "COMMON";
}

// =========================================================
// EQUIPMENT → STATS
// =========================================================

function calculatePlayerStats(
  slots:
    Record<
      LoadoutSlot,
      EquipmentEntry | null
    >
): PlayerStats {
  let stamina =
    BASE_STATS.stamina;

  let sight =
    BASE_STATS.sight;

  let atk =
    BASE_STATS.atk;

  let def =
    BASE_STATS.def;

  (
    [
      "HEAD",
      "TOP",
      "BOTTOM",
    ] as LoadoutSlot[]
  ).forEach(
    (
      slot
    ) => {
      const item =
        slots[
          slot
        ]?.item;

      if (
        !item
      ) {
        return;
      }

      const multiplier =
        GRADE_MULTIPLIER[
          item.grade
        ];

      const factor =
        SLOT_FACTORS[
          slot
        ];

      stamina +=
        factor.stamina *
        multiplier;

      sight +=
        factor.sight *
        multiplier;

      atk +=
        factor.atk *
        multiplier;

      def +=
        factor.def *
        multiplier;
    }
  );

  const roundedAtk =
    Math.round(
      atk
    );

  const roundedDef =
    Math.round(
      def
    );

  return {
    maxStamina:
      Math.round(
        stamina
      ),

    sightRange:
      Math.max(
        2,
        Math.min(
          5,
          Math.floor(
            sight
          )
        )
      ),

    maxHp:
      BASE_STATS.hp,

    atk:
      roundedAtk,

    def:
      roundedDef,

    power:
      Math.round(
        roundedAtk *
          1.5 +
        roundedDef *
          1.2
      ),
  };
}

// =========================================================
// SESSION RUNTIME STATS FROM SNAPSHOT
//
// The only source used for HP / ATK / DEF / VISION once an
// Expedition has started. LUCK and HEAL are loaded but not
// consumed yet (Drop / Potion are later phases). Ability is
// read from the TOP slot's frozen snapshot -- Expedition Mode
// treats the equipped shirt as the ability carrier.
// =========================================================

function buildSessionRuntimeStats(
  snapshot:
    SessionStatsSnapshot | null
): SessionRuntimeStats {
  const effective =
    snapshot?.effective ?? {
      hp: BASE_STATS.hp,
      attack: BASE_STATS.atk,
      defense: BASE_STATS.def,
      luck: 0,
      heal: 0,
      vision: BASE_STATS.sight,
    };

  const topEntry =
    snapshot?.equipment?.find(
      (entry) =>
        entry.slot ===
        "TOP"
    ) ??
    null;

  const atk =
    Math.round(
      effective.attack
    );

  const def =
    Math.round(
      effective.defense
    );

  return {
    maxHp:
      Math.round(
        effective.hp
      ),

    atk,

    def,

    vision:
      Math.max(
        2,
        Math.min(
          5,
          Math.round(
            effective.vision
          )
        )
      ),

    luck:
      Number(
        effective.luck
      ),

    heal:
      Number(
        effective.heal
      ),

    power:
      Math.round(
        atk *
          1.5 +
        def *
          1.2
      ),

    abilityCode:
      topEntry
        ?.ability_code ??
      null,

    abilityConfig:
      topEntry
        ?.ability_config ??
      null,
  };
}

// =========================================================
// FOG OF WAR
// =========================================================

function calculateVisibleTiles(
  startX:
    number,

  startY:
    number,

  sightRange:
    number
) {
  const visible =
    new Set<string>();

  const visited =
    new Set<string>();

  const queue: {
    x: number;
    y: number;
    distance: number;
  }[] = [
    {
      x:
        startX,

      y:
        startY,

      distance:
        0,
    },
  ];

  visited.add(
    tileKey(
      startX,
      startY
    )
  );

  while (
    queue.length >
    0
  ) {
    const current =
      queue.shift();

    if (
      !current
    ) {
      continue;
    }

    visible.add(
      tileKey(
        current.x,
        current.y
      )
    );

    if (
      current.distance >=
      sightRange
    ) {
      continue;
    }

    const directions = [
      {
        x:
          1,

        y:
          0,
      },

      {
        x:
          -1,

        y:
          0,
      },

      {
        x:
          0,

        y:
          1,
      },

      {
        x:
          0,

        y:
          -1,
      },
    ];

    for (
      const direction
      of directions
    ) {
      const nextX =
        current.x +
        direction.x;

      const nextY =
        current.y +
        direction.y;

      if (
        !isInsideMap(
          nextX,
          nextY
        )
      ) {
        continue;
      }

      const key =
        tileKey(
          nextX,
          nextY
        );

      if (
        visited.has(
          key
        )
      ) {
        continue;
      }

      visited.add(
        key
      );

      if (
        isWall(
          nextX,
          nextY
        )
      ) {
        visible.add(
          key
        );

        continue;
      }

      queue.push({
        x:
          nextX,

        y:
          nextY,

        distance:
          current.distance +
          1,
      });
    }
  }

  return visible;
}

// =========================================================
// CREATE TREASURE ENTITIES
//
// STEP 2.7: Monster/Elite placement moved server-side
// (generate_game_encounters) -- this function only ever creates
// TREASURE now (Treasure stays out of this STEP's scope; it is
// still client-only telemetry, unchanged). reservedTiles excludes
// whatever tiles the server already placed a Monster/Elite on, so
// treasure and monsters never overlap.
// =========================================================

function createTreasureEntities(
  reservedTiles:
    Set<string>
): TreasureEntity[] {
  const available: {
    x: number;
    y: number;
  }[] = [];

  for (
    let y =
      0;
    y <
      MAP_SIZE;
    y++
  ) {
    for (
      let x =
        0;
      x <
        MAP_SIZE;
      x++
    ) {
      if (
        !isWalkable(
          x,
          y
        )
      ) {
        continue;
      }

      if (
        x ===
          START_X &&
        y ===
          START_Y
      ) {
        continue;
      }

      if (
        x ===
          EXIT_X &&
        y ===
          EXIT_Y
      ) {
        continue;
      }

      if (
        reservedTiles.has(
          tileKey(
            x,
            y
          )
        )
      ) {
        continue;
      }

      available.push({
        x,
        y,
      });
    }
  }

  for (
    let i =
      available.length -
      1;
    i >
      0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() *
        (
          i +
          1
        )
      );

    [
      available[
        i
      ],
      available[
        j
      ],
    ] = [
      available[
        j
      ],
      available[
        i
      ],
    ];
  }

  const result:
    TreasureEntity[] = [];

  for (
    let i =
      0;
    i <
      7;
    i++
  ) {
    const tile =
      available[
        i
      ];

    if (
      !tile
    ) {
      break;
    }

    result.push({
      id:
        `TREASURE-${Date.now()}-${i}`,

      x:
        tile.x,

      y:
        tile.y,

      type:
        "TREASURE",
    });
  }

  return result;
}

// =========================================================
// ENCOUNTERS -> MONSTER ENTITIES (RENDER ONLY)
//
// Converts server-owned game_encounters rows into the visual
// MonsterEntity shape the grid already knows how to draw. This is
// display data only -- resolve_game_move()'s response, not a
// lookup into this array, is what actually triggers combat
// (STEP 2.7 trust classification).
// =========================================================

function encountersToMonsterEntities(
  encounters:
    GameEncounterRow[]
): MonsterEntity[] {
  return encounters
    .filter(
      (
        encounter
      ) =>
        encounter.status ===
          "AVAILABLE" ||
        encounter.status ===
          "ACTIVE"
    )
    .map(
      (
        encounter
      ) => ({
        id:
          `ENCOUNTER-${encounter.id}`,

        x:
          encounter.x,

        y:
          encounter.y,

        type:
          "MONSTER" as const,

        tier:
          encounter.tier,

        encounterId:
          encounter.id,
      })
    );
}

// =========================================================
// PAGE
// =========================================================

export default function GameExpeditionPage() {
  const router =
    useRouter();

  const {
    checked:
      gameAccessChecked,

    allowed:
      gameAccessAllowed,
  } =
    useGameAccessGate();

  const movementLock =
    useRef(
      false
    );

  const sessionStartLock =
    useRef(
      false
    );

  const movementTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );

  const [
    startingSession,
    setStartingSession,
  ] =
    useState(
      false
    );

  const [
    sessionError,
    setSessionError,
  ] =
    useState(
      ""
    );

  const [
    finalizeError,
    setFinalizeError,
  ] =
    useState(
      ""
    );

  const [
    gameResult,
    setGameResult,
  ] =
    useState<GameResultRow | null>(
      null
    );

  // GAME_COIN (STEP 3). coinBalance is the AUTHORITATIVE current
  // wallet total (server-reported); runCoinEarned only accumulates
  // the coin_earned amounts the server already returned this run --
  // it never invents or predicts a reward client-side.
  const [
    coinBalance,
    setCoinBalance,
  ] =
    useState<number | null>(
      null
    );

  // PLAYER LV (STEP 4A.1) -- see the loadPlayerLevel effect below
  // for why EXP is intentionally not tracked here.
  const [
    playerLevel,
    setPlayerLevel,
  ] =
    useState<number | null>(
      null
    );

  const [
    runCoinEarned,
    setRunCoinEarned,
  ] =
    useState(0);

  // UNEXTRACTED RUN LOOT (STEP 4B). AUTHORITATIVE -- every entry
  // came from a resolveCombat() response or the resume endpoint's
  // run_loot. Not permanent inventory; STEP 4C decides EXTRACTED
  // vs LOST.
  const [
    runLoot,
    setRunLoot,
  ] =
    useState<RunLootEntry[]>(
      []
    );

  // Brief post-victory reveal. null = hidden, [] = "no material
  // found", non-empty = itemized drop(s) just granted.
  const [
    dropReveal,
    setDropReveal,
  ] =
    useState<
      RunLootEntry[] | null
    >(
      null
    );

  // Mobile-only collapse for the BUILD/RUN LOOT/LOADOUT column so
  // the game viewport stays the visual priority on small screens
  // (xl and above always show it regardless of this flag).
  const [
    buildPanelOpen,
    setBuildPanelOpen,
  ] =
    useState(false);

  // EXTRACTION SETTLEMENT (STEP 4C). AUTHORITATIVE -- comes straight
  // from finalizeGameSession()'s response, never computed here.
  const [
    extractionSettlement,
    setExtractionSettlement,
  ] =
    useState<
      ExtractionSettlement | null
    >(
      null
    );

  // STAGE IDENTITY intro card (STEP 4A). Presentation only -- shown
  // once on a fresh START EXPEDITION, never on refresh/resume, and
  // never gates any authoritative call.
  const [
    showStageIntro,
    setShowStageIntro,
  ] =
    useState(false);

  // Short glitch/scanline transition played while switching from
  // Map View into the existing CombatScene. Purely cosmetic --
  // activeBattle (the real state) is set at the same time as this.
  const [
    combatEnterGlitch,
    setCombatEnterGlitch,
  ] =
    useState(false);

  const [
    liveSession,
    setLiveSession,
  ] =
    useState<
      LiveGameSession | null
    >(
      null
    );

  const [
    equipment,
    setEquipment,
  ] =
    useState<
      Record<
        LoadoutSlot,
        EquipmentEntry | null
      >
    >({
      HEAD:
        null,

      TOP:
        null,

      BOTTOM:
        null,
    });

  const [
    playerStats,
    setPlayerStats,
  ] =
    useState<PlayerStats>({
      maxStamina:
        BASE_STATS.stamina,

      sightRange:
        BASE_STATS.sight,

      maxHp:
        BASE_STATS.hp,

      atk:
        BASE_STATS.atk,

      def:
        BASE_STATS.def,

      power:
        22,
    });

  const [
    sessionStats,
    setSessionStats,
  ] =
    useState<SessionRuntimeStats | null>(
      null
    );

  const [
    sessionState,
    setSessionState,
  ] =
    useState<GameSessionStateRow | null>(
      null
    );

  const [
    resolvingCombat,
    setResolvingCombat,
  ] =
    useState(
      false
    );

  const [
    posX,
    setPosX,
  ] =
    useState(
      START_X
    );

  const [
    posY,
    setPosY,
  ] =
    useState(
      START_Y
    );

  const [
    heroDirection,
    setHeroDirection,
  ] =
    useState<HeroDirection>(
      "DOWN"
    );

  const [
    heroMoving,
    setHeroMoving,
  ] =
    useState(
      false
    );

  const [
    stamina,
    setStamina,
  ] =
    useState(
      BASE_STATS.stamina
    );

  const [
    playerHp,
    setPlayerHp,
  ] =
    useState(
      BASE_STATS.hp
    );

  const [
    runScore,
    setRunScore,
  ] =
    useState(
      0
    );

  const [
    stepCount,
    setStepCount,
  ] =
    useState(
      0
    );

  const [
    monstersDefeated,
    setMonstersDefeated,
  ] =
    useState(
      0
    );

  const [
    entities,
    setEntities,
  ] =
    useState<
      Entity[]
    >(
      []
    );

  const [
    exploredTiles,
    setExploredTiles,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  const [
    gameStatus,
    setGameStatus,
  ] =
    useState<GameStatus>(
      "READY"
    );

  const [
    treasurePopup,
    setTreasurePopup,
  ] =
    useState<TreasurePopup>(
      null
    );

  const [
    activeBattle,
    setActiveBattle,
  ] =
    useState<
      ActiveBattle | null
    >(
      null
    );

  const [
    log,
    setLog,
  ] =
    useState<
      string[]
    >([
      "SYSTEM: Waiting for expedition...",
    ]);

  // =====================================================
  // HERO GRADE
  // =====================================================

  const heroGrade =
    useMemo(
      () =>
        getHighestGrade(
          equipment
        ),
      [
        equipment,
      ]
    );

  // =====================================================
  // ACTIVE STATS
  //
  // Before a Session exists: live equipment preview (same
  // numbers the pre-game HERO STATS panel always showed).
  //
  // Once a Session is live: the frozen Session Runtime Stats
  // from stats_snapshot -- authoritative for HP / ATK / DEF /
  // VISION for the rest of this Expedition, regardless of any
  // equipment change made anywhere else while playing.
  // =====================================================

  const activeStats =
    useMemo(
      (): SessionRuntimeStats =>
        sessionStats ?? {
          maxHp:
            playerStats.maxHp,

          atk:
            playerStats.atk,

          def:
            playerStats.def,

          vision:
            playerStats.sightRange,

          luck:
            0,

          heal:
            0,

          power:
            playerStats.power,

          abilityCode:
            null,

          abilityConfig:
            null,
        },
      [
        sessionStats,
        playerStats,
      ]
    );

  // =====================================================
  // CAMERA (STEP 4A)
  //
  // Presentation only -- windows which tiles get drawn around the
  // AUTHORITATIVE posX/posY instead of rendering the whole map at
  // once. Clamped to map edges so the window never shows outside
  // MAP_SIZE. Never creates its own position state.
  // =====================================================

  const cameraViewSize =
    VIEW_RADIUS *
      2 +
    1;

  const cameraMinX =
    Math.max(
      0,
      Math.min(
        posX -
          VIEW_RADIUS,
        MAP_SIZE -
          cameraViewSize
      )
    );

  const cameraMinY =
    Math.max(
      0,
      Math.min(
        posY -
          VIEW_RADIUS,
        MAP_SIZE -
          cameraViewSize
      )
    );

  // =====================================================
  // LOG
  // =====================================================

  const addLog =
    useCallback(
      (
        message:
          string
      ) => {
        setLog(
          (
            current
          ) => [
            message,
            ...current,
          ].slice(
            0,
            40
          )
        );
      },
      []
    );

  // =====================================================
  // LOAD EQUIPMENT
  // =====================================================

  useEffect(() => {
    async function loadPlayerEquipment() {
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      try {
        const {
          data: {
            session,
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
          throw authError;
        }

        if (
          !session
        ) {
          router.push(
            "/login"
          );

          return;
        }

        const response =
          await fetch(
            "/api/profile/equipment",
            {
              method:
                "GET",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            }
          );

        const result =
          (await response.json()) as EquipmentApiResponse;

        if (
          !response.ok ||
          !result.ok
        ) {
          throw new Error(
            result.error ||
              "Unable to load equipment."
          );
        }

        const nextEquipment:
          Record<
            LoadoutSlot,
            EquipmentEntry | null
          > = {
            HEAD:
              result.slots
                ?.HEAD ??
              null,

            TOP:
              result.slots
                ?.TOP ??
              null,

            BOTTOM:
              result.slots
                ?.BOTTOM ??
              null,
          };

        const stats =
          calculatePlayerStats(
            nextEquipment
          );

        setEquipment(
          nextEquipment
        );

        setPlayerStats(
          stats
        );

        setStamina(
          stats.maxStamina
        );

        setPlayerHp(
          stats.maxHp
        );

        /*
          REFRESH RECOVERY (STEP 2.6)

          If the server already has an ACTIVE session for this game,
          resume into it instead of assuming none exists. A refresh
          must never quietly reset the player back to Player Start
          just because local React state was lost.

          entities (monsters/treasure) and runScore/log are NOT
          restored -- they were never server-tracked (see report).
          Position, turn count and exit_reached are.
        */
        try {
          const active =
            await getActiveGameSession(
              GAME_CODE
            );

          if (
            active.session &&
            active.state
          ) {
            const resumedStats =
              buildSessionRuntimeStats(
                active.session
                  .stats_snapshot
              );

            setSessionStats(
              resumedStats
            );

            setSessionState(
              active.state
            );

            setLiveSession({
              id:
                active.session
                  .id,

              status:
                active.session
                  .status,

              startedAt:
                active.session
                  .started_at,

              gameVersion:
                "1.0",

              engine:
                "INTERNAL",
            });

            setPosX(
              active.state
                .current_x
            );

            setPosY(
              active.state
                .current_y
            );

            setStamina(
              Math.max(
                0,
                stats.maxStamina -
                  active.state
                    .turn_count
              )
            );

            setPlayerHp(
              active.state
                .player_current_hp ??
                resumedStats.maxHp
            );

            setStepCount(
              active.state
                .turn_count
            );

            setRunLoot(
              active.runLoot
            );

            /*
              STEP 2.7: rebuild Monster/Elite entities from the
              server's own game_encounters rows -- no longer
              re-randomized on refresh. Treasure remains client-only
              telemetry (out of this STEP's scope) and still
              re-randomizes, but now avoids tiles the server already
              reserved for a real encounter.
            */
            const resumedMonsterEntities =
              encountersToMonsterEntities(
                active.encounters
              );

            const resumedReservedTiles =
              new Set(
                resumedMonsterEntities.map(
                  (
                    monster
                  ) =>
                    tileKey(
                      monster.x,
                      monster.y
                    )
                )
              );

            setEntities([
              ...resumedMonsterEntities,
              ...createTreasureEntities(
                resumedReservedTiles
              ),
            ]);

            setGameStatus(
              "PLAYING"
            );

            setLog([
              "SYSTEM: Resumed expedition from server state.",
              `SESSION: ${active.session.id}`,
              `POSITION: ${active.state.current_x}, ${active.state.current_y}`,
            ]);

            /*
              An ACTIVE encounter means the player refreshed
              mid-fight. As of STEP 2.8, combat is resolved
              server-side (resolve_combat) -- call it fresh using
              the restored, authoritative session, same as walking
              onto the encounter for the first time.
            */
            const resumedActiveEncounter =
              active.encounters.find(
                (
                  encounter
                ) =>
                  encounter.status ===
                  "ACTIVE"
              );

            if (
              resumedActiveEncounter
            ) {
              setResolvingCombat(
                true
              );

              try {
                const result =
                  await resolveCombat(
                    active.session.id,
                    resumedActiveEncounter.id
                  );

                setRunCoinEarned(
                  (prev) =>
                    prev +
                    result.coinEarned
                );

                setCoinBalance(
                  result.coinBalance
                );

                setActiveBattle({
                  entity: {
                    id: `ENCOUNTER-${resumedActiveEncounter.id}`,

                    x:
                      resumedActiveEncounter.x,

                    y:
                      resumedActiveEncounter.y,

                    type:
                      "MONSTER",

                    tier:
                      resumedActiveEncounter.tier,

                    encounterId:
                      resumedActiveEncounter.id,
                  },

                  targetX:
                    resumedActiveEncounter.x,

                  targetY:
                    resumedActiveEncounter.y,

                  nextStamina:
                    Math.max(
                      0,
                      stats.maxStamina -
                        active.state
                          .turn_count
                    ),

                  nextStep:
                    active.state
                      .turn_count,

                  result,
                });
              } catch (
                resumeCombatError
              ) {
                console.error(
                  "RESUME COMBAT ERROR:",
                  resumeCombatError
                );
              } finally {
                setResolvingCombat(
                  false
                );
              }
            }
          }
        } catch (
          resumeError
        ) {
          console.error(
            "GAME RESUME ERROR:",
            resumeError
          );
        }
      } catch (
        error
      ) {
        console.error(
          "GAME LOAD ERROR:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load game."
        );
      } finally {
        setLoading(
          false
        );
      }
    }

    void loadPlayerEquipment();
  }, [
    router,
  ]);

  // GAME_COIN (STEP 3). Read-only display refresh -- never gates
  // gameplay, so a failure here is swallowed rather than surfaced.
  useEffect(() => {
    async function loadCoinBalance() {
      try {
        const wallet =
          await getGameCoinBalance(
            GAME_CODE
          );

        setCoinBalance(
          wallet.balance
        );
      } catch (
        coinError
      ) {
        console.error(
          "GAME COIN BALANCE LOAD ERROR:",
          coinError
        );
      }
    }

    void loadCoinBalance();
  }, []);

  // PLAYER LV (STEP 4A.1). Reads public.player_profiles.level -- the
  // same table/column Member Home already displays, via the same
  // RLS-gated own-row SELECT pattern (app/page.tsx). Not a new
  // backend feature. EXP is intentionally NOT read/shown here: this
  // column has an UPDATE RLS policy with no column restriction (any
  // authenticated user can write their own row) and Member Home's
  // EXP bar uses a hardcoded formula, not the real level_rules
  // table -- reported as CHARACTER_PROGRESSION_AUTHORITY_PENDING
  // rather than fabricating a progress bar from an unsafe source.
  useEffect(() => {
    async function loadPlayerLevel() {
      try {
        const {
          data: {
            user,
          },
        } =
          await supabase
            .auth
            .getUser();

        if (!user) {
          return;
        }

        const {
          data,
        } =
          await supabase
            .from(
              "player_profiles"
            )
            .select(
              "level"
            )
            .eq(
              "user_id",
              user.id
            )
            .maybeSingle();

        setPlayerLevel(
          data?.level ??
            1
        );
      } catch (
        levelError
      ) {
        console.error(
          "PLAYER LEVEL LOAD ERROR:",
          levelError
        );
      }
    }

    void loadPlayerLevel();
  }, []);

  // STAGE IDENTITY intro auto-dismiss (STEP 4A). Presentation only.
  useEffect(() => {
    if (
      !showStageIntro
    ) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        setShowStageIntro(
          false
        );
      }, 2200);

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    showStageIntro,
  ]);

  // DROP REVEAL auto-dismiss (STEP 4B). Presentation only.
  useEffect(() => {
    if (
      dropReveal ===
      null
    ) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        setDropReveal(
          null
        );
      }, 1200);

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    dropReveal,
  ]);

  // =====================================================
  // FOG
  // =====================================================

  const visibleTiles =
    useMemo(
      () =>
        calculateVisibleTiles(
          posX,
          posY,
          activeStats.vision
        ),
      [
        posX,
        posY,
        activeStats.vision,
      ]
    );

  useEffect(() => {
    setExploredTiles(
      (
        current
      ) => {
        const next =
          new Set(
            current
          );

        visibleTiles.forEach(
          (
            key
          ) => {
            next.add(
              key
            );
          }
        );

        return next;
      }
    );
  }, [
    visibleTiles,
  ]);

  // =====================================================
  // TIMER CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      if (
        movementTimer.current
      ) {
        clearTimeout(
          movementTimer.current
        );
      }
    };
  }, []);

  // =====================================================
  // MOVE ANIMATION
  // =====================================================

  const playMovementAnimation =
    useCallback(
      () => {
        setHeroMoving(
          false
        );

        if (
          movementTimer.current
        ) {
          clearTimeout(
            movementTimer.current
          );
        }

        requestAnimationFrame(
          () => {
            setHeroMoving(
              true
            );
          }
        );

        movementTimer.current =
          setTimeout(
            () => {
              setHeroMoving(
                false
              );
            },
            190
          );
      },
      []
    );

  // =====================================================
  // START REAL GAME SESSION + GAME_START EVENT
  // =====================================================

  const startExpedition =
    useCallback(
      async () => {
        if (
          sessionStartLock.current
        ) {
          return;
        }

        sessionStartLock.current =
          true;

        setStartingSession(
          true
        );

        setSessionError(
          ""
        );

        try {
          const created =
            await startGameSession(
              GAME_CODE
            );

          /*
            Session Runtime Stats: frozen from the Session's own
            stats_snapshot, not recomputed from live equipment.
            This is what HP / ATK / DEF / VISION use for the rest
            of this Expedition (spec section 12/13).
          */
          const nextSessionStats =
            buildSessionRuntimeStats(
              created.session
                .stats_snapshot
            );

          /*
            AUTHORITATIVE EXPEDITION STATE (STEP 2.6)
            Without this row, every move call fails server-side --
            fail the start clearly rather than entering a broken
            PLAYING state.
          */
          if (
            !created.session
              .state
          ) {
            throw new GameSessionError(
              "Expedition state was not created for this session.",
              "SESSION_STATE_MISSING",
              500
            );
          }

          const startState =
            created.session
              .state;

          await sendGameStartEvent(
            created.session.id,
            {
              source:
                "GRID_EXPEDITION",

              map:
                "SECTOR_A_01",

              hero_grade:
                heroGrade,

              max_stamina:
                playerStats.maxStamina,

              max_hp:
                nextSessionStats.maxHp,

              sight_range:
                nextSessionStats.vision,

              power:
                nextSessionStats.power,

              atk:
                nextSessionStats.atk,

              def:
                nextSessionStats.def,

              ability_code:
                nextSessionStats.abilityCode,
            }
          );

          setSessionStats(
            nextSessionStats
          );

          setSessionState(
            startState
          );

          setLiveSession({
            id:
              created.session.id,

            status:
              created.session.status,

            startedAt:
              created.session.started_at,

            gameVersion:
              created.game.version,

            engine:
              created.game.engine,
          });

          movementLock.current =
            false;

          setPosX(
            startState.current_x
          );

          setPosY(
            startState.current_y
          );

          setHeroDirection(
            "DOWN"
          );

          setHeroMoving(
            false
          );

          setStamina(
            playerStats.maxStamina
          );

          setPlayerHp(
            nextSessionStats.maxHp
          );

          setRunScore(
            0
          );

          setStepCount(
            0
          );

          setMonstersDefeated(
            0
          );

          setRunLoot(
            []
          );

          setDropReveal(
            null
          );

          setExtractionSettlement(
            null
          );

          /*
            STEP 2.7: Monster/Elite entities come from the server's
            own game_encounters rows created by Session Start --
            the client no longer generates them. Treasure remains
            client-only telemetry (out of this STEP's scope) but
            avoids whatever tiles the server reserved for a real
            encounter.
          */
          const startMonsterEntities =
            encountersToMonsterEntities(
              created.session
                .encounters ??
                []
            );

          const startReservedTiles =
            new Set(
              startMonsterEntities.map(
                (
                  monster
                ) =>
                  tileKey(
                    monster.x,
                    monster.y
                  )
              )
            );

          setEntities([
            ...startMonsterEntities,
            ...createTreasureEntities(
              startReservedTiles
            ),
          ]);

          setExploredTiles(
            new Set()
          );

          setTreasurePopup(
            null
          );

          setActiveBattle(
            null
          );

          setGameResult(
            null
          );

          setFinalizeError(
            ""
          );

          setShowStageIntro(
            true
          );

          setGameStatus(
            "PLAYING"
          );

          setLog([
            "SERVER: GAME_START RECORDED ✓",
            `SESSION: ${created.session.id}`,
            `GAME: ${created.game.code} v${created.game.version}`,
            "SYSTEM: Expedition started.",
            "Find the EXIT before Stamina reaches zero.",
          ]);
        } catch (
          error
        ) {
          console.error(
            "START EXPEDITION ERROR:",
            error
          );

          setLiveSession(
            null
          );

          if (
            error instanceof
            GameEventError
          ) {
            setSessionError(
              `GAME EVENT ${error.code}: ${error.message}`
            );
          } else if (
            error instanceof
            GameSessionError
          ) {
            setSessionError(
              `GAME SESSION ${error.code}: ${error.message}`
            );
          } else {
            setSessionError(
              error instanceof Error
                ? error.message
                : "Unable to start expedition."
            );
          }

          setGameStatus(
            "READY"
          );
        } finally {
          setStartingSession(
            false
          );

          sessionStartLock.current =
            false;
        }
      },
      [
        heroGrade,
        playerStats,
      ]
    );

  // =====================================================
  // TREASURE SERVER EVENT
  // =====================================================

  const recordTreasureEvent =
    useCallback(
      async (
        sessionId:
          string,

        gain:
          number,

        targetX:
          number,

        targetY:
          number,

        nextStep:
          number,

        scoreAfter:
          number
      ) => {
        try {
          const result =
            await sendTreasureFoundEvent(
              sessionId,
              gain,
              {
                source:
                  "GRID_EXPEDITION",

                map:
                  "SECTOR_A_01",

                x:
                  targetX,

                y:
                  targetY,

                step:
                  nextStep,

                score_gain:
                  gain,

                run_score:
                  scoreAfter,
              }
            );

          addLog(
            `SERVER: TREASURE_FOUND EVENT #${result.event.id} ✓`
          );
        } catch (
          error
        ) {
          console.error(
            "TREASURE EVENT ERROR:",
            error
          );

          if (
            error instanceof
            GameEventError
          ) {
            addLog(
              `⚠ SERVER EVENT FAILED: ${error.code}`
            );
          } else {
            addLog(
              "⚠ SERVER EVENT FAILED: TREASURE_FOUND"
            );
          }
        }
      },
      [
        addLog,
      ]
    );

  // =====================================================
  // MONSTER DEFEATED SERVER EVENT
  //
  // Removed in STEP 2.8: resolve_combat() now records
  // MONSTER_DEFEATED atomically as part of resolving the fight
  // server-side. Calling the generic event API again here would
  // double-count every kill.
  // =====================================================

  // =====================================================
  // FINALIZE EXPEDITION
  //
  // Single choke point for every way a run can end (reach EXIT,
  // HP depleted, Stamina depleted). Movement/combat is already
  // blocked the instant gameStatus leaves "PLAYING" -- this runs
  // FINALIZING -> server call -> the same terminal status the
  // caller asked for, now carrying the server's Game Result.
  //
  // On a network/server error we still land on the terminal status
  // (never leave the player stuck on FINALIZING); the Result Screen
  // shows a "could not confirm result" fallback instead of stats.
  // =====================================================

  const finalizeExpedition =
    useCallback(
      async (
        outcome:
          | "COMPLETE"
          | "DEFEATED"
          | "STAMINA_OUT"
      ) => {
        setGameStatus(
          "FINALIZING"
        );

        setFinalizeError(
          ""
        );

        if (
          !liveSession
        ) {
          addLog(
            "⚠ FINALIZE SKIPPED: NO LIVE SESSION"
          );

          setGameStatus(
            outcome
          );

          return;
        }

        try {
          const finalized =
            await finalizeGameSession(
              {
                sessionId:
                  liveSession.id,

                result:
                  outcome ===
                  "COMPLETE"
                    ? "COMPLETE"
                    : "FAIL",

                exploredTiles:
                  exploredTiles.size,

                mapTotalTiles:
                  MAP_SIZE *
                  MAP_SIZE,

                failReason:
                  outcome ===
                  "DEFEATED"
                    ? "PLAYER_HP_DEPLETED"
                    : outcome ===
                      "STAMINA_OUT"
                    ? "STAMINA_DEPLETED"
                    : null,
              }
            );

          setGameResult(
            finalized.result
          );

          setRunCoinEarned(
            (prev) =>
              prev +
              finalized.coinEarned
          );

          setCoinBalance(
            finalized.coinBalance
          );

          setExtractionSettlement(
            finalized.extraction
          );

          addLog(
            finalized.idempotentReplay
              ? "SERVER: RESULT ALREADY FINALIZED ✓"
              : `SERVER: ${outcome === "COMPLETE" ? "COMPLETE" : "FAIL"} RECORDED ✓`
          );
        } catch (
          error
        ) {
          console.error(
            "FINALIZE EXPEDITION ERROR:",
            error
          );

          setGameResult(
            null
          );

          setFinalizeError(
            error instanceof
            GameSessionError
              ? `GAME RESULT ${error.code}: ${error.message}`
              : error instanceof Error
              ? error.message
              : "Unable to finalize expedition."
          );
        } finally {
          setGameStatus(
            outcome
          );
        }
      },
      [
        addLog,
        exploredTiles,
        liveSession,
      ]
    );

  // =====================================================
  // FINISH BATTLE
  // =====================================================

  const finishBattle =
    useCallback(
      () => {
        if (
          !activeBattle
        ) {
          return;
        }

        const {
          entity,
          targetX,
          targetY,
          nextStamina,
          nextStep,
          result,
        } =
          activeBattle;

        if (
          result.won
        ) {
          const scoreAfter =
            runScore +
            result.monster
              .score;

          setPlayerHp(
            result.playerHp
          );

          setRunLoot(
            (current) =>
              mergeRunLoot(
                current,
                result.drops
              )
          );

          setDropReveal(
            result.drops ??
              []
          );

          setRunScore(
            scoreAfter
          );

          setMonstersDefeated(
            (
              current
            ) =>
              current +
              1
          );

          setEntities(
            (
              current
            ) =>
              current.filter(
                (
                  item
                ) =>
                  item.id !==
                  entity.id
              )
          );

          setPosX(
            targetX
          );

          setPosY(
            targetY
          );

          addLog(
            `⚔️ ${result.monster.name} DEFEATED +${result.monster.score} SCORE`
          );

          /*
            STEP 2.8: resolve_combat() already computed this win and
            recorded the server-side MONSTER_DEFEATED event
            atomically -- calling the event API again here would
            double-count the kill. No separate call needed.
          */
          addLog(
            "SERVER: COMBAT + MONSTER_DEFEATED RECORDED ✓"
          );

          if (
            nextStamina <=
            0
          ) {
            addLog(
              "🏕️ Stamina depleted."
            );

            void finalizeExpedition(
              "STAMINA_OUT"
            );
          }
        } else {
          setPlayerHp(
            0
          );

          addLog(
            `💀 DEFEATED BY ${result.monster.name}`
          );

          void finalizeExpedition(
            "DEFEATED"
          );
        }

        setActiveBattle(
          null
        );

        movementLock.current =
          false;
      },
      [
        activeBattle,
        addLog,
        finalizeExpedition,
        liveSession,
        runScore,
      ]
    );

  // =====================================================
  // MOVE HERO
  // =====================================================

  const moveHero =
    useCallback(
      async (
        dx:
          number,

        dy:
          number
      ) => {
        if (
          movementLock.current ||
          gameStatus !==
            "PLAYING" ||
          treasurePopup ||
          activeBattle
        ) {
          return;
        }

        if (
          !liveSession
        ) {
          addLog(
            "⚠ MOVE SKIPPED: NO LIVE SESSION"
          );

          return;
        }

        if (
          stamina <
          MOVE_COST
        ) {
          void finalizeExpedition(
            "STAMINA_OUT"
          );

          return;
        }

        const direction:
          | "UP"
          | "DOWN"
          | "LEFT"
          | "RIGHT" =
          dx >
          0
            ? "RIGHT"
            : dx <
              0
            ? "LEFT"
            : dy <
              0
            ? "UP"
            : "DOWN";

        setHeroDirection(
          direction
        );

        movementLock.current =
          true;

        playMovementAnimation();

        /*
          AUTHORITATIVE MOVEMENT (STEP 2.6)

          The server is the sole authority on whether this move is
          legal and where it lands. This client never sets
          posX/posY from its own arithmetic -- only from the
          server's response. No optimistic movement: the player's
          sprite does not move until the server confirms it.
        */
        let moveResult;

        try {
          moveResult =
            await moveGameSession(
              liveSession.id,
              direction
            );
        } catch (
          error
        ) {
          console.error(
            "MOVE HERO ERROR:",
            error
          );

          addLog(
            error instanceof
            GameSessionError
              ? `⚠ MOVE FAILED: ${error.code}`
              : "⚠ MOVE FAILED"
          );

          movementLock.current =
            false;

          return;
        }

        setSessionState(
          moveResult.state
        );

        if (
          moveResult.blocked
        ) {
          addLog(
            moveResult.blockReason ===
            "WALL"
              ? "▦ BLOCKED BY WALL"
              : moveResult.blockReason ===
                "MAP_EDGE"
              ? "⛔ MAP EDGE"
              : "⛔ MOVE BLOCKED"
          );

          movementLock.current =
            false;

          return;
        }

        const targetX =
          moveResult.state
            .current_x;

        const targetY =
          moveResult.state
            .current_y;

        const nextStamina =
          stamina -
          MOVE_COST;

        const nextStep =
          stepCount +
          1;

        setStamina(
          nextStamina
        );

        setStepCount(
          nextStep
        );

        /*
          AUTHORITATIVE ENCOUNTER + COMBAT (STEP 2.7 + 2.8)

          moveResult.encounter comes from resolve_game_move()'s own
          response -- only non-null when the server itself just
          activated a real, server-owned encounter on this tile.

          The fight itself is now resolved by the server too
          (resolve_combat): Player ATK/DEF/HP, Monster stats, damage,
          and the win/loss outcome are all server-computed. This
          call returns the exact round-by-round shape CombatScene
          already animates -- only the data source changed.
        */
        if (
          moveResult.encounter
        ) {
          const encounter =
            moveResult.encounter;

          setResolvingCombat(
            true
          );

          try {
            const result =
              await resolveCombat(
                liveSession.id,
                encounter.id
              );

            setRunCoinEarned(
              (prev) =>
                prev +
                result.coinEarned
            );

            setCoinBalance(
              result.coinBalance
            );

            setCombatEnterGlitch(
              true
            );

            setActiveBattle({
              entity: {
                id: `ENCOUNTER-${encounter.id}`,

                x:
                  encounter.x,

                y:
                  encounter.y,

                type:
                  "MONSTER",

                tier:
                  encounter.tier,

                encounterId:
                  encounter.id,
              },

              targetX,

              targetY,

              nextStamina,

              nextStep,

              result,
            });
          } catch (
            error
          ) {
            console.error(
              "RESOLVE COMBAT ERROR:",
              error
            );

            addLog(
              error instanceof
              GameSessionError
                ? `⚠ COMBAT FAILED: ${error.code}`
                : "⚠ COMBAT FAILED"
            );

            movementLock.current =
              false;
          } finally {
            setResolvingCombat(
              false
            );
          }

          return;
        }

        const entity =
          entities.find(
            (
              current
            ) =>
              current.type ===
                "TREASURE" &&
              current.x ===
                targetX &&
              current.y ===
                targetY
          );

        if (
          entity?.type ===
          "TREASURE"
        ) {
          const gain =
            Math.floor(
              Math.random() *
                71
            ) +
            50;

          const scoreAfter =
            runScore +
            gain;

          setRunScore(
            scoreAfter
          );

          setEntities(
            (
              current
            ) =>
              current.filter(
                (
                  item
                ) =>
                  item.id !==
                  entity.id
              )
          );

          setPosX(
            targetX
          );

          setPosY(
            targetY
          );

          setTreasurePopup({
            title:
              "DATA CACHE FOUND",

            sub:
              `+${gain} RUN SCORE`,

            gain,
          });

          addLog(
            `🧰 DATA CACHE +${gain} SCORE`
          );

          void recordTreasureEvent(
            liveSession.id,
            gain,
            targetX,
            targetY,
            nextStep,
            scoreAfter
          );

          movementLock.current =
            false;

          if (
            nextStamina <=
            0
          ) {
            void finalizeExpedition(
              "STAMINA_OUT"
            );
          }

          return;
        }

        setPosX(
          targetX
        );

        setPosY(
          targetY
        );

        if (
          moveResult.state
            .exit_reached
        ) {
          addLog(
            "🏁 EXIT FOUND!"
          );

          void finalizeExpedition(
            "COMPLETE"
          );
        } else if (
          nextStamina <=
          0
        ) {
          addLog(
            "🏕️ STAMINA EMPTY"
          );

          void finalizeExpedition(
            "STAMINA_OUT"
          );
        }

        movementLock.current =
          false;
      },
      [
        activeBattle,
        activeStats,
        addLog,
        entities,
        finalizeExpedition,
        gameStatus,
        liveSession,
        playMovementAnimation,
        playerHp,
        recordTreasureEvent,
        runScore,
        stamina,
        stepCount,
        treasurePopup,
      ]
    );

  // =====================================================
  // KEYBOARD
  // =====================================================

  useEffect(() => {
    function keyDown(
      event:
        KeyboardEvent
    ) {
      if (
        event.repeat
      ) {
        return;
      }

      const key =
        event.key
          .toLowerCase();

      if (
        key ===
          "arrowup" ||
        key ===
          "w"
      ) {
        event.preventDefault();

        moveHero(
          0,
          -1
        );

        return;
      }

      if (
        key ===
          "arrowdown" ||
        key ===
          "s"
      ) {
        event.preventDefault();

        moveHero(
          0,
          1
        );

        return;
      }

      if (
        key ===
          "arrowleft" ||
        key ===
          "a"
      ) {
        event.preventDefault();

        moveHero(
          -1,
          0
        );

        return;
      }

      if (
        key ===
          "arrowright" ||
        key ===
          "d"
      ) {
        event.preventDefault();

        moveHero(
          1,
          0
        );
      }
    }

    window.addEventListener(
      "keydown",
      keyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        keyDown
      );
    };
  }, [
    moveHero,
  ]);

  // =====================================================
  // GAME SECTION GATE (temporary, Phase 2 -- see lib/game-access.ts)
  // =====================================================

  if (
    !gameAccessChecked
  ) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="flex min-h-[80vh] items-center justify-center text-sm font-black tracking-[0.25em] text-cyan-400">
          LOADING GAME...
        </div>

      </main>
    );
  }

  if (
    !gameAccessAllowed
  ) {
    return (
      <GameComingSoonScreen />
    );
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="flex min-h-[80vh] items-center justify-center text-sm font-black tracking-[0.25em] text-cyan-400">
          LOADING GAME...
        </div>

      </main>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-black text-white">

      <Navbar />

      <div className="mx-auto max-w-[1400px] px-5 pb-12 pt-7 sm:px-6">

        <div className="flex flex-wrap items-end justify-between gap-4">

          <div>

            <p className="text-[8px] font-black tracking-[0.3em] text-purple-400">
              LOOTFORM GAME // REAL SESSION
            </p>

            <h1 className="mt-2 text-4xl font-black sm:text-5xl">

              GRID{" "}

              <span className="text-cyan-400">
                EXPEDITION
              </span>

            </h1>

            <p className="mt-2 text-[8px] text-zinc-600">
              EXPLORE // FIGHT // LOOT // FIND THE EXIT
            </p>

          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/game"
              )
            }
            className="rounded-xl border border-zinc-800 px-4 py-3 text-[9px] font-black text-zinc-400 transition hover:border-cyan-400 hover:text-cyan-400"
          >
            ← GAME HUB
          </button>

        </div>

        <div
          className={`${pixelFont.className} mt-4 flex flex-wrap items-center gap-2`}
        >

          <span className="rounded-[2px] border-2 border-cyan-400/40 bg-cyan-400/[0.08] px-3 py-2 text-[8px] leading-none text-cyan-300 shadow-[2px_2px_0_rgba(34,211,238,0.15)]">
            LV.
            {playerLevel !==
            null
              ? String(
                  playerLevel
                ).padStart(
                  2,
                  "0"
                )
              : "--"}
          </span>

          <span className="rounded-[2px] border-2 border-purple-400/40 bg-purple-400/[0.08] px-3 py-2 text-[8px] leading-none text-purple-300 shadow-[2px_2px_0_rgba(168,85,247,0.15)]">
            {STAGE_1_1.stageLabel}
          </span>

          <span className="rounded-[2px] border-2 border-yellow-400/40 bg-yellow-400/[0.08] px-3 py-2 text-[8px] leading-none text-yellow-400 shadow-[2px_2px_0_rgba(250,204,21,0.15)]">
            COIN{" "}
            {coinBalance ??
              0}
          </span>

        </div>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/[0.04] p-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {sessionError && (
          <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/[0.04] p-4">

            <p className="text-[7px] font-black tracking-[0.2em] text-red-400">
              GAME SESSION / EVENT ERROR
            </p>

            <p className="mt-2 font-mono text-[9px] text-zinc-300">
              {sessionError}
            </p>

          </div>
        )}

        <section
          className={
            liveSession
              ? "mt-5 rounded-xl border border-lime-400/20 bg-lime-400/[0.03] px-4 py-3"
              : "mt-5 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
          }
        >

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>

              <p className="text-[6px] font-black tracking-[0.2em] text-zinc-600">
                GAME SESSION
              </p>

              <p
                className={
                  liveSession
                    ? "mt-1 font-mono text-[9px] font-black text-cyan-400"
                    : "mt-1 font-mono text-[9px] font-black text-zinc-700"
                }
              >
                {liveSession
                  ? shortSessionId(
                      liveSession.id
                    )
                  : "NOT STARTED"}
              </p>

            </div>

            {liveSession ? (
              <div className="flex flex-wrap items-center gap-4">

                <div>

                  <p className="text-[5px] text-zinc-600">
                    VERSION
                  </p>

                  <p className="mt-1 text-[8px] font-black text-white">
                    {liveSession.gameVersion}
                  </p>

                </div>

                <div>

                  <p className="text-[5px] text-zinc-600">
                    ENGINE
                  </p>

                  <p className="mt-1 text-[8px] font-black text-white">
                    {liveSession.engine}
                  </p>

                </div>

                <span className="rounded-full border border-lime-400/30 bg-lime-400/[0.05] px-3 py-1.5 text-[7px] font-black text-lime-400">
                  ● SESSION LIVE
                </span>

              </div>
            ) : (
              <span className="rounded-full border border-zinc-800 px-3 py-1.5 text-[7px] font-black text-zinc-600">
                OFFLINE
              </span>
            )}

          </div>

        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">

          <div className="handheld-screen relative min-h-[680px] overflow-hidden rounded-[10px] border-4 border-cyan-400/25 bg-zinc-950 p-5">

            <div className="handheld-scanlines pointer-events-none absolute inset-0 z-[1]" />

            {gameStatus ===
              "PLAYING" &&
              showStageIntro && (
                <StageIntroOverlay
                  zoneId={
                    STAGE_1_1.zoneId
                  }
                  zoneName={
                    STAGE_1_1.zoneName
                  }
                  stageLabel={
                    STAGE_1_1.stageLabel
                  }
                  stageName={
                    STAGE_1_1.stageName
                  }
                  onDismiss={() =>
                    setShowStageIntro(
                      false
                    )
                  }
                />
              )}

            {activeBattle && (
              <CombatScene
                heroGrade={
                  heroGrade
                }
                heroStartHp={
                  playerHp
                }
                heroMaxHp={
                  activeStats.maxHp
                }
                heroAtk={
                  activeStats.atk
                }
                heroDef={
                  activeStats.def
                }
                monsterName={
                  activeBattle
                    .result
                    .monster
                    .name
                }
                monsterTier={
                  activeBattle
                    .entity
                    .tier
                }
                monsterMaxHp={
                  activeBattle
                    .result
                    .monster
                    .hp
                }
                monsterAtk={
                  activeBattle
                    .result
                    .monster
                    .atk
                }
                monsterDef={
                  activeBattle
                    .result
                    .monster
                    .def
                }
                rounds={
                  activeBattle
                    .result
                    .rounds
                }
                won={
                  activeBattle
                    .result
                    .won
                }
                onComplete={
                  finishBattle
                }
              />
            )}

            {combatEnterGlitch && (
              <div
                className="combat-glitch pointer-events-none absolute inset-0 z-[60]"
                onAnimationEnd={() =>
                  setCombatEnterGlitch(
                    false
                  )
                }
              >
                <div className="combat-glitch-scanlines absolute inset-0" />
                <div className="combat-glitch-slice-a absolute inset-x-0 top-[30%] h-[8%] bg-cyan-400/70 mix-blend-screen" />
                <div className="combat-glitch-slice-b absolute inset-x-0 top-[55%] h-[5%] bg-red-500/60 mix-blend-screen" />
                <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-black tracking-[0.4em] text-cyan-300">
                  ENGAGING
                </p>
              </div>
            )}

            {dropReveal !==
              null &&
              !activeBattle && (
                <div
                  className="drop-reveal absolute inset-0 z-[65] flex items-center justify-center bg-black/85 backdrop-blur-sm"
                  onClick={() =>
                    setDropReveal(
                      null
                    )
                  }
                >
                  <div className="w-full max-w-xs px-6 text-center">

                    {dropReveal.length ===
                    0 ? (
                      <>
                        <p className="text-[8px] font-black tracking-[0.3em] text-zinc-500">
                          CACHE SCAN
                        </p>

                        <p className="mt-3 text-sm font-black text-zinc-400">
                          NO MATERIAL FOUND
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[8px] font-black tracking-[0.3em] text-cyan-400">
                          DROP FOUND
                        </p>

                        <div className="mt-3 space-y-2">
                          {dropReveal.map(
                            (
                              drop,
                              index
                            ) => (
                              <div
                                key={`${drop.item_code}-${index}`}
                                className={`rounded-xl border px-4 py-3 ${rarityBorderClass(
                                  drop.rarity
                                )}`}
                              >
                                <p
                                  className={`text-[7px] font-black tracking-[0.25em] ${rarityTextClass(
                                    drop.rarity
                                  )}`}
                                >
                                  {drop.rarity}
                                </p>

                                <p className="mt-1 text-base font-black text-white">
                                  {drop.item_name.toUpperCase()}{" "}
                                  ×{drop.quantity}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </>
                    )}

                    <p className="mt-4 text-[6px] tracking-[0.2em] text-zinc-600">
                      UNEXTRACTED — RUN LOOT
                    </p>
                  </div>
                </div>
              )}

            {treasurePopup && (
              <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 backdrop-blur-sm">

                <div className="treasure-flash absolute inset-0" />

                <div className="pointer-events-none absolute inset-0">

                  <div className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/10 blur-[90px]" />

                  <div className="sparkle-1 absolute left-[25%] top-[32%] text-2xl">
                    ✦
                  </div>

                  <div className="sparkle-2 absolute right-[28%] top-[30%] text-xl">
                    ✦
                  </div>

                  <div className="sparkle-3 absolute bottom-[28%] left-[32%] text-lg">
                    ✦
                  </div>

                  <div className="sparkle-4 absolute bottom-[32%] right-[34%] text-2xl">
                    ✦
                  </div>

                </div>

                <div className="relative z-10 w-full max-w-[520px] px-6 text-center">

                  <p className="text-[8px] font-black tracking-[0.35em] text-yellow-300">
                    DATA CACHE ACCESSED
                  </p>

                  <div className="mt-5 flex justify-center">

                    <div className="treasure-chest-popup">

                      <TreasureChestIcon
                        size="lg"
                      />

                    </div>

                  </div>

                  <h2 className="mt-6 text-3xl font-black text-yellow-200 sm:text-4xl">
                    {treasurePopup.title}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-300">
                    Data recovered and added to your run score.
                  </p>

                  <div className="treasure-reward mt-6 inline-flex rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-6 py-4">

                    <div className="text-center">

                      <p className="text-[8px] font-black tracking-[0.25em] text-yellow-300">
                        BONUS SCORE
                      </p>

                      <p className="mt-2 text-3xl font-black text-white">
                        +{treasurePopup.gain}
                      </p>

                    </div>

                  </div>

                  <div className="mt-8">

                    <button
                      type="button"
                      onClick={() =>
                        setTreasurePopup(
                          null
                        )
                      }
                      className="rounded-xl bg-yellow-300 px-8 py-3 text-[10px] font-black text-black transition hover:bg-yellow-200"
                    >
                      CONTINUE EXPEDITION
                    </button>

                  </div>

                </div>

              </div>
            )}

            {gameStatus ===
              "READY" &&
              !activeBattle && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 p-6 backdrop-blur">

                  <div className="w-full max-w-md text-center">

                    <div className="flex justify-center">

                      <LootformHeroSprite
                        size={
                          115
                        }
                        grade={
                          heroGrade
                        }
                      />

                    </div>

                    <p className="mt-5 text-[8px] font-black tracking-[0.26em] text-purple-400">
                      SERVER CONNECTED EXPEDITION
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      GRID EXPEDITION
                    </h2>

                    <p className="mt-3 text-[8px] leading-5 text-zinc-600">
                      LOOTFORM creates a Game Session and records GAME_START before the map begins.
                    </p>

                    {sessionError && (
                      <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-3">

                        <p className="text-[8px] text-red-400">
                          {sessionError}
                        </p>

                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        void startExpedition();
                      }}
                      disabled={
                        startingSession
                      }
                      className="mt-7 rounded-xl bg-cyan-400 px-8 py-4 text-xs font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {startingSession
                        ? "CREATING SESSION + EVENT..."
                        : "▶ START EXPEDITION"}
                    </button>

                  </div>

                </div>
              )}

            {gameStatus ===
              "FINALIZING" && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 p-6 backdrop-blur">

                  <div className="text-center">

                    <p className="animate-pulse text-[9px] font-black tracking-[0.3em] text-cyan-400">
                      FINALIZING EXPEDITION...
                    </p>

                    <p className="mt-2 text-[8px] text-zinc-600">
                      Recording your result with the server.
                    </p>

                  </div>

                </div>
              )}

            {resolvingCombat &&
              !activeBattle && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 p-6 backdrop-blur">

                  <div className="text-center">

                    <p className="animate-pulse text-[9px] font-black tracking-[0.3em] text-red-400">
                      RESOLVING COMBAT...
                    </p>

                    <p className="mt-2 text-[8px] text-zinc-600">
                      Server is computing this fight.
                    </p>

                  </div>

                </div>
              )}

            {(
              gameStatus ===
                "COMPLETE" ||
              gameStatus ===
                "DEFEATED" ||
              gameStatus ===
                "STAMINA_OUT"
            ) &&
              !activeBattle &&
              !treasurePopup && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 p-6 backdrop-blur overflow-y-auto">

                  <div className="w-full max-w-md py-8 text-center">

                    <p
                      className={`${pixelFont.className} text-[7px] leading-[1.8] text-zinc-600`}
                    >
                      LOOTFORM
                    </p>

                    <p
                      className={
                        gameStatus ===
                        "COMPLETE"
                          ? `${pixelFont.className} mt-3 text-[10px] leading-[1.8] text-lime-400`
                          : `${pixelFont.className} mt-3 text-[10px] leading-[1.8] text-red-400`
                      }
                    >
                      {gameStatus ===
                      "COMPLETE"
                        ? "EXTRACTION SUCCESS"
                        : "EXTRACTION FAILED"}
                    </p>

                    <h2
                      className={`${pixelFont.className} mt-4 text-xl leading-[1.6] text-white`}
                    >

                      {gameStatus ===
                      "COMPLETE"
                        ? "MISSION COMPLETE"
                        : gameStatus ===
                          "DEFEATED"
                        ? "HERO DEFEATED"
                        : "STAMINA EMPTY"}

                    </h2>

                    {finalizeError && (
                      <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/[0.05] p-3">

                        <p className="text-[7px] font-black tracking-[0.15em] text-red-400">
                          RESULT NOT CONFIRMED
                        </p>

                        <p className="mt-1 text-[8px] text-zinc-500">
                          {finalizeError} -- showing local estimate only.
                        </p>

                      </div>
                    )}

                    <div className="mt-6 grid grid-cols-2 gap-3">

                      <ResultBox
                        label="SCORE"
                        value={(
                          gameResult?.score ??
                          runScore
                        ).toLocaleString()}
                      />

                      <ResultBox
                        label="TIME"
                        value={formatDuration(
                          gameResult?.duration_seconds ??
                            null
                        )}
                      />

                      <ResultBox
                        label="EXPLORED"
                        value={
                          gameResult?.explored_percent !=
                          null
                            ? `${gameResult.explored_percent}%`
                            : "-"
                        }
                      />

                      <ResultBox
                        label="MONSTERS"
                        value={
                          gameResult?.monsters_killed ??
                          monstersDefeated
                        }
                      />

                      <ResultBox
                        label="ELITES"
                        value={
                          gameResult?.elites_killed ??
                          0
                        }
                      />

                      <ResultBox
                        label="LOOT FOUND"
                        value={
                          gameResult?.loot_collected ??
                          0
                        }
                      />

                      <ResultBox
                        label="GAME COIN"
                        value={`+${runCoinEarned}`}
                      />

                    </div>

                    {coinBalance !==
                      null && (
                      <p className="mt-3 text-[7px] tracking-[0.15em] text-zinc-500">
                        GAME COIN BALANCE:{" "}
                        <span className="text-yellow-400">
                          {coinBalance.toLocaleString()}
                        </span>
                      </p>
                    )}

                    {playerLevel !==
                      null && (
                      <p className="mt-1 text-[7px] tracking-[0.15em] text-zinc-500">
                        PLAYER LV:{" "}
                        <span className="text-cyan-400">
                          {playerLevel}
                        </span>
                      </p>
                    )}

                    {extractionSettlement && (
                      <div
                        className={`mt-5 rounded-2xl border p-4 text-left ${
                          extractionSettlement.status ===
                          "EXTRACTED"
                            ? "border-lime-400/25 bg-lime-400/[0.04]"
                            : "border-red-400/25 bg-red-400/[0.04]"
                        }`}
                      >
                        <p
                          className={`text-[7px] font-black tracking-[0.25em] ${
                            extractionSettlement.status ===
                            "EXTRACTED"
                              ? "text-lime-400"
                              : "text-red-400"
                          }`}
                        >
                          {extractionSettlement.status ===
                          "EXTRACTED"
                            ? `${extractionSettlement.items.length} ITEMS SECURED`
                            : "UNSECURED MATERIAL LOST"}
                        </p>

                        {extractionSettlement.items
                          .length ===
                        0 ? (
                          <p className="mt-2 text-[8px] text-zinc-600">
                            No materials were carried this run.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {extractionSettlement.items.map(
                              (
                                item,
                                index
                              ) => (
                                <div
                                  key={`${item.item_code}-${index}`}
                                  className="flex items-center justify-between"
                                >
                                  <span
                                    className={`text-[7px] font-black tracking-[0.15em] ${rarityTextClass(
                                      item.rarity
                                    )}`}
                                  >
                                    {item.rarity}
                                  </span>

                                  <span className="text-[9px] font-black text-white">
                                    {item.item_name.toUpperCase()}{" "}
                                    ×{item.quantity}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {gameStatus !==
                      "COMPLETE" && (
                      <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.04] p-3 text-left">

                        <p className="text-[6px] text-red-400 tracking-[0.15em]">
                          CAUSE
                        </p>

                        <p className="mt-1 text-[9px] font-black text-white">
                          {gameResult
                            ?.fail_reason ===
                          "STAMINA_DEPLETED"
                            ? "STAMINA DEPLETED"
                            : "PLAYER HP DEPLETED"}
                        </p>

                      </div>
                    )}

                    {equipment.TOP
                      ?.item && (
                      <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-400/[0.04] p-4 text-left">

                        <p className="text-[6px] text-purple-400 tracking-[0.15em]">
                          SHIRT
                        </p>

                        <p className="mt-1 text-sm font-black text-white">
                          {getItemName(
                            equipment.TOP.item
                          )}{" "}
                          //{" "}
                          {equipment.TOP
                            .item.grade}
                        </p>

                        <div className="mt-3 flex items-center justify-between">

                          <div>
                            <p className="text-[6px] text-zinc-600">
                              POWER
                            </p>
                            <p className="text-lg font-black text-lime-400">
                              {sessionStats?.power ??
                                "-"}
                            </p>
                          </div>

                          {sessionStats?.abilityCode && (
                            <div className="text-right">
                              <p className="text-[6px] text-zinc-600">
                                ABILITY
                              </p>
                              <p className="text-sm font-black text-purple-400">
                                {sessionStats.abilityCode}
                              </p>
                            </div>
                          )}

                        </div>

                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-zinc-800 bg-black/40 p-3">

                      <p className="text-[7px] font-black tracking-[0.15em] text-zinc-600">
                        REWARD CALCULATION
                      </p>

                      <p className="mt-1 text-[9px] font-black text-zinc-500">
                        COMING NEXT
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setGameStatus(
                          "READY"
                        );
                      }}
                      className="mt-7 rounded-xl bg-white px-9 py-3 text-[10px] font-black text-black transition hover:bg-zinc-200"
                    >
                      CONTINUE
                    </button>

                  </div>

                </div>
              )}

            <div className="flex items-center justify-between gap-4">

              <div>

                <p className="text-[7px] tracking-[0.15em] text-purple-400">
                  {STAGE_1_1.zoneId} // {STAGE_1_1.zoneName}
                </p>

                <p className="mt-1 text-sm font-black text-cyan-300">
                  {STAGE_1_1.stageLabel} — {STAGE_1_1.stageName}
                </p>

              </div>

              <div className="flex gap-2">

                <MiniStatus
                  label="STEP"
                  value={
                    stepCount
                  }
                />

                <MiniStatus
                  label="SCORE"
                  value={
                    runScore
                  }
                />

                <MiniStatus
                  label="RUN LOOT"
                  value={`${runLoot.reduce(
                    (
                      sum,
                      entry
                    ) =>
                      sum +
                      entry.quantity,
                    0
                  )} UNEXTRACTED`}
                />

              </div>

            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">

              <MiniStatus
                label="HP"
                value={`${playerHp}/${activeStats.maxHp}`}
              />

              <MiniStatus
                label="POWER"
                value={
                  activeStats.power
                }
              />

              <MiniStatus
                label="COIN"
                value={
                  coinBalance ??
                  0
                }
              />

              <MiniStatus
                label="ABILITY"
                value={
                  sessionStats?.abilityCode ??
                  "—"
                }
              />

            </div>

            <div className="relative mt-5 flex min-h-[320px] items-start justify-center overflow-auto rounded-2xl border border-zinc-900 bg-black/50 p-2 sm:min-h-[500px] sm:p-5">

              <div className="stage-vignette pointer-events-none absolute inset-0 rounded-2xl" />

              <div
                className="stage-camera grid w-max gap-[3px]"
                style={{
                  gridTemplateColumns:
                    `repeat(${cameraViewSize}, clamp(18px, 6.2vw, 46px))`,
                }}
              >

                {Array.from({
                  length:
                    cameraViewSize *
                    cameraViewSize,
                }).map(
                  (
                    _,
                    index
                  ) => {
                    const tileX =
                      cameraMinX +
                      (index %
                        cameraViewSize);

                    const tileY =
                      cameraMinY +
                      Math.floor(
                        index /
                          cameraViewSize
                      );

                    const key =
                      tileKey(
                        tileX,
                        tileY
                      );

                    const visible =
                      visibleTiles.has(
                        key
                      );

                    const explored =
                      exploredTiles.has(
                        key
                      );

                    const wall =
                      isWall(
                        tileX,
                        tileY
                      );

                    const hero =
                      posX ===
                        tileX &&
                      posY ===
                        tileY;

                    const exit =
                      tileX ===
                        EXIT_X &&
                      tileY ===
                        EXIT_Y;

                    const entity =
                      entities.find(
                        (
                          current
                        ) =>
                          current.x ===
                            tileX &&
                          current.y ===
                            tileY
                      );

                    const prop =
                      wall
                        ? floorPropAt(
                            tileX,
                            tileY
                          )
                        : null;

                    let tileStyle =
                      "border-black bg-black";

                    if (
                      explored &&
                      !visible
                    ) {
                      tileStyle =
                        wall
                          ? "tile-wall-dim border-zinc-950"
                          : "tile-floor-dim border-zinc-900";
                    }

                    if (
                      visible
                    ) {
                      tileStyle =
                        wall
                          ? "tile-wall border-zinc-600"
                          : "tile-floor border-zinc-800";
                    }

                    return (
                      <div
                        key={
                          key
                        }
                        className={`relative flex aspect-square items-center justify-center overflow-visible rounded-[1px] border-2 transition-colors duration-150 ${tileStyle}`}
                      >

                        {visible &&
                          wall && (
                            <span className="text-[10px] text-zinc-500">
                              {prop ===
                              "PIPE"
                                ? "┃"
                                : prop ===
                                  "VENT"
                                ? "▤"
                                : prop ===
                                  "CRATE"
                                ? "▧"
                                : prop ===
                                  "NEON_SIGN"
                                ? "◈"
                                : prop ===
                                  "PANEL"
                                ? "▥"
                                : "▦"}
                            </span>
                          )}

                        {explored &&
                          exit &&
                          !wall && (
                            <div className="relative z-10 flex items-center justify-center">

                              {visible && (
                                <div className="extraction-gate-ring absolute h-8 w-8 rounded-full border border-lime-400/70" />
                              )}

                              <span
                                className={
                                  visible
                                    ? "relative text-2xl font-black text-lime-400 drop-shadow-[0_0_10px_rgba(163,230,53,1)]"
                                    : "relative text-2xl font-black text-zinc-700"
                                }
                              >
                                ◇
                              </span>

                            </div>
                          )}

                        {visible &&
                          entity?.type ===
                            "TREASURE" &&
                          !hero && (
                            <div className="loot-float relative z-20">

                              <TreasureChestIcon
                                size="sm"
                              />

                            </div>
                          )}

                        {visible &&
                          entity?.type ===
                            "MONSTER" &&
                          !hero && (
                            <div className="relative z-20 flex items-center justify-center">

                              <div
                                className={
                                  entity.tier ===
                                  "ELITE"
                                    ? "absolute h-9 w-9 rounded-full bg-red-500/40 blur-[8px]"
                                    : entity.tier ===
                                      "GUARD"
                                    ? "absolute h-9 w-9 rounded-full bg-orange-400/35 blur-[8px]"
                                    : "absolute h-9 w-9 rounded-full bg-purple-500/35 blur-[8px]"
                                }
                              />

                              <span
                                className={
                                  entity.tier ===
                                  "ELITE"
                                    ? "monster-float relative z-10 select-none text-[32px] drop-shadow-[0_0_12px_rgba(239,68,68,1)]"
                                    : "monster-float relative z-10 select-none text-[32px] drop-shadow-[0_0_10px_rgba(168,85,247,1)]"
                                }
                              >
                                {entity.tier ===
                                "ELITE"
                                  ? "👹"
                                  : "👾"}
                              </span>

                            </div>
                          )}

                        {hero && (
                          <div className="absolute z-30 flex items-center justify-center">

                            <LootformHeroSprite
                              size={
                                50
                              }
                              grade={
                                heroGrade
                              }
                              direction={
                                heroDirection
                              }
                              moving={
                                heroMoving
                              }
                            />

                          </div>
                        )}

                      </div>
                    );
                  }
                )}

              </div>

            </div>

            <div
              className={`${pixelFont.className} mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[6px] leading-[1.8] text-zinc-600`}
            >

              <span>
                HERO
              </span>

              <span>
                CACHE
              </span>

              <span>
                👾 MONSTER
              </span>

              <span>
                👹 ELITE
              </span>

              <span>
                ◇ EXTRACTION GATE
              </span>

              <span>
                ▦ WALL
              </span>

            </div>

            <div className="mt-6 flex items-center justify-center">

              <MobileDpad
                onMove={
                  moveHero
                }
                disabled={
                  gameStatus !==
                    "PLAYING" ||
                  Boolean(
                    activeBattle
                  ) ||
                  Boolean(
                    treasurePopup
                  )
                }
              />

            </div>

          </div>

          <aside>

            <button
              type="button"
              onClick={() =>
                setBuildPanelOpen(
                  (
                    current
                  ) =>
                    !current
                )
              }
              className={`${pixelFont.className} flex w-full items-center justify-between rounded-[2px] border-2 border-zinc-800 bg-zinc-950 px-4 py-3 text-[8px] leading-none text-zinc-300 xl:hidden`}
            >
              <span>
                BUILD // RUN LOOT
              </span>

              <span className="text-cyan-400">
                {buildPanelOpen
                  ? "▲"
                  : "▼"}
              </span>
            </button>

            <div
              className={`${
                buildPanelOpen
                  ? "block"
                  : "hidden"
              } mt-3 space-y-4 xl:mt-0 xl:block`}
            >

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-5">

              <p className="text-[8px] font-black tracking-[0.25em] text-cyan-400">
                HERO STATS
              </p>

              <div className="mt-3 flex items-center gap-4">

                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-cyan-400/20 bg-black">

                  <LootformHeroSprite
                    size={
                      65
                    }
                    grade={
                      heroGrade
                    }
                  />

                </div>

                <div>

                  <h2 className="text-xl font-black">
                    LOOT HERO
                  </h2>

                  <p className="mt-1 text-[7px] font-black tracking-[0.12em] text-lime-400">
                    EQUIPMENT POWER ACTIVE
                  </p>

                  <p className="mt-2 text-[7px] font-black text-orange-400">
                    {heroGrade}
                  </p>

                </div>

              </div>

              <div className="mt-6 space-y-4">

                <StatBar
                  label="STAMINA"
                  value={
                    stamina
                  }
                  max={
                    playerStats.maxStamina
                  }
                  barClassName="bg-cyan-400"
                />

                <StatBar
                  label="HP"
                  value={
                    playerHp
                  }
                  max={
                    activeStats.maxHp
                  }
                  barClassName="bg-red-400"
                />

              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">

                <StatBox
                  label="SIGHT"
                  value={`${activeStats.vision} TILES`}
                  valueClassName="text-purple-400"
                />

                <StatBox
                  label="POWER"
                  value={
                    activeStats.power
                  }
                  valueClassName="text-lime-400"
                />

                <StatBox
                  label="ATK"
                  value={
                    activeStats.atk
                  }
                  valueClassName="text-orange-400"
                />

                <StatBox
                  label="DEF"
                  value={
                    activeStats.def
                  }
                  valueClassName="text-cyan-400"
                />

              </div>

            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-5">

              <div className="flex items-center justify-between">

                <p className="text-[8px] font-black tracking-[0.25em] text-yellow-400">
                  RUN LOOT
                </p>

                <span className="rounded-full border border-yellow-400/30 bg-yellow-400/[0.06] px-2 py-0.5 text-[6px] font-black tracking-[0.15em] text-yellow-400">
                  UNEXTRACTED
                </span>

              </div>

              {runLoot.length ===
              0 ? (
                <p className="mt-3 text-[8px] text-zinc-600">
                  No materials found yet this run.
                </p>
              ) : (
                <div className="mt-3 space-y-1.5">
                  {runLoot.map(
                    (
                      entry
                    ) => (
                      <div
                        key={
                          entry.item_code
                        }
                        className="flex items-center justify-between text-[8px]"
                      >
                        <span
                          className={rarityTextClass(
                            entry.rarity
                          )}
                        >
                          {entry.item_name}
                        </span>

                        <span className="font-black text-white">
                          ×{entry.quantity}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-5">

              <p className="text-[8px] font-black tracking-[0.25em] text-purple-400">
                ACTIVE LOADOUT
              </p>

              <div className="mt-4 space-y-2">

                {(
                  [
                    "HEAD",
                    "TOP",
                    "BOTTOM",
                  ] as LoadoutSlot[]
                ).map(
                  (
                    slot
                  ) => {
                    const item =
                      equipment[
                        slot
                      ]?.item;

                    return (
                      <div
                        key={
                          slot
                        }
                        className="rounded-xl border border-zinc-800 bg-black p-3"
                      >

                        <p className="text-[6px] tracking-[0.15em] text-zinc-600">
                          {slot}
                        </p>

                        <div className="mt-1 flex items-center justify-between gap-3">

                          <p className="truncate text-[9px] font-black">
                            {getItemName(
                              item
                            )}
                          </p>

                          <p
                            className={
                              item?.grade ===
                              "LEGENDARY"
                                ? "text-[8px] font-black text-orange-400"
                                : item?.grade ===
                                  "EPIC"
                                ? "text-[8px] font-black text-purple-400"
                                : item?.grade ===
                                  "RARE"
                                ? "text-[8px] font-black text-cyan-400"
                                : "text-[8px] font-black text-zinc-400"
                            }
                          >
                            {item
                              ?.grade ??
                              "EMPTY"}
                          </p>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

              {sessionStats?.abilityCode && (
                <div className="mt-3 rounded-xl border border-purple-400/20 bg-purple-400/[0.05] px-3 py-2">

                  <p className="text-[6px] tracking-[0.15em] text-purple-400">
                    ABILITY LOADED
                  </p>

                  <p className="mt-1 text-[9px] font-black text-white">
                    {sessionStats.abilityCode}
                  </p>

                </div>
              )}

            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-5">

              <p className="text-[8px] font-black tracking-[0.22em] text-lime-400">
                GAME SESSION
              </p>

              {liveSession ? (
                <div className="mt-4">

                  <div className="rounded-xl border border-lime-400/20 bg-lime-400/[0.03] p-3">

                    <div className="flex items-center justify-between gap-3">

                      <p className="text-[6px] text-zinc-600">
                        STATUS
                      </p>

                      <span className="text-[7px] font-black text-lime-400">
                        ● ACTIVE
                      </span>

                    </div>

                    <p className="mt-3 break-all font-mono text-[8px] text-cyan-400">
                      {liveSession.id}
                    </p>

                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">

                    <SessionInfo
                      label="VERSION"
                      value={
                        liveSession.gameVersion
                      }
                    />

                    <SessionInfo
                      label="ENGINE"
                      value={
                        liveSession.engine
                      }
                    />

                  </div>

                  <div className="mt-2 rounded-xl border border-purple-400/15 bg-purple-400/[0.03] p-3">

                    <p className="text-[6px] text-zinc-600">
                      SERVER EVENTS
                    </p>

                    <p className="mt-1 text-[8px] font-black text-purple-400">
                      START + TREASURE + MONSTER CONNECTED
                    </p>

                  </div>

                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-3">

                  <p className="text-[8px] text-zinc-600">
                    Session will be created when the expedition starts.
                  </p>

                </div>
              )}

            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-5">

              <p className="text-[8px] font-black tracking-[0.2em] text-zinc-600">
                MOVEMENT
              </p>

              <div className="mx-auto mt-4 grid max-w-[210px] grid-cols-3 gap-2">

                <div />

                <MoveButton
                  label="↑"
                  onClick={() =>
                    moveHero(
                      0,
                      -1
                    )
                  }
                  disabled={
                    gameStatus !==
                      "PLAYING" ||
                    Boolean(
                      activeBattle
                    ) ||
                    Boolean(
                      treasurePopup
                    )
                  }
                />

                <div />

                <MoveButton
                  label="←"
                  onClick={() =>
                    moveHero(
                      -1,
                      0
                    )
                  }
                  disabled={
                    gameStatus !==
                      "PLAYING" ||
                    Boolean(
                      activeBattle
                    ) ||
                    Boolean(
                      treasurePopup
                    )
                  }
                />

                <MoveButton
                  label="↓"
                  onClick={() =>
                    moveHero(
                      0,
                      1
                    )
                  }
                  disabled={
                    gameStatus !==
                      "PLAYING" ||
                    Boolean(
                      activeBattle
                    ) ||
                    Boolean(
                      treasurePopup
                    )
                  }
                />

                <MoveButton
                  label="→"
                  onClick={() =>
                    moveHero(
                      1,
                      0
                    )
                  }
                  disabled={
                    gameStatus !==
                      "PLAYING" ||
                    Boolean(
                      activeBattle
                    ) ||
                    Boolean(
                      treasurePopup
                    )
                  }
                />

              </div>

              <p className="mt-4 text-center text-[7px] text-zinc-600">
                WASD / ARROW KEYS
              </p>

              <div className="mt-3 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.03] px-3 py-2 text-center">

                <p className="text-[6px] text-zinc-600">
                  HERO FACING
                </p>

                <p className="mt-1 text-[8px] font-black text-cyan-400">
                  {heroDirection}
                </p>

              </div>

            </section>

            <section className="h-[190px] overflow-y-auto rounded-[20px] border border-zinc-800 bg-black p-4">

              <p className="mb-3 text-[7px] font-black tracking-[0.2em] text-zinc-700">
                EXPEDITION LOG
              </p>

              {log.map(
                (
                  line,
                  index
                ) => (
                  <p
                    key={
                      `${index}-${line}`
                    }
                    className="mb-1 break-words text-[7px] leading-4 text-zinc-500"
                  >
                    &gt; {line}
                  </p>
                )
              )}

            </section>

            </div>

          </aside>

        </section>

        <section className="mt-5 rounded-xl border border-orange-400/15 bg-orange-400/[0.03] p-4">

          <p className="text-[7px] font-black tracking-[0.2em] text-orange-400">
            LOOTFORM GAME SECURITY
          </p>

          <p className="mt-2 text-[8px] leading-5 text-zinc-600">
            GAME_START, TREASURE_FOUND and MONSTER_DEFEATED are recorded as server gameplay telemetry. Run Score is still a prototype value. This browser cannot directly grant EXP, LT, Items, Wallet Balance, Collection Score or Global Rank.
          </p>

        </section>

      </div>

      <style jsx global>{`

        .loot-float {
          animation:
            lootChestFloat
            1.25s
            ease-in-out
            infinite;
        }

        .monster-float {
          animation:
            monsterFloat
            1.1s
            ease-in-out
            infinite;
        }

        .extraction-gate-ring {
          animation:
            extractionGatePulse
            1.6s
            ease-in-out
            infinite;
        }

        @keyframes extractionGatePulse {
          0%, 100% {
            transform: scale(0.85);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.25);
            opacity: 0.25;
          }
        }

        .drop-reveal {
          animation:
            dropRevealFade
            250ms
            ease-out
            1;
        }

        @keyframes dropRevealFade {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .handheld-screen {
          box-shadow:
            0 0 0 2px rgba(0, 0, 0, 0.6),
            0 0 40px rgba(34, 211, 238, 0.08);
        }

        .handheld-scanlines {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.12) 0px,
              rgba(0, 0, 0, 0.12) 1px,
              transparent 1px,
              transparent 3px
            );

          mix-blend-mode: multiply;
          opacity: 0.5;
        }

        .tile-floor {
          background-color: #18181b;
          background-image:
            repeating-linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.025) 0px,
              rgba(255, 255, 255, 0.025) 2px,
              transparent 2px,
              transparent 10px
            );
        }

        .tile-floor-dim {
          background-color: #09090b;
          background-image:
            repeating-linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.012) 0px,
              rgba(255, 255, 255, 0.012) 2px,
              transparent 2px,
              transparent 10px
            );
        }

        .tile-wall {
          background-color: #3f3f46;
          background-image:
            linear-gradient(
              180deg,
              rgba(0, 0, 0, 0.35) 0%,
              rgba(0, 0, 0, 0) 40%
            ),
            repeating-linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.25) 0px,
              rgba(0, 0, 0, 0.25) 1px,
              transparent 1px,
              transparent 8px
            );
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
        }

        .tile-wall-dim {
          background-color: #18181b;
          background-image:
            linear-gradient(
              180deg,
              rgba(0, 0, 0, 0.35) 0%,
              rgba(0, 0, 0, 0) 40%
            );
        }

        .stage-vignette {
          box-shadow:
            inset 0 0 60px rgba(0, 0, 0, 0.85),
            inset 0 0 18px rgba(34, 211, 238, 0.12);
        }

        .combat-glitch {
          animation:
            combatGlitchFade
            450ms
            ease-out
            1;
        }

        .combat-glitch-scanlines {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(34, 211, 238, 0.1) 0px,
              rgba(34, 211, 238, 0.1) 1px,
              transparent 2px,
              transparent 4px
            );

          animation:
            combatGlitchNoise
            450ms
            steps(6)
            1;
        }

        .combat-glitch-slice-a {
          animation:
            combatGlitchSliceA
            450ms
            steps(4)
            1;
        }

        .combat-glitch-slice-b {
          animation:
            combatGlitchSliceB
            450ms
            steps(4)
            1;
        }

        @keyframes combatGlitchFade {
          0% {
            opacity: 1;
            background: #000;
          }
          55% {
            opacity: 1;
            background: transparent;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes combatGlitchNoise {
          0%, 100% {
            transform: translateX(0);
            opacity: 0.9;
          }
          20% {
            transform: translateX(-6px);
          }
          40% {
            transform: translateX(5px);
          }
          60% {
            transform: translateX(-3px);
          }
          80% {
            transform: translateX(2px);
            opacity: 0.4;
          }
        }

        @keyframes combatGlitchSliceA {
          0% {
            transform: translateX(-50px);
            opacity: 1;
          }
          100% {
            transform: translateX(50px);
            opacity: 0;
          }
        }

        @keyframes combatGlitchSliceB {
          0% {
            transform: translateX(40px);
            opacity: 1;
          }
          100% {
            transform: translateX(-40px);
            opacity: 0;
          }
        }

        .treasure-flash {
          background:
            radial-gradient(
              circle at center,
              rgba(250, 204, 21, 0.18) 0%,
              rgba(250, 204, 21, 0.06) 28%,
              rgba(0, 0, 0, 0) 62%
            );

          animation:
            treasureFlash
            850ms
            ease-out
            1;
        }

        .treasure-chest-popup {
          animation:
            chestPop
            700ms
            cubic-bezier(
              0.18,
              0.89,
              0.32,
              1.28
            )
            1,
            chestGlow
            1.4s
            ease-in-out
            infinite;
        }

        .treasure-reward {
          animation:
            rewardPulse
            1.1s
            ease-in-out
            infinite;
        }

        .sparkle-1,
        .sparkle-2,
        .sparkle-3,
        .sparkle-4 {
          color:
            rgba(
              253,
              224,
              71,
              0.95
            );

          text-shadow:
            0 0 14px
            rgba(
              253,
              224,
              71,
              0.9
            );
        }

        .sparkle-1 {
          animation:
            sparkleFloat1
            1.5s
            ease-in-out
            infinite;
        }

        .sparkle-2 {
          animation:
            sparkleFloat2
            1.9s
            ease-in-out
            infinite;
        }

        .sparkle-3 {
          animation:
            sparkleFloat3
            1.7s
            ease-in-out
            infinite;
        }

        .sparkle-4 {
          animation:
            sparkleFloat4
            2.1s
            ease-in-out
            infinite;
        }

        @keyframes lootChestFloat {

          0%,
          100% {
            transform:
              translateY(0)
              scale(1);
          }

          50% {
            transform:
              translateY(-4px)
              scale(1.03);
          }

        }

        @keyframes monsterFloat {

          0%,
          100% {
            transform:
              translateY(0);
          }

          50% {
            transform:
              translateY(-3px);
          }

        }

        @keyframes treasureFlash {

          0% {
            opacity:
              0;

            transform:
              scale(0.92);
          }

          30% {
            opacity:
              1;

            transform:
              scale(1);
          }

          100% {
            opacity:
              1;

            transform:
              scale(1.04);
          }

        }

        @keyframes chestPop {

          0% {
            opacity:
              0;

            transform:
              translateY(22px)
              scale(0.55)
              rotate(-6deg);
          }

          55% {
            opacity:
              1;

            transform:
              translateY(-10px)
              scale(1.08)
              rotate(2deg);
          }

          100% {
            opacity:
              1;

            transform:
              translateY(0)
              scale(1)
              rotate(0deg);
          }

        }

        @keyframes chestGlow {

          0%,
          100% {
            filter:
              drop-shadow(
                0 0 10px
                rgba(
                  250,
                  204,
                  21,
                  0.45
                )
              )
              drop-shadow(
                0 0 24px
                rgba(
                  249,
                  115,
                  22,
                  0.25
                )
              );
          }

          50% {
            filter:
              drop-shadow(
                0 0 18px
                rgba(
                  250,
                  204,
                  21,
                  0.9
                )
              )
              drop-shadow(
                0 0 32px
                rgba(
                  249,
                  115,
                  22,
                  0.45
                )
              );
          }

        }

        @keyframes rewardPulse {

          0%,
          100% {
            transform:
              scale(1);
          }

          50% {
            transform:
              scale(1.03);
          }

        }

        @keyframes sparkleFloat1 {

          0%,
          100% {
            transform:
              translateY(0)
              scale(1);

            opacity:
              0.55;
          }

          50% {
            transform:
              translateY(-8px)
              scale(1.18);

            opacity:
              1;
          }

        }

        @keyframes sparkleFloat2 {

          0%,
          100% {
            transform:
              translateY(0)
              scale(1);

            opacity:
              0.5;
          }

          50% {
            transform:
              translateY(-10px)
              scale(1.16);

            opacity:
              1;
          }

        }

        @keyframes sparkleFloat3 {

          0%,
          100% {
            transform:
              translateY(0)
              scale(1);

            opacity:
              0.45;
          }

          50% {
            transform:
              translateY(-7px)
              scale(1.14);

            opacity:
              1;
          }

        }

        @keyframes sparkleFloat4 {

          0%,
          100% {
            transform:
              translateY(0)
              scale(1);

            opacity:
              0.6;
          }

          50% {
            transform:
              translateY(-9px)
              scale(1.2);

            opacity:
              1;
          }

        }

      `}</style>

    </main>
  );
}

// =========================================================
// MOVE BUTTON
// =========================================================

function MoveButton({
  label,
  onClick,
  disabled,
}: {
  label:
    string;

  onClick:
    () => void;

  disabled:
    boolean;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-lg font-black text-white transition hover:border-cyan-400 hover:bg-cyan-400/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {label}
    </button>
  );
}

// =========================================================
// STAT BOX
// =========================================================

function StatBox({
  label,
  value,
  valueClassName =
    "text-cyan-400",
}: {
  label:
    string;

  value:
    string | number;

  valueClassName?:
    string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black p-3">

      <p className="text-[6px] tracking-[0.15em] text-zinc-600">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-black ${valueClassName}`}
      >
        {value}
      </p>

    </div>
  );
}

// =========================================================
// STAT BAR
// =========================================================

function StatBar({
  label,
  value,
  max,
  barClassName,
}: {
  label:
    string;

  value:
    number;

  max:
    number;

  barClassName:
    string;
}) {
  const percentage =
    Math.max(
      0,
      Math.min(
        100,
        max >
          0
          ? (
              value /
              max
            ) *
              100
          : 0
      )
    );

  return (
    <div>

      <div className="flex items-center justify-between text-[7px] font-black">

        <span className="text-zinc-600">
          {label}
        </span>

        <span>
          {value} / {max}
        </span>

      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-900">

        <div
          className={`h-full transition-all duration-300 ${barClassName}`}
          style={{
            width:
              `${percentage}%`,
          }}
        />

      </div>

    </div>
  );
}

// =========================================================
// DIRECTION PAD (STEP 4A)
//
// On-screen four-direction control for mobile (and usable on
// desktop too). Sends the exact same intent as a keyboard press --
// onMove is moveHero(dx, dy) itself, so the server remains the only
// authority on whether the move is valid.
// =========================================================

// =========================================================
// MINI STATUS
// =========================================================

function MiniStatus({
  label,
  value,
}: {
  label:
    string;

  value:
    string | number;
}) {
  return (
    <div className="rounded-[2px] border-2 border-zinc-800 bg-black px-3 py-2">

      <p
        className={`${pixelFont.className} text-[5px] leading-[1.6] text-zinc-500`}
      >
        {label}
      </p>

      <p
        className={`${pixelFont.className} mt-1.5 text-[9px] leading-none text-cyan-400`}
      >
        {value}
      </p>

    </div>
  );
}

// =========================================================
// RESULT BOX
// =========================================================

function ResultBox({
  label,
  value,
}: {
  label:
    string;

  value:
    string | number;
}) {
  return (
    <div className="rounded-[3px] border-2 border-zinc-800 bg-zinc-950 p-4 text-left">

      <p
        className={`${pixelFont.className} text-[6px] leading-[1.8] text-zinc-500`}
      >
        {label}
      </p>

      <p
        className={`${pixelFont.className} mt-2 text-base leading-tight text-white`}
      >
        {value}
      </p>

    </div>
  );
}

// =========================================================
// SESSION INFO
// =========================================================

function SessionInfo({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black p-3">

      <p className="text-[5px] text-zinc-600">
        {label}
      </p>

      <p className="mt-1 font-mono text-[8px] font-black text-white">
        {value}
      </p>

    </div>
  );
}

// =========================================================
// TREASURE CHEST
// =========================================================

function TreasureChestIcon({
  size =
    "sm",
}: {
  size?:
    | "sm"
    | "lg";
}) {
  const isLarge =
    size ===
    "lg";

  return (
    <div
      className={
        isLarge
          ? "relative h-[104px] w-[120px] select-none"
          : "relative h-[22px] w-[24px] select-none"
      }
    >

      <div
        className={
          isLarge
            ? "absolute left-1/2 top-1/2 h-[80px] w-[80px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/25 blur-xl"
            : "absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/25 blur-xl"
        }
      />

      <div
        className={
          isLarge
            ? "absolute left-1/2 top-0 h-[34px] w-[92px] -translate-x-1/2 rounded-t-[8px] border border-amber-300/70 bg-gradient-to-b from-amber-300 via-orange-300 to-amber-700 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
            : "absolute left-1/2 top-0 h-[8px] w-[18px] -translate-x-1/2 rounded-t-[3px] border border-amber-300/70 bg-gradient-to-b from-amber-300 via-orange-300 to-amber-700 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
        }
      />

      <div
        className={
          isLarge
            ? "absolute left-1/2 top-[12px] h-[3px] w-[72px] -translate-x-1/2 rounded-full bg-amber-900/70"
            : "absolute left-1/2 top-[3px] h-[1px] w-[12px] -translate-x-1/2 rounded-full bg-amber-900/70"
        }
      />

      <div
        className={
          isLarge
            ? "absolute bottom-0 left-1/2 h-[58px] w-[100px] -translate-x-1/2 overflow-hidden rounded-[10px] border border-amber-300/70 bg-gradient-to-b from-[#6b3d14] via-[#5a2f10] to-[#2b1407] shadow-[0_0_25px_rgba(249,115,22,0.22)]"
            : "absolute bottom-0 left-1/2 h-[12px] w-[20px] -translate-x-1/2 overflow-hidden rounded-[4px] border border-amber-300/70 bg-gradient-to-b from-[#6b3d14] via-[#5a2f10] to-[#2b1407] shadow-[0_0_25px_rgba(249,115,22,0.22)]"
        }
      >

        <div
          className={
            isLarge
              ? "absolute left-1/2 top-0 h-full w-[14px] -translate-x-1/2 bg-gradient-to-b from-yellow-300 to-amber-500"
              : "absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 bg-gradient-to-b from-yellow-300 to-amber-500"
          }
        />

        <div
          className={
            isLarge
              ? "absolute left-1/2 top-1/2 h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-yellow-200 shadow-[0_0_10px_rgba(253,224,71,0.55)]"
              : "absolute left-1/2 top-1/2 h-[4px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-[2px] bg-yellow-200 shadow-[0_0_10px_rgba(253,224,71,0.55)]"
          }
        />

      </div>

    </div>
  );
}