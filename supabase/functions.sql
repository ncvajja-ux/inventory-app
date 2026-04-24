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
    WHERE matnr = v_item->>'matnr';
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

-- 4. Analytics: overview totals
CREATE OR REPLACE FUNCTION analytics_overview()
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_orders',    COUNT(*) FILTER (WHERE order_type = 'S' AND status = 'CONFIRMED'),
    'total_returns',   COUNT(*) FILTER (WHERE order_type = 'R' AND status = 'CONFIRMED'),
    'total_customers', (SELECT COUNT(*) FROM customers.kna1),
    'total_products',  (SELECT COUNT(*) FROM inventory.mara),
    'total_revenue',   COALESCE((
      SELECT SUM(vp.line_total)
      FROM transactions.vbap vp
      JOIN transactions.vbak vk ON vk.order_id = vp.order_id
      WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    ), 0)
  ) INTO v FROM transactions.vbak;
  RETURN v;
END;
$$;

-- 5. Analytics: monthly sales for a year
CREATE OR REPLACE FUNCTION analytics_monthly_sales(p_year INT)
RETURNS TABLE(month TEXT, total REAL, orders BIGINT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(vk.created_at, 'Mon') AS month,
    COALESCE(SUM(vp.line_total), 0)::REAL AS total,
    COUNT(DISTINCT vk.order_id) AS orders
  FROM transactions.vbak vk
  LEFT JOIN transactions.vbap vp ON vp.order_id = vk.order_id
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY TO_CHAR(vk.created_at, 'Mon'), EXTRACT(MONTH FROM vk.created_at)
  ORDER BY EXTRACT(MONTH FROM vk.created_at);
END;
$$;

-- 6. Analytics: YTD sales by category
CREATE OR REPLACE FUNCTION analytics_ytd_by_category(p_year INT)
RETURNS TABLE(category TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.category, COALESCE(SUM(vp.line_total), 0)::REAL AS total
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY m.category ORDER BY total DESC;
END;
$$;

-- 7. Analytics: YTD sales by brand
CREATE OR REPLACE FUNCTION analytics_ytd_by_brand(p_year INT)
RETURNS TABLE(brand TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.brand, COALESCE(SUM(vp.line_total), 0)::REAL AS total
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY m.brand ORDER BY total DESC;
END;
$$;

-- 8. Analytics: PO value by brand
CREATE OR REPLACE FUNCTION analytics_po_by_brand(p_year INT)
RETURNS TABLE(brand TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.brand, COALESCE(SUM(pi.line_total), 0)::REAL AS total
  FROM transactions.po_items pi
  JOIN transactions.po_header ph ON ph.po_id = pi.po_id
  JOIN inventory.mara m ON m.matnr = pi.matnr
  WHERE EXTRACT(YEAR FROM ph.po_date) = p_year
  GROUP BY m.brand ORDER BY total DESC;
END;
$$;

-- 9. Analytics: PO value by category
CREATE OR REPLACE FUNCTION analytics_po_by_category(p_year INT)
RETURNS TABLE(category TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.category, COALESCE(SUM(pi.line_total), 0)::REAL AS total
  FROM transactions.po_items pi
  JOIN transactions.po_header ph ON ph.po_id = pi.po_id
  JOIN inventory.mara m ON m.matnr = pi.matnr
  WHERE EXTRACT(YEAR FROM ph.po_date) = p_year
  GROUP BY m.category ORDER BY total DESC;
END;
$$;

-- 10. Analytics: returns by month
CREATE OR REPLACE FUNCTION analytics_returns_by_month(p_year INT)
RETURNS TABLE(month TEXT, total REAL, returns BIGINT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(vk.created_at, 'Mon') AS month,
    COALESCE(SUM(vp.line_total), 0)::REAL AS total,
    COUNT(DISTINCT vk.order_id) AS returns
  FROM transactions.vbak vk
  LEFT JOIN transactions.vbap vp ON vp.order_id = vk.order_id
  WHERE vk.order_type = 'R' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY TO_CHAR(vk.created_at, 'Mon'), EXTRACT(MONTH FROM vk.created_at)
  ORDER BY EXTRACT(MONTH FROM vk.created_at);
END;
$$;

-- 11. Analytics: returns by brand
CREATE OR REPLACE FUNCTION analytics_returns_by_brand(p_year INT)
RETURNS TABLE(brand TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.brand, COALESCE(SUM(vp.line_total), 0)::REAL AS total
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  WHERE vk.order_type = 'R' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY m.brand ORDER BY total DESC;
END;
$$;

-- 12. Analytics: returns by reason
CREATE OR REPLACE FUNCTION analytics_returns_by_reason(p_year INT)
RETURNS TABLE(reason TEXT, count BIGINT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT vk.return_reason AS reason, COUNT(*) AS count
  FROM transactions.vbak vk
  WHERE vk.order_type = 'R' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
    AND vk.return_reason IS NOT NULL
  GROUP BY vk.return_reason ORDER BY count DESC;
END;
$$;

-- 13. Analytics: top return customers
CREATE OR REPLACE FUNCTION analytics_top_return_customers(p_year INT)
RETURNS TABLE(kunnr TEXT, name TEXT, return_count BIGINT, return_value REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT vk.kunnr, k.name,
    COUNT(DISTINCT vk.order_id) AS return_count,
    COALESCE(SUM(vp.line_total), 0)::REAL AS return_value
  FROM transactions.vbak vk
  JOIN customers.kna1 k ON k.kunnr = vk.kunnr
  LEFT JOIN transactions.vbap vp ON vp.order_id = vk.order_id
  WHERE vk.order_type = 'R' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY vk.kunnr, k.name ORDER BY return_count DESC LIMIT 10;
END;
$$;

-- 14. Analytics: top profit products
CREATE OR REPLACE FUNCTION analytics_top_profit_products(p_year INT)
RETURNS TABLE(matnr TEXT, brand TEXT, category TEXT, revenue REAL, cost REAL, profit REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    vp.matnr, m.brand, m.category,
    COALESCE(SUM(vp.line_total), 0)::REAL AS revenue,
    COALESCE(SUM(m.cost_price * vp.quantity), 0)::REAL AS cost,
    COALESCE(SUM(vp.line_total) - SUM(m.cost_price * vp.quantity), 0)::REAL AS profit
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY vp.matnr, m.brand, m.category
  ORDER BY profit DESC LIMIT 20;
END;
$$;

-- 15. Analytics: product match by customer preferences
CREATE OR REPLACE FUNCTION analytics_product_match(p_matnr TEXT)
RETURNS TABLE(
  kunnr TEXT, name TEXT, number TEXT, body_type TEXT,
  pref_brand TEXT, pref_category TEXT,
  prod_brand TEXT, prod_category TEXT, prod_body_type TEXT,
  indicator TEXT, rank INT
) LANGUAGE plpgsql AS $$
DECLARE v_prod inventory.mara%ROWTYPE;
BEGIN
  SELECT * INTO v_prod FROM inventory.mara WHERE matnr = p_matnr;

  RETURN QUERY
  SELECT DISTINCT ON (k.kunnr)
    k.kunnr, k.name, k.number, k.body_type,
    cp.brand AS pref_brand, cp.category AS pref_category,
    v_prod.brand, v_prod.category, v_prod.body_type,
    CASE
      WHEN cp.brand = v_prod.brand AND cp.category = v_prod.category
           AND k.body_type = v_prod.body_type THEN 'green'
      WHEN k.body_type = v_prod.body_type THEN 'blue'
      WHEN cp.brand = v_prod.brand AND cp.category = v_prod.category THEN 'white'
      ELSE NULL
    END AS indicator,
    CASE
      WHEN cp.brand = v_prod.brand AND cp.category = v_prod.category
           AND k.body_type = v_prod.body_type THEN 1
      WHEN k.body_type = v_prod.body_type THEN 2
      WHEN cp.brand = v_prod.brand AND cp.category = v_prod.category THEN 3
      ELSE 4
    END AS rank
  FROM customers.kna1 k
  LEFT JOIN customers.customer_preferences cp ON cp.kunnr = k.kunnr
  WHERE (
    (cp.brand = v_prod.brand AND cp.category = v_prod.category)
    OR k.body_type = v_prod.body_type
  )
  ORDER BY k.kunnr, rank;
END;
$$;
