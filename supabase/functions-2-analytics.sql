-- analytics_ytd_by_category
CREATE OR REPLACE FUNCTION analytics_ytd_by_category(p_year INT)
RETURNS TABLE(category TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT p.category, COALESCE(SUM(vp.line_total), 0)::REAL AS total
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  JOIN inventory.products p ON p.sku_id = m.sku_id
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY p.category ORDER BY total DESC;
END;
$$;

-- analytics_ytd_by_brand
CREATE OR REPLACE FUNCTION analytics_ytd_by_brand(p_year INT)
RETURNS TABLE(brand TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT p.brand, COALESCE(SUM(vp.line_total), 0)::REAL AS total
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  JOIN inventory.products p ON p.sku_id = m.sku_id
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY p.brand ORDER BY total DESC;
END;
$$;

-- analytics_po_by_brand
CREATE OR REPLACE FUNCTION analytics_po_by_brand(p_year INT)
RETURNS TABLE(brand TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT p.brand, COALESCE(SUM(pi.line_total), 0)::REAL AS total
  FROM transactions.po_items pi
  JOIN transactions.po_header ph ON ph.po_id = pi.po_id
  JOIN inventory.mara m ON m.matnr = pi.matnr
  JOIN inventory.products p ON p.sku_id = m.sku_id
  WHERE EXTRACT(YEAR FROM ph.po_date) = p_year
  GROUP BY p.brand ORDER BY total DESC;
END;
$$;

-- analytics_po_by_category
CREATE OR REPLACE FUNCTION analytics_po_by_category(p_year INT)
RETURNS TABLE(category TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT p.category, COALESCE(SUM(pi.line_total), 0)::REAL AS total
  FROM transactions.po_items pi
  JOIN transactions.po_header ph ON ph.po_id = pi.po_id
  JOIN inventory.mara m ON m.matnr = pi.matnr
  JOIN inventory.products p ON p.sku_id = m.sku_id
  WHERE EXTRACT(YEAR FROM ph.po_date) = p_year
  GROUP BY p.category ORDER BY total DESC;
END;
$$;

-- analytics_returns_by_brand
CREATE OR REPLACE FUNCTION analytics_returns_by_brand(p_year INT)
RETURNS TABLE(brand TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT p.brand, COALESCE(SUM(vp.line_total), 0)::REAL AS total
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  JOIN inventory.products p ON p.sku_id = m.sku_id
  WHERE vk.order_type = 'R' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY p.brand ORDER BY total DESC;
END;
$$;

-- analytics_top_profit_products
CREATE OR REPLACE FUNCTION analytics_top_profit_products(p_year INT)
RETURNS TABLE(matnr TEXT, brand TEXT, category TEXT, revenue REAL, cost REAL, profit REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    vp.matnr, p.brand, p.category,
    COALESCE(SUM(vp.line_total), 0)::REAL AS revenue,
    COALESCE(SUM(p.cost_price * vp.quantity), 0)::REAL AS cost,
    COALESCE(SUM(vp.line_total) - SUM(p.cost_price * vp.quantity), 0)::REAL AS profit
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  JOIN inventory.products p ON p.sku_id = m.sku_id
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY vp.matnr, p.brand, p.category
  ORDER BY profit DESC LIMIT 20;
END;
$$;

-- analytics_product_match
CREATE OR REPLACE FUNCTION analytics_product_match(p_matnr TEXT)
RETURNS TABLE(
  kunnr TEXT, name TEXT, number TEXT, body_type TEXT,
  pref_brand TEXT, pref_category TEXT,
  prod_brand TEXT, prod_category TEXT, prod_body_type TEXT,
  indicator TEXT, rank INT
) LANGUAGE plpgsql AS $$
DECLARE v_prod inventory.products%ROWTYPE;
BEGIN
  SELECT p.* INTO v_prod
  FROM inventory.mara m
  JOIN inventory.products p ON p.sku_id = m.sku_id
  WHERE m.matnr = p_matnr;

  IF NOT FOUND THEN
    RETURN;
  END IF;

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

-- analytics_overview
CREATE OR REPLACE FUNCTION analytics_overview()
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_total_orders    BIGINT;
  v_total_returns   BIGINT;
  v_total_customers BIGINT;
  v_total_products  BIGINT;
  v_total_revenue   REAL;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE order_type = 'S' AND status = 'CONFIRMED'),
    COUNT(*) FILTER (WHERE order_type = 'R' AND status = 'CONFIRMED')
  INTO v_total_orders, v_total_returns
  FROM transactions.vbak;

  SELECT COUNT(*) INTO v_total_customers FROM customers.kna1;
  SELECT COUNT(*) INTO v_total_products  FROM inventory.products;

  SELECT COALESCE(SUM(vp.line_total), 0)
  INTO v_total_revenue
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED';

  RETURN jsonb_build_object(
    'total_orders',    v_total_orders,
    'total_returns',   v_total_returns,
    'total_customers', v_total_customers,
    'total_products',  v_total_products,
    'total_revenue',   v_total_revenue
  );
END;
$$;

-- analytics_monthly_sales
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

-- analytics_returns_by_month
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

-- analytics_returns_by_reason
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

-- analytics_top_return_customers
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
