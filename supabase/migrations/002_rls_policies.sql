-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE businesses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Retorna el business_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM staff_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Retorna el rol del usuario en su negocio
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM staff_members
  WHERE user_id = auth.uid()
    AND business_id = get_user_business_id()
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- POLICIES: subscription_plans (público lectura)
-- ============================================
CREATE POLICY "public_read_plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- ============================================
-- POLICIES: businesses
-- ============================================

-- El owner gestiona su negocio
CREATE POLICY "owner_manage_business"
  ON businesses FOR ALL
  USING (owner_id = auth.uid());

-- Staff puede leer su negocio
CREATE POLICY "staff_read_business"
  ON businesses FOR SELECT
  USING (id = get_user_business_id());

-- ============================================
-- POLICIES: staff_members
-- ============================================

-- Todo el equipo puede verse entre sí
CREATE POLICY "staff_read_own_team"
  ON staff_members FOR SELECT
  USING (business_id = get_user_business_id());

-- Solo admin/owner gestiona staff
CREATE POLICY "admin_manage_staff"
  ON staff_members FOR ALL
  USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================
-- POLICIES: customers
-- ============================================

-- Todo el staff puede leer clientes de su negocio
CREATE POLICY "staff_read_customers"
  ON customers FOR SELECT
  USING (business_id = get_user_business_id());

-- Todo el staff puede registrar clientes
CREATE POLICY "staff_create_customers"
  ON customers FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

-- Todo el staff puede actualizar clientes (POS necesita update visit_count etc.)
CREATE POLICY "staff_update_customers"
  ON customers FOR UPDATE
  USING (business_id = get_user_business_id());

-- Solo admin/owner puede eliminar (soft-delete via is_active)
CREATE POLICY "admin_delete_customers"
  ON customers FOR DELETE
  USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================
-- POLICIES: transactions
-- ============================================

-- Todo el staff ve y crea transacciones
CREATE POLICY "staff_read_transactions"
  ON transactions FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "staff_create_transactions"
  ON transactions FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

-- Solo admin/owner puede modificar/eliminar
CREATE POLICY "admin_manage_transactions"
  ON transactions FOR UPDATE
  USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================
-- POLICIES: points_ledger
-- ============================================

-- Todo el staff puede leer el ledger
CREATE POLICY "staff_read_points_ledger"
  ON points_ledger FOR SELECT
  USING (business_id = get_user_business_id());

-- Inserción permitida a cualquier staff autenticado (server actions validan)
CREATE POLICY "staff_insert_points_ledger"
  ON points_ledger FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

-- ============================================
-- POLICIES: finance_entries
-- ============================================

-- Solo admin/owner ve finanzas
CREATE POLICY "admin_read_finance"
  ON finance_entries FOR SELECT
  USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "admin_create_finance"
  ON finance_entries FOR INSERT
  WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "admin_update_finance"
  ON finance_entries FOR UPDATE
  USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "admin_delete_finance"
  ON finance_entries FOR DELETE
  USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'admin')
  );
