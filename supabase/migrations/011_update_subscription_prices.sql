-- Actualiza precios de planes existentes
UPDATE subscription_plans
SET price_mxn = CASE slug
  WHEN 'basic' THEN 599.00
  WHEN 'growth' THEN 799.00
  WHEN 'unlimited' THEN 999.00
  ELSE price_mxn
END
WHERE slug IN ('basic', 'growth', 'unlimited');
