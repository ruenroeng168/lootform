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

import Navbar from "@/components/Navbar";

import LootformHeroSprite, {
  type HeroDirection,
  type HeroGrade,
} from "@/components/game/LootformHeroSprite";

import CombatScene, {
  type BattleRound,
} from "@/components/game/CombatScene";

import {
  GameSessionError,
  startGameSession,
} from "@/lib/game-session";

import {
  GameEventError,
  sendGameStartEvent,
  sendMonsterDefeatedEvent,
  sendTreasureFoundEvent,
} from "@/lib/game-event";

import {
  supabase,
} from "@/lib/supabase";

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

type GameStatus =
  | "READY"
  | "PLAYING"
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
  12;

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
// MONSTERS
// =========================================================

const MONSTER_STATS:
  Record<
    MonsterTier,
    MonsterDefinition
  > = {
    SCOUT: {
      name:
        "VOID SCOUT",

      hp:
        38,

      atk:
        9,

      def:
        5,

      score:
        80,
    },

    GUARD: {
      name:
        "GRID GUARD",

      hp:
        65,

      atk:
        15,

      def:
        11,

      score:
        150,
    },

    ELITE: {
      name:
        "VOID ELITE",

      hp:
        95,

      atk:
        22,

      def:
        17,

      score:
        280,
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
// RANDOM MONSTER
// =========================================================

function randomMonsterTier():
  MonsterTier {
  const roll =
    Math.random();

  if (
    roll <
    0.5
  ) {
    return "SCOUT";
  }

  if (
    roll <
    0.85
  ) {
    return "GUARD";
  }

  return "ELITE";
}

// =========================================================
// CREATE ENTITIES
// =========================================================

function createEntities():
  Entity[] {
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
    Entity[] = [];

  let cursor =
    0;

  for (
    let i =
      0;
    i <
      7;
    i++
  ) {
    const tile =
      available[
        cursor++
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

  for (
    let i =
      0;
    i <
      5;
    i++
  ) {
    const tile =
      available[
        cursor++
      ];

    if (
      !tile
    ) {
      break;
    }

    result.push({
      id:
        `MONSTER-${Date.now()}-${i}`,

      x:
        tile.x,

      y:
        tile.y,

      type:
        "MONSTER",

      tier:
        randomMonsterTier(),
    });
  }

  return result;
}

// =========================================================
// AUTO BATTLE
// =========================================================

function resolveAutoBattle(
  player:
    PlayerStats,

  currentPlayerHp:
    number,

  monsterTier:
    MonsterTier
): BattleResult {
  const monster =
    MONSTER_STATS[
      monsterTier
    ];

  let playerHp =
    currentPlayerHp;

  let monsterHp =
    monster.hp;

  let round =
    0;

  const rounds:
    BattleRound[] = [];

  const MAX_ROUNDS =
    60;

  while (
    playerHp >
      0 &&
    monsterHp >
      0 &&
    round <
      MAX_ROUNDS
  ) {
    round +=
      1;

    const heroDamage =
      Math.max(
        1,
        Math.round(
          player.atk *
            100 /
          (
            100 +
            monster.def
          )
        )
      );

    monsterHp =
      Math.max(
        0,
        monsterHp -
          heroDamage
      );

    let monsterDamage =
      0;

    if (
      monsterHp >
      0
    ) {
      monsterDamage =
        Math.max(
          1,
          Math.round(
            monster.atk *
              100 /
            (
              100 +
              player.def
            )
          )
        );

      playerHp =
        Math.max(
          0,
          playerHp -
            monsterDamage
        );
    }

    rounds.push({
      round,

      heroDamage,

      monsterDamage,

      heroHpAfter:
        playerHp,

      monsterHpAfter:
        monsterHp,
    });
  }

  return {
    won:
      monsterHp <=
      0,

    roundCount:
      round,

    playerHp,

    monsterHp,

    monster,

    rounds,
  };
}

// =========================================================
// PAGE
// =========================================================

export default function GameTestPage() {
  const router =
    useRouter();

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

  // =====================================================
  // FOG
  // =====================================================

  const visibleTiles =
    useMemo(
      () =>
        calculateVisibleTiles(
          posX,
          posY,
          playerStats.sightRange
        ),
      [
        posX,
        posY,
        playerStats.sightRange,
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
                playerStats.maxHp,

              sight_range:
                playerStats.sightRange,

              power:
                playerStats.power,

              atk:
                playerStats.atk,

              def:
                playerStats.def,
            }
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
            START_X
          );

          setPosY(
            START_Y
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
            playerStats.maxHp
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

          setEntities(
            createEntities()
          );

          setExploredTiles(
            new Set()
          );

          setTreasurePopup(
            null
          );

          setActiveBattle(
            null
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
  // =====================================================

  const recordMonsterDefeatedEvent =
    useCallback(
      async (
        sessionId:
          string,

        entity:
          MonsterEntity,

        result:
          BattleResult,

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
          const response =
            await sendMonsterDefeatedEvent(
              sessionId,
              result.monster.score,
              {
                source:
                  "GRID_EXPEDITION",

                map:
                  "SECTOR_A_01",

                monster:
                  result.monster.name,

                tier:
                  entity.tier,

                x:
                  targetX,

                y:
                  targetY,

                step:
                  nextStep,

                rounds:
                  result.roundCount,

                hp_left:
                  result.playerHp,

                score_gain:
                  result.monster.score,

                run_score:
                  scoreAfter,
              }
            );

          addLog(
            `SERVER: MONSTER_DEFEATED EVENT #${response.event.id} ✓`
          );
        } catch (
          error
        ) {
          console.error(
            "MONSTER EVENT ERROR:",
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
              "⚠ SERVER EVENT FAILED: MONSTER_DEFEATED"
            );
          }
        }
      },
      [
        addLog,
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

          // =================================================
          // REAL SERVER EVENT
          // =================================================

          if (
            liveSession
          ) {
            void recordMonsterDefeatedEvent(
              liveSession.id,
              entity,
              result,
              targetX,
              targetY,
              nextStep,
              scoreAfter
            );
          } else {
            addLog(
              "⚠ MONSTER EVENT SKIPPED: NO LIVE SESSION"
            );
          }

          if (
            nextStamina <=
            0
          ) {
            setGameStatus(
              "STAMINA_OUT"
            );

            addLog(
              "🏕️ Stamina depleted."
            );
          }
        } else {
          setPlayerHp(
            0
          );

          setGameStatus(
            "DEFEATED"
          );

          addLog(
            `💀 DEFEATED BY ${result.monster.name}`
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
        liveSession,
        recordMonsterDefeatedEvent,
        runScore,
      ]
    );

  // =====================================================
  // MOVE HERO
  // =====================================================

  const moveHero =
    useCallback(
      (
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
          dx >
          0
        ) {
          setHeroDirection(
            "RIGHT"
          );
        } else if (
          dx <
          0
        ) {
          setHeroDirection(
            "LEFT"
          );
        } else if (
          dy <
          0
        ) {
          setHeroDirection(
            "UP"
          );
        } else if (
          dy >
          0
        ) {
          setHeroDirection(
            "DOWN"
          );
        }

        const targetX =
          posX +
          dx;

        const targetY =
          posY +
          dy;

        if (
          !isInsideMap(
            targetX,
            targetY
          )
        ) {
          addLog(
            "⛔ MAP EDGE"
          );

          return;
        }

        if (
          isWall(
            targetX,
            targetY
          )
        ) {
          addLog(
            "▦ BLOCKED BY WALL"
          );

          return;
        }

        if (
          stamina <
          MOVE_COST
        ) {
          setGameStatus(
            "STAMINA_OUT"
          );

          return;
        }

        movementLock.current =
          true;

        playMovementAnimation();

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

        const entity =
          entities.find(
            (
              current
            ) =>
              current.x ===
                targetX &&
              current.y ===
                targetY
          );

        if (
          entity?.type ===
          "MONSTER"
        ) {
          const result =
            resolveAutoBattle(
              playerStats,
              playerHp,
              entity.tier
            );

          setActiveBattle({
            entity,

            targetX,

            targetY,

            nextStamina,

            nextStep,

            result,
          });

          return;
        }

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
              "TREASURE CHEST FOUND",

            sub:
              `+${gain} RUN SCORE`,

            gain,
          });

          addLog(
            `🧰 TREASURE CHEST +${gain} SCORE`
          );

          if (
            liveSession
          ) {
            void recordTreasureEvent(
              liveSession.id,
              gain,
              targetX,
              targetY,
              nextStep,
              scoreAfter
            );
          } else {
            addLog(
              "⚠ TREASURE EVENT SKIPPED: NO LIVE SESSION"
            );
          }

          if (
            nextStamina <=
            0
          ) {
            setGameStatus(
              "STAMINA_OUT"
            );
          }

          movementLock.current =
            false;

          return;
        }

        setPosX(
          targetX
        );

        setPosY(
          targetY
        );

        if (
          targetX ===
            EXIT_X &&
          targetY ===
            EXIT_Y
        ) {
          setGameStatus(
            "COMPLETE"
          );

          addLog(
            "🏁 EXIT FOUND!"
          );
        } else if (
          nextStamina <=
          0
        ) {
          setGameStatus(
            "STAMINA_OUT"
          );

          addLog(
            "🏕️ STAMINA EMPTY"
          );
        }

        movementLock.current =
          false;
      },
      [
        activeBattle,
        addLog,
        entities,
        gameStatus,
        liveSession,
        playMovementAnimation,
        playerHp,
        playerStats,
        posX,
        posY,
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

          <div className="relative min-h-[680px] overflow-hidden rounded-[28px] border border-cyan-400/20 bg-zinc-950 p-5">

            {activeBattle && (
              <CombatScene
                heroGrade={
                  heroGrade
                }
                heroStartHp={
                  playerHp
                }
                heroMaxHp={
                  playerStats.maxHp
                }
                heroAtk={
                  playerStats.atk
                }
                heroDef={
                  playerStats.def
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
                    LOOT DISCOVERED
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
                    Hidden reward has been added to your run.
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

            {gameStatus !==
              "READY" &&
              gameStatus !==
                "PLAYING" &&
              !activeBattle &&
              !treasurePopup && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 p-6 backdrop-blur">

                  <div className="w-full max-w-md text-center">

                    <p
                      className={
                        gameStatus ===
                        "COMPLETE"
                          ? "text-[8px] font-black tracking-[0.3em] text-lime-400"
                          : "text-[8px] font-black tracking-[0.3em] text-red-400"
                      }
                    >
                      EXPEDITION RESULT
                    </p>

                    <h2 className="mt-3 text-4xl font-black">

                      {gameStatus ===
                      "COMPLETE"
                        ? "MISSION COMPLETE"
                        : gameStatus ===
                          "DEFEATED"
                        ? "HERO DEFEATED"
                        : "STAMINA EMPTY"}

                    </h2>

                    <div className="mt-7 grid grid-cols-2 gap-3">

                      <ResultBox
                        label="RUN SCORE"
                        value={
                          runScore
                        }
                      />

                      <ResultBox
                        label="STEPS"
                        value={
                          stepCount
                        }
                      />

                      <ResultBox
                        label="MONSTERS"
                        value={
                          monstersDefeated
                        }
                      />

                      <ResultBox
                        label="HP"
                        value={`${playerHp}/${playerStats.maxHp}`}
                      />

                    </div>

                    {liveSession && (
                      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3">

                        <p className="text-[6px] text-zinc-600">
                          SESSION
                        </p>

                        <p className="mt-1 font-mono text-[8px] text-cyan-400">
                          {shortSessionId(
                            liveSession.id
                          )}
                        </p>

                      </div>
                    )}

                    <p className="mt-4 text-[7px] leading-5 text-zinc-600">
                      GAME_START, TREASURE_FOUND and MONSTER_DEFEATED are connected. Final session completion will be connected in the next step.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        void startExpedition();
                      }}
                      disabled={
                        startingSession
                      }
                      className="mt-7 rounded-xl bg-white px-9 py-3 text-[10px] font-black text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {startingSession
                        ? "CREATING SESSION + EVENT..."
                        : "PLAY AGAIN"}
                    </button>

                  </div>

                </div>
              )}

            <div className="flex items-center justify-between gap-4">

              <div>

                <p className="text-[7px] tracking-[0.15em] text-zinc-600">
                  MAP
                </p>

                <p className="mt-1 text-sm font-black">
                  SECTOR A-01
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

              </div>

            </div>

            <div className="mt-5 flex min-h-[500px] items-start justify-center overflow-auto rounded-2xl border border-zinc-900 bg-black/50 p-5">

              <div
                className="grid w-max gap-[3px]"
                style={{
                  gridTemplateColumns:
                    `repeat(${MAP_SIZE}, clamp(29px, 3.1vw, 38px))`,
                }}
              >

                {Array.from({
                  length:
                    MAP_SIZE *
                    MAP_SIZE,
                }).map(
                  (
                    _,
                    index
                  ) => {
                    const tileX =
                      index %
                      MAP_SIZE;

                    const tileY =
                      Math.floor(
                        index /
                          MAP_SIZE
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

                    let tileStyle =
                      "border-black bg-black";

                    if (
                      explored &&
                      !visible
                    ) {
                      tileStyle =
                        wall
                          ? "border-zinc-950 bg-zinc-950"
                          : "border-zinc-900 bg-zinc-950";
                    }

                    if (
                      visible
                    ) {
                      tileStyle =
                        wall
                          ? "border-zinc-600 bg-zinc-700"
                          : "border-zinc-800 bg-zinc-900";
                    }

                    return (
                      <div
                        key={
                          key
                        }
                        className={`relative flex aspect-square items-center justify-center overflow-visible rounded-[5px] border transition-all duration-200 ${tileStyle}`}
                      >

                        {visible &&
                          wall && (
                            <span className="text-xs text-zinc-500">
                              ▦
                            </span>
                          )}

                        {explored &&
                          exit &&
                          !wall && (
                            <span
                              className={
                                visible
                                  ? "relative z-10 text-xl font-black text-lime-400 drop-shadow-[0_0_10px_rgba(163,230,53,1)]"
                                  : "relative z-10 text-xl font-black text-zinc-700"
                              }
                            >
                              ◇
                            </span>
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

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[7px] font-black text-zinc-600">

              <span>
                HERO
              </span>

              <span>
                CHEST
              </span>

              <span>
                👾 MONSTER
              </span>

              <span>
                👹 ELITE
              </span>

              <span>
                ◇ EXIT
              </span>

              <span>
                ▦ WALL
              </span>

            </div>

          </div>

          <aside className="space-y-4">

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
                    playerStats.maxHp
                  }
                  barClassName="bg-red-400"
                />

              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">

                <StatBox
                  label="SIGHT"
                  value={`${playerStats.sightRange} TILES`}
                  valueClassName="text-purple-400"
                />

                <StatBox
                  label="POWER"
                  value={
                    playerStats.power
                  }
                  valueClassName="text-lime-400"
                />

                <StatBox
                  label="ATK"
                  value={
                    playerStats.atk
                  }
                  valueClassName="text-orange-400"
                />

                <StatBox
                  label="DEF"
                  value={
                    playerStats.def
                  }
                  valueClassName="text-cyan-400"
                />

              </div>

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
// MINI STATUS
// =========================================================

function MiniStatus({
  label,
  value,
}: {
  label:
    string;

  value:
    number;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black px-3 py-2">

      <p className="text-[5px] text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-[8px] font-black text-cyan-400">
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left">

      <p className="text-[6px] text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-lg font-black text-white">
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