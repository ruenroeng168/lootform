-- LOOTFORM Atomic Craft Transaction
-- Date: 2026-08-25
--
-- Purpose:
--   1) Serialize wallet spending per player with SELECT ... FOR UPDATE
--   2) Allocate human-readable serial numbers with a dedicated sequence
--   3) Insert Item + deduct Wallet + insert Wallet Ledger in one DB transaction
--   4) Make a Craft request idempotent by request_id
--
-- IMPORTANT:
--   Run this migration in Supabase BEFORE deploying the matching /api/craft code.

BEGIN;

CREATE TABLE IF NOT EXISTS public.craft_requests (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  rolled_grade text NOT NULL
    CHECK (rolled_grade IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
  status text NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'COMPLETED')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS craft_requests_user_created_idx
  ON public.craft_requests (user_id, created_at DESC);

ALTER TABLE public.craft_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.craft_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.craft_requests FROM anon;
REVOKE ALL ON TABLE public.craft_requests FROM authenticated;
GRANT ALL ON TABLE public.craft_requests TO service_role;

CREATE SEQUENCE IF NOT EXISTS public.lootform_item_serial_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1;

DO $$
DECLARE
  v_max_item_id bigint;
  v_last_value bigint;
  v_is_called boolean;
BEGIN
  SELECT COALESCE(MAX(id), 0)::bigint
  INTO v_max_item_id
  FROM public.items;

  SELECT last_value::bigint, is_called
  INTO v_last_value, v_is_called
  FROM public.lootform_item_serial_seq;

  IF v_max_item_id > 0
     AND (
       v_last_value < v_max_item_id
       OR (
         v_last_value = v_max_item_id
         AND NOT v_is_called
       )
     )
  THEN
    PERFORM setval(
      'public.lootform_item_serial_seq',
      v_max_item_id,
      true
    );
  END IF;
END;
$$;

REVOKE ALL ON SEQUENCE public.lootform_item_serial_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.lootform_item_serial_seq FROM anon;
REVOKE ALL ON SEQUENCE public.lootform_item_serial_seq FROM authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.lootform_item_serial_seq TO service_role;

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

  /*
    Fingerprint only the player's requested selection.

    Catalog snapshots / Grade are intentionally excluded:
    a replay after a response was lost must return the already committed
    Craft even if Catalog data changes before the retry reaches the API.
  */
  v_request_fingerprint := md5(
    concat_ws(
      '|',
      p_user_id::text,
      p_product_id::text,
      p_design_id::text,
      upper(BTRIM(p_size))
    )
  );

  /*
    First caller creates the request row.
    A concurrent duplicate request_id waits on the PK conflict until the
    first transaction commits/rolls back, then reads the committed result.
  */
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

  /*
    Keep the Grade chosen by the first request that claimed this request_id.
    This avoids a retry receiving a different server roll.
  */
  v_grade := v_request.rolled_grade;

  /*
    Cast through the real database column types. This keeps the RPC
    compatible whether Grade / Environment are text columns or enums.
  */
  v_item_grade := v_grade;
  v_item_environment := p_environment_mode;
  v_transaction_environment := p_environment_mode;

  /*
    Serialize balance changes for this player.

    Two different Craft requests for the same player cannot both spend
    the same balance snapshot.
  */
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

  /*
    Dedicated sequence is concurrency-safe.
    Sequence values are intentionally allowed to have gaps when a
    transaction fails; uniqueness and correctness are more important than
    gap-free human serials.
  */
  v_serial_number := nextval('public.lootform_item_serial_seq');

  v_serial :=
    'LF-'
    || p_season_code
    || '-'
    || lpad(v_serial_number::text, 4, '0');

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

  /*
    Return the same public shape the old API selected explicitly.
    Avoid returning every future column from items / wallets by accident.
  */
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
  uuid,
  uuid,
  bigint,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.lootform_craft_atomic(
  uuid,
  uuid,
  bigint,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  text,
  text
) FROM anon;

REVOKE ALL ON FUNCTION public.lootform_craft_atomic(
  uuid,
  uuid,
  bigint,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  text,
  text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.lootform_craft_atomic(
  uuid,
  uuid,
  bigint,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  text,
  text
) TO service_role;

COMMIT;
