-- LOOTFORM x RPG Maker MV schema bridge (additive only)
-- Date: 2026-08-31
--
-- Purpose:
--   Let the standalone RPG Maker MV "LOOTFORM" game (D:\Games\LOOTFORM,
--   bridged via LootformBridge.js) equip/unequip real items into its own
--   default 5-slot model (Weapon/Shield/Head/Body/Accessory) and read the
--   full 8-stat MV param set (HP/MP/ATK/DEF/MAT/MDF/AGI/LUK), while
--   changing NOTHING about the existing data or the Battle RPG (Vite) game
--   that already relies on the current 3-slot / 6-stat model.
--
--   Confirmed live before writing this: 65 real crafted items total
--   (HEAD 24, TOP 41, BOTTOM 0 -- no BOTTOM product has shipped yet),
--   4 currently equipped (TOP 2, HEAD 2). This migration is purely
--   additive -- no column is dropped or renamed, no existing row's value
--   changes, only new nullable/defaulted columns and two new allowed
--   slot values are added.
--
--   LUCK already maps 1:1 onto RPG Maker's native LUK param, so no new
--   column is needed for it. HEAL and VISION have no RPG Maker
--   equivalent and are intentionally left as-is (not dropped) --
--   LOOTFORM's own product identity, unaffected by this bridge.

BEGIN;

ALTER TABLE public.player_equipment
  DROP CONSTRAINT player_equipment_slot_check;
ALTER TABLE public.player_equipment
  ADD CONSTRAINT player_equipment_slot_check
  CHECK (slot = ANY (ARRAY['HEAD','TOP','BOTTOM','SHOES','ACCESSORY','WEAPON','SHIELD']));

ALTER TABLE public.products
  DROP CONSTRAINT products_equip_slot_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_equip_slot_check
  CHECK (equip_slot = ANY (ARRAY['HEAD','TOP','BOTTOM','SHOES','ACCESSORY','WEAPON','SHIELD']));

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS mp_bonus_snapshot integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mat_bonus_snapshot integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mdf_bonus_snapshot integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agi_bonus_snapshot integer DEFAULT 0;

-- Widen the equip/unequip RPC slot validation to match (same functions as
-- 202608310001_equip_item_rpc.sql, only the two ALLOWED-slot literal lists
-- change -- everything else, including all security checks, is identical).
CREATE OR REPLACE FUNCTION public.equip_item_atomic(
  p_item_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.items%ROWTYPE;
  v_slot text;
  v_equipment public.player_equipment%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'LOOTFORM_UNAUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  IF p_item_id IS NULL OR p_item_id <= 0 THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_ITEM_ID' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOOTFORM_ITEM_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_item.owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'LOOTFORM_ITEM_NOT_OWNED' USING ERRCODE = 'P0001';
  END IF;

  IF v_item.equip_slot_snapshot IN ('HEAD','TOP','BOTTOM','SHOES','ACCESSORY','WEAPON','SHIELD') THEN
    v_slot := v_item.equip_slot_snapshot;
  ELSIF v_item.product_id IS NOT NULL THEN
    SELECT equip_slot INTO v_slot FROM public.products WHERE id = v_item.product_id;
  END IF;

  IF v_slot IS NULL OR v_slot NOT IN ('HEAD','TOP','BOTTOM','SHOES','ACCESSORY','WEAPON','SHIELD') THEN
    RAISE EXCEPTION 'LOOTFORM_ITEM_SLOT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.player_equipment (user_id, slot, item_id, created_at, updated_at)
    VALUES (v_user_id, v_slot, v_item.id, now(), now())
    ON CONFLICT (user_id, slot) DO UPDATE
      SET item_id = EXCLUDED.item_id, updated_at = now()
    RETURNING * INTO v_equipment;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'LOOTFORM_ITEM_ALREADY_EQUIPPED' USING ERRCODE = 'P0001';
  END;

  IF v_slot = 'TOP' THEN
    UPDATE public.player_profiles SET equipped_item_id = v_item.id WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object('slot', v_slot, 'item_id', v_item.id, 'equipment_id', v_equipment.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.unequip_equipment_slot(
  p_slot text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_slot text := upper(btrim(COALESCE(p_slot, '')));
  v_current public.player_equipment%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'LOOTFORM_UNAUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  IF v_slot NOT IN ('HEAD','TOP','BOTTOM','SHOES','ACCESSORY','WEAPON','SHIELD') THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_SLOT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_current FROM public.player_equipment WHERE user_id = v_user_id AND slot = v_slot;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('slot', v_slot, 'message', 'Slot already empty.');
  END IF;

  DELETE FROM public.player_equipment WHERE id = v_current.id AND user_id = v_user_id;

  IF v_slot = 'TOP' THEN
    UPDATE public.player_profiles SET equipped_item_id = NULL
    WHERE user_id = v_user_id AND equipped_item_id = v_current.item_id;
  END IF;

  RETURN jsonb_build_object('slot', v_slot, 'item_id', v_current.item_id, 'message', 'Item unequipped.');
END;
$$;

COMMIT;
