-- ============================================
-- VISTAS DE ANALYTICS
-- ============================================

-- ============================================
-- Vista: Customer Lifetime Value
-- ============================================
CREATE OR REPLACE VIEW v_customer_clv AS
SELECT
  c.id,
  c.business_id,
  c.name,
  c.phone,
  c.email,
  c.total_points,
  c.lifetime_spend,
  c.visit_count,
  c.last_visit_at,
  c.created_at,
  CASE WHEN c.visit_count > 0
    THEN ROUND(c.lifetime_spend / c.visit_count, 2)
    ELSE 0
  END AS avg_ticket,
  EXTRACT(DAYS FROM NOW() - c.created_at) AS days_as_customer,
  CASE WHEN EXTRACT(DAYS FROM NOW() - c.created_at) > 0
    THEN ROUND((c.lifetime_spend / EXTRACT(DAYS FROM NOW() - c.created_at)) * 365, 2)
    ELSE 0
  END AS projected_clv_12m
FROM customers c
WHERE c.is_active = true;

-- ============================================
-- Vista: Churn Risk
-- ============================================
CREATE OR REPLACE VIEW v_churn_risk AS
SELECT
  c.id,
  c.business_id,
  c.name,
  c.phone,
  c.email,
  c.last_visit_at,
  c.total_points,
  c.visit_count,
  EXTRACT(DAYS FROM NOW() - c.last_visit_at)::INT AS days_inactive,
  CASE
    WHEN EXTRACT(DAYS FROM NOW() - c.last_visit_at) > 60 THEN 'high'
    WHEN EXTRACT(DAYS FROM NOW() - c.last_visit_at) > 30 THEN 'medium'
    ELSE 'low'
  END AS churn_risk
FROM customers c
WHERE c.is_active = true
  AND c.visit_count >= 2
  AND c.last_visit_at IS NOT NULL;

-- ============================================
-- Vista: Top Productos
-- ============================================
CREATE OR REPLACE VIEW v_top_products AS
SELECT
  t.business_id,
  item->>'name'     AS product_name,
  item->>'category' AS category,
  SUM((item->>'quantity')::NUMERIC)                                     AS total_units,
  SUM((item->>'price')::NUMERIC * (item->>'quantity')::NUMERIC)         AS total_revenue,
  COUNT(DISTINCT t.id)                                                   AS transaction_count,
  ROUND(AVG((item->>'price')::NUMERIC), 2)                              AS avg_price
FROM transactions t,
  jsonb_array_elements(t.items) AS item
WHERE t.type = 'sale'
  AND item->>'price' IS NOT NULL
  AND item->>'quantity' IS NOT NULL
GROUP BY t.business_id, product_name, category;

-- ============================================
-- Vista: Resumen financiero mensual
-- ============================================
CREATE OR REPLACE VIEW v_finance_summary AS
SELECT
  business_id,
  date_trunc('month', date)::DATE                               AS month,
  SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END)        AS total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)        AS total_expense,
  SUM(CASE WHEN type = 'income'  THEN amount
           WHEN type = 'expense' THEN -amount
           ELSE 0 END)                                          AS net_profit
FROM finance_entries
GROUP BY business_id, month;

-- ============================================
-- Vista: Dashboard métricas (ventas por día)
-- ============================================
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
  business_id,
  DATE(created_at)            AS sale_date,
  COUNT(*)                    AS transaction_count,
  SUM(total)                  AS total_revenue,
  COUNT(DISTINCT customer_id) AS unique_customers
FROM transactions
WHERE type = 'sale'
GROUP BY business_id, sale_date;
