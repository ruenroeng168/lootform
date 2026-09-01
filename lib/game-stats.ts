import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// =========================================================
// BASE CHARACTER STATS
//
// Same starting numbers the Grid Expedition prototype already uses
// (BASE_STATS in app/game/play/page.tsx) for HP/ATK/DEF/VISION, plus
// LUCK/HEAL which only Equipment can ever grant.
// =========================================================

export const BASE_GAME_STATS = {
  hp: 100,
  attack: 8,
  defense: 8,
  luck: 0,
  heal: 0,
  vision: 2,
  mp: 0,
  mat: 0,
  mdf: 0,
  agi: 0,
};

export type EquippedItemGameStats = {
  slot: string;

  item_id: number;
  serial: string;
  grade: string;

  ability_code: string | null;
  ability_config: Record<string, unknown> | null;

  bonus_ability_code: string | null;
  bonus_ability_config: Record<string, unknown> | null;

  hp_bonus: number;
  attack_bonus: number;
  defense_bonus: number;
  luck_bonus: number;
  heal_bonus: number;
  vision_bonus: number;
  mp_bonus: number;
  mat_bonus: number;
  mdf_bonus: number;
  agi_bonus: number;
  power_score: number;
};

export type EffectiveGameStats = {
  base: typeof BASE_GAME_STATS;

  equipment: EquippedItemGameStats[];

  totals: {
    hp_bonus: number;
    attack_bonus: number;
    defense_bonus: number;
    luck_bonus: number;
    heal_bonus: number;
    vision_bonus: number;
    mp_bonus: number;
    mat_bonus: number;
    mdf_bonus: number;
    agi_bonus: number;
    power_score: number;
  };

  effective: {
    hp: number;
    attack: number;
    defense: number;
    luck: number;
    heal: number;
    vision: number;
    mp: number;
    mat: number;
    mdf: number;
    agi: number;
  };
};

const EQUIPPED_GAME_SLOTS = [
  "HEAD",
  "TOP",
  "BOTTOM",
];

type EquipmentRow = {
  slot: string;

  item:
    | {
        id: number;
        serial: string;
        grade: string;

        ability_code_snapshot: string | null;
        ability_config_snapshot: Record<string, unknown> | null;

        bonus_ability_code_snapshot: string | null;
        bonus_ability_config_snapshot: Record<string, unknown> | null;

        hp_bonus_snapshot: number | null;
        attack_bonus_snapshot: number | null;
        defense_bonus_snapshot: number | null;
        luck_bonus_snapshot: number | null;
        heal_bonus_snapshot: number | null;
        vision_bonus_snapshot: number | null;
        mp_bonus_snapshot: number | null;
        mat_bonus_snapshot: number | null;
        mdf_bonus_snapshot: number | null;
        agi_bonus_snapshot: number | null;
        power_score_snapshot: number | null;
      }
    | null;
};

/*
  Server authority for "Effective Game Stats".

  Reads real, currently equipped items (player_equipment + items) and
  sums their frozen Craft-time stat snapshots onto the Base character
  stats. Nothing here ever reads a value the browser supplied -- the
  only inputs are the authenticated user_id and rows already owned by
  that user in the database.
*/
export async function computeEffectiveGameStats(
  userId: string
): Promise<EffectiveGameStats> {
  const {
    data: rows,
    error,
  } = await supabaseAdmin
    .from("player_equipment")
    .select(`
      slot,
      item:items (
        id,
        serial,
        grade,
        ability_code_snapshot,
        ability_config_snapshot,
        bonus_ability_code_snapshot,
        bonus_ability_config_snapshot,
        hp_bonus_snapshot,
        attack_bonus_snapshot,
        defense_bonus_snapshot,
        luck_bonus_snapshot,
        heal_bonus_snapshot,
        vision_bonus_snapshot,
        mp_bonus_snapshot,
        mat_bonus_snapshot,
        mdf_bonus_snapshot,
        agi_bonus_snapshot,
        power_score_snapshot
      )
    `)
    .eq("user_id", userId)
    .in("slot", EQUIPPED_GAME_SLOTS);

  if (error) {
    throw error;
  }

  const equipment: EquippedItemGameStats[] = ((rows ?? []) as unknown as EquipmentRow[])
    .filter((row) => row.item !== null)
    .map((row) => {
      const item = row.item!;

      return {
        slot: row.slot,

        item_id: item.id,
        serial: item.serial,
        grade: item.grade,

        ability_code: item.ability_code_snapshot,
        ability_config: item.ability_config_snapshot,

        bonus_ability_code: item.bonus_ability_code_snapshot,
        bonus_ability_config: item.bonus_ability_config_snapshot,

        hp_bonus: item.hp_bonus_snapshot ?? 0,
        attack_bonus: item.attack_bonus_snapshot ?? 0,
        defense_bonus: item.defense_bonus_snapshot ?? 0,
        luck_bonus: Number(item.luck_bonus_snapshot ?? 0),
        heal_bonus: Number(item.heal_bonus_snapshot ?? 0),
        vision_bonus: item.vision_bonus_snapshot ?? 0,
        mp_bonus: item.mp_bonus_snapshot ?? 0,
        mat_bonus: item.mat_bonus_snapshot ?? 0,
        mdf_bonus: item.mdf_bonus_snapshot ?? 0,
        agi_bonus: item.agi_bonus_snapshot ?? 0,
        power_score: item.power_score_snapshot ?? 0,
      };
    });

  const totals = equipment.reduce(
    (accumulator, current) => ({
      hp_bonus: accumulator.hp_bonus + current.hp_bonus,
      attack_bonus: accumulator.attack_bonus + current.attack_bonus,
      defense_bonus: accumulator.defense_bonus + current.defense_bonus,
      luck_bonus: accumulator.luck_bonus + current.luck_bonus,
      heal_bonus: accumulator.heal_bonus + current.heal_bonus,
      vision_bonus: accumulator.vision_bonus + current.vision_bonus,
      mp_bonus: accumulator.mp_bonus + current.mp_bonus,
      mat_bonus: accumulator.mat_bonus + current.mat_bonus,
      mdf_bonus: accumulator.mdf_bonus + current.mdf_bonus,
      agi_bonus: accumulator.agi_bonus + current.agi_bonus,
      power_score: accumulator.power_score + current.power_score,
    }),
    {
      hp_bonus: 0,
      attack_bonus: 0,
      defense_bonus: 0,
      luck_bonus: 0,
      heal_bonus: 0,
      vision_bonus: 0,
      mp_bonus: 0,
      mat_bonus: 0,
      mdf_bonus: 0,
      agi_bonus: 0,
      power_score: 0,
    }
  );

  return {
    base: BASE_GAME_STATS,

    equipment,

    totals,

    effective: {
      hp: BASE_GAME_STATS.hp + totals.hp_bonus,
      attack: BASE_GAME_STATS.attack + totals.attack_bonus,
      defense: BASE_GAME_STATS.defense + totals.defense_bonus,
      luck: BASE_GAME_STATS.luck + totals.luck_bonus,
      heal: BASE_GAME_STATS.heal + totals.heal_bonus,
      vision: BASE_GAME_STATS.vision + totals.vision_bonus,
      mp: BASE_GAME_STATS.mp + totals.mp_bonus,
      mat: BASE_GAME_STATS.mat + totals.mat_bonus,
      mdf: BASE_GAME_STATS.mdf + totals.mdf_bonus,
      agi: BASE_GAME_STATS.agi + totals.agi_bonus,
    },
  };
}
