-- ============================================================
--  RPC Functions for Inventory App
--  Run in Supabase SQL Editor after disable-rls.sql
-- ============================================================

-- 1. Place a new sales order (atomic: header + lines + inventory)
CREATE OR REPLACE FUNCTION place_order(
  p_kunnr               TEXT,
  p_items               JSONB,
  p_customer_discount_pct REAL DEFAULT 0,
  p_manual_discount     REAL DEFAULT 0
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_order_id TEXT;
  v_max_num  INTEGER;
  v_item     JSONB;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(order_id, 2) AS INTEGER)), 100000)
    INTO v_max_num FROM transactions.vbak WHERE order_id LIKE 'S%';
  v_order_id := 'S' || LPAD(CAST(v_max_num + 1 AS TEXT), 6, '0');

  INSERT INTO transactions.vbak
    (order_id, kunnr, status, payment_status, customer_discount_pct, manual_discount, order_type)
  VALUES
    (v_order_id, p_kunnr, 'CONFIRMED', 'PENDING', p_customer_discount_pct, p_manual_discount, 'S');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO transactions.vbap
      (order_id, matnr, quantity, price, mrp, discount_pct, gst_rate, line_total)
    VALUES (
      v_order_id,
      v_item->>'matnr',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::REAL,
      (v_item->>'mrp')::REAL,
      (v_item->>'discount_pct')::REAL,
      (v_item->>'gst_rate')::REAL,
      (v_item->>'line_total')::REAL
    );
    UPDATE inventory.mara
      SET quantity = quantity - (v_item->>'quantity')::INTEGER
    WHERE matnr = v_item->>'matnr'
      AND quantity >= (v_item->>'quantity')::INTEGER;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item->>'matnr';
    END IF;
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- 2. Place a return order (atomic: header + lines + inventory restore)
CREATE OR REPLACE FUNCTION place_return(
  p_original_order_id TEXT,
  p_items             JSONB,
  p_reason            TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_order_id TEXT;
  v_max_num  INTEGER;
  v_orig     transactions.vbak%ROWTYPE;
  v_item     JSONB;
BEGIN
  SELECT * INTO v_orig FROM transactions.vbak WHERE order_id = p_original_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original order % does not exist', p_original_order_id;
  END IF;

  IF v_orig.order_type <> 'S' THEN
    RAISE EXCEPTION 'Order % is not a sales order and cannot be returned', p_original_order_id;
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(order_id, 2) AS INTEGER)), 100000)
    INTO v_max_num FROM transactions.vbak WHERE order_id LIKE 'R%';
  v_order_id := 'R' || LPAD(CAST(v_max_num + 1 AS TEXT), 6, '0');

  INSERT INTO transactions.vbak
    (order_id, kunnr, status, payment_status, order_type, original_order_id, return_reason)
  VALUES
    (v_order_id, v_orig.kunnr, 'CONFIRMED', 'PENDING', 'R', p_original_order_id, p_reason);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO transactions.vbap
      (order_id, matnr, quantity, price, mrp, discount_pct, gst_rate, line_total)
    VALUES (
      v_order_id,
      v_item->>'matnr',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::REAL,
      (v_item->>'mrp')::REAL,
      (v_item->>'discount_pct')::REAL,
      (v_item->>'gst_rate')::REAL,
      (v_item->>'line_total')::REAL
    );
    UPDATE inventory.mara
      SET quantity = quantity + (v_item->>'quantity')::INTEGER
    WHERE matnr = v_item->>'matnr';
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- 3. Conflict check: has any group member bought the same product?
CREATE OR REPLACE FUNCTION conflict_check(p_kunnr TEXT, p_matnr TEXT)
RETURNS TABLE(has_conflict BOOLEAN, group_name TEXT, buyer_name TEXT, buyer_kunnr TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE AS has_conflict,
    cg.name AS group_name,
    k.name AS buyer_name,
    gm2.kunnr AS buyer_kunnr
  FROM groups.group_members gm1
  JOIN groups.group_members gm2 ON gm1.group_id = gm2.group_id AND gm2.kunnr <> p_kunnr
  JOIN groups.customer_groups cg ON cg.group_id = gm1.group_id
  JOIN customers.kna1 k ON k.kunnr = gm2.kunnr
  WHERE gm1.kunnr = p_kunnr
    AND EXISTS (
      SELECT 1 FROM transactions.vbak vk
      JOIN transactions.vbap vp ON vp.order_id = vk.order_id
      WHERE vk.kunnr = gm2.kunnr AND vp.matnr = p_matnr AND vk.status = 'CONFIRMED'
    )
  LIMIT 1;
END;
$$;

