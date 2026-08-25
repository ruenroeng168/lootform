-- LOOTFORM TEE Serial Pool
-- Date: 2026-08-25
--
-- Purpose:
--   TEE (shirt) items are a 1000-unit limited edition. Serial numbers must
--   be unique, non-sequential (so the printed number can't be used to guess
--   how many have sold), and craft must fail once all 1000 are claimed.
--
--   All other product categories keep the existing sequential
--   lootform_item_serial_seq allocator from 202608250001_atomic_craft.sql.
--
-- IMPORTANT:
--   Run 202608250001_atomic_craft.sql BEFORE this migration.

BEGIN;

CREATE TABLE IF NOT EXISTS public.lootform_tee_serial_pool (
  serial_number int PRIMARY KEY CHECK (serial_number BETWEEN 1 AND 1000),
  is_used boolean NOT NULL DEFAULT false,
  item_id bigint,
  used_at timestamptz
);

INSERT INTO public.lootform_tee_serial_pool (serial_number)
SELECT generate_series(1, 1000)
ON CONFLICT (serial_number) DO NOTHING;

CREATE INDEX IF NOT EXISTS lootform_tee_serial_pool_unused_idx
  ON public.lootform_tee_serial_pool (serial_number)
  WHERE NOT is_used;

ALTER TABLE public.lootform_tee_serial_pool ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.lootform_tee_serial_pool FROM PUBLIC;
REVOKE ALL ON TABLE public.lootform_tee_serial_pool FROM anon;
REVOKE ALL ON TABLE public.lootform_tee_serial_pool FROM authenticated;
GRANT ALL ON TABLE public.lootform_tee_serial_pool TO service_role;

/*
  Re-create lootform_craft_atomic with TEE-specific serial allocation.

  Only the "allocate serial" section changed from
  202608250001_atomic_craft.sql: TEE now claims a random unused row from
  lootform_tee_serial_pool (SKIP LOCKED, so concurrent crafts never block
  on each other or collide) instead of the shared sequence. Pool
  exhaustion raises LOOTFORM_TEE_SOLD_OUT, which rolls back the whole
  transaction (including the wallet deduction already made in this
  function) since the caller is still inside the same DB transaction.
*/
CREATE OR REPLACE FUNCTION public.lootform_craft_atomic(
  p_request_id uuid,
  p_user_id uuid,
  p_product_id bigint,
  p_design_id bigint,
  p_product_code text,
  p_product_name text,
  p_design_code text,
  p_design_name text,
  p_season_code text,
  p_category text,
  p_equip_slot text,
  p_size text,
  p_craft_cost numeric,
  p_grade text,
  p_thumbnail_url text,
  p_model_url text,
  p_environment_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.craft_requests%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_item public.items%ROWTYPE;

  v_request_fingerprint text;
  v_serial_number bigint;
  v_serial text;
  v_snapshot_at timestamptz := now();
  v_grade text;
  v_item_grade public.items.grade%TYPE;
  v_item_environment public.items.environment_mode%TYPE;
  v_transaction_environment public.wallet_transactions.environment_mode%TYPE;
  v_response jsonb;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_REQUEST_ID'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_USER_ID'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_product_id IS NULL OR p_product_id <= 0
     OR p_design_id IS NULL OR p_design_id <= 0
  THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_CATALOG_SELECTION'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(BTRIM(p_size), '') = '' THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_SIZE'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_craft_cost IS NULL OR p_craft_cost < 0 THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_CRAFT_COST'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_grade NOT IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY') THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_GRADE'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_environment_mode NOT IN ('TEST', 'LIVE') THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_ENVIRONMENT_MODE'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(BTRIM(p_thumbnail_url), '') = '' THEN
    RAISE EXCEPTION 'LOOTFORM_GRADE_ASSET_NOT_READY'
      USING ERRCODE = 'P0001';
  END IF;

  v_request_fingerprint := md5(
    concat_ws(
      '|',
      p_user_id::text,
      p_product_id::text,
      p_design_id::text,
      upper(BTRIM(p_size))
    )
  );

  INSERT INTO public.craft_requests (
    request_id,
    user_id,
    request_fingerprint,
    rolled_grade,
    status
  )
  VALUES (
    p_request_id,
    p_user_id,
    v_request_fingerprint,
    p_grade,
    'PROCESSING'
  )
  ON CONFLICT (request_id) DO NOTHING;

  SELECT *
  INTO v_request
  FROM public.craft_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOOTFORM_CRAFT_REQUEST_LOCK_FAILED'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.user_id <> p_user_id THEN
    RAISE EXCEPTION 'LOOTFORM_REQUEST_ID_CONFLICT'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.request_fingerprint <> v_request_fingerprint THEN
    RAISE EXCEPTION 'LOOTFORM_REQUEST_ID_PAYLOAD_MISMATCH'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status = 'COMPLETED' THEN
    IF v_request.response IS NULL THEN
      RAISE EXCEPTION 'LOOTFORM_IDEMPOTENT_RESPONSE_MISSING'
        USING ERRCODE = 'P0001';
    END IF;

    RETURN v_request.response
      || jsonb_build_object(
        'idempotent_replay',
        true
      );
  END IF;

  v_grade := v_request.rolled_grade;

  v_item_grade := v_grade;
  v_item_environment := p_environment_mode;
  v_transaction_environment := p_environment_mode;

  SELECT *
  INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOOTFORM_WALLET_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_wallet.balance, 0) < p_craft_cost THEN
    RAISE EXCEPTION 'LOOTFORM_INSUFFICIENT_BALANCE'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.wallets
  SET
    balance = balance - p_craft_cost,
    updated_at = v_snapshot_at
  WHERE user_id = p_user_id
  RETURNING *
  INTO v_wallet;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOOTFORM_WALLET_UPDATE_FAILED'
      USING ERRCODE = 'P0001';
  END IF;

  /* =======================================================
     SERIAL ALLOCATION

     TEE: random unused number from the fixed 1-1000 pool.
     Everything else: the shared sequential counter.
  ======================================================= */

  IF upper(BTRIM(p_category)) = 'TEE' THEN
    SELECT serial_number
    INTO v_serial_number
    FROM public.lootform_tee_serial_pool
    WHERE NOT is_used
    ORDER BY random()
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'LOOTFORM_TEE_SOLD_OUT'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.lootform_tee_serial_pool
    SET
      is_used = true,
      used_at = v_snapshot_at
    WHERE serial_number = v_serial_number;

    v_serial := 'LF-TEE-' || lpad(v_serial_number::text, 4, '0');
  ELSE
    v_serial_number := nextval('public.lootform_item_serial_seq');

    v_serial :=
      'LF-'
      || p_season_code
      || '-'
      || lpad(v_serial_number::text, 4, '0');
  END IF;

  INSERT INTO public.items (
    serial,
    product,
    season,
    product_id,
    design_id,
    grade,
    level,
    size,
    owner_id,
    production_status,
    production_updated_at,
    environment_mode,
    product_code_snapshot,
    product_name_snapshot,
    design_code_snapshot,
    design_name_snapshot,
    season_snapshot,
    category_snapshot,
    equip_slot_snapshot,
    craft_cost_lt_snapshot,
    thumbnail_url_snapshot,
    model_url_snapshot,
    catalog_snapshot_at
  )
  VALUES (
    v_serial,
    p_product_name,
    p_season_code,
    p_product_id,
    p_design_id,
    v_item_grade,
    0,
    upper(BTRIM(p_size)),
    p_user_id,
    'CRAFTED',
    v_snapshot_at,
    v_item_environment,
    p_product_code,
    p_product_name,
    p_design_code,
    p_design_name,
    p_season_code,
    p_category,
    p_equip_slot,
    p_craft_cost,
    p_thumbnail_url,
    NULLIF(BTRIM(p_model_url), ''),
    v_snapshot_at
  )
  RETURNING *
  INTO v_item;

  IF upper(BTRIM(p_category)) = 'TEE' THEN
    UPDATE public.lootform_tee_serial_pool
    SET item_id = v_item.id
    WHERE serial_number = v_serial_number;
  END IF;

  INSERT INTO public.wallet_transactions (
    user_id,
    type,
    amount,
    description,
    item_id,
    environment_mode
  )
  VALUES (
    p_user_id,
    'CRAFT',
    -p_craft_cost,
    concat_ws(
      ' / ',
      'CRAFT',
      p_product_name,
      p_design_code,
      p_season_code,
      v_grade,
      upper(BTRIM(p_size)),
      v_serial
    ),
    v_item.id,
    v_transaction_environment
  );

  v_response := jsonb_build_object(
    'item',
    jsonb_build_object(
      'id', v_item.id,
      'serial', v_item.serial,
      'product', v_item.product,
      'season', v_item.season,
      'product_id', v_item.product_id,
      'design_id', v_item.design_id,
      'grade', v_item.grade,
      'level', v_item.level,
      'size', v_item.size,
      'owner_id', v_item.owner_id,
      'production_status', v_item.production_status,
      'tracking_number', v_item.tracking_number,
      'production_updated_at', v_item.production_updated_at,
      'environment_mode', v_item.environment_mode,
      'product_code_snapshot', v_item.product_code_snapshot,
      'product_name_snapshot', v_item.product_name_snapshot,
      'design_code_snapshot', v_item.design_code_snapshot,
      'design_name_snapshot', v_item.design_name_snapshot,
      'season_snapshot', v_item.season_snapshot,
      'category_snapshot', v_item.category_snapshot,
      'equip_slot_snapshot', v_item.equip_slot_snapshot,
      'craft_cost_lt_snapshot', v_item.craft_cost_lt_snapshot,
      'thumbnail_url_snapshot', v_item.thumbnail_url_snapshot,
      'model_url_snapshot', v_item.model_url_snapshot,
      'catalog_snapshot_at', v_item.catalog_snapshot_at,
      'created_at', v_item.created_at
    ),
    'wallet',
    jsonb_build_object(
      'id', v_wallet.id,
      'user_id', v_wallet.user_id,
      'balance', v_wallet.balance,
      'updated_at', v_wallet.updated_at
    ),
    'request_id',
    p_request_id,
    'idempotent_replay',
    false
  );

  UPDATE public.craft_requests
  SET
    status = 'COMPLETED',
    response = v_response,
    completed_at = v_snapshot_at
  WHERE request_id = p_request_id;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.lootform_craft_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text, text, text, text, text,
  numeric, text, text, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.lootform_craft_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text, text, text, text, text,
  numeric, text, text, text, text
) FROM anon;

REVOKE ALL ON FUNCTION public.lootform_craft_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text, text, text, text, text,
  numeric, text, text, text, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.lootform_craft_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text, text, text, text, text,
  numeric, text, text, text, text
) TO service_role;

COMMIT;
