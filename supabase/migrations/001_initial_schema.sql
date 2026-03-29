-- ============================================
-- EXTENSIONES
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: subscription_plans
-- ============================================
CREATE TABLE subscription_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE, -- 'basic' | 'growth' | 'unlimited'
  price_mxn     NUMERIC(10,2) NOT NULL,
  max_customers INT,                  -- NULL = ilimitado
  features      JSONB DEFAULT '[]',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed de planes
INSERT INTO subscription_plans (name, slug, price_mxn, max_customers, features) VALUES
  ('Básico',      'basic',     349.00,  100,  '["POS","Tickets WhatsApp","Puntos básicos"]'),
  ('Crecimiento', 'growth',    899.00,  500,  '["POS","Tickets WhatsApp/Email","Puntos avanzados","Finanzas","Reportes"]'),
  ('Ilimitado',   'unlimited', 1799.00, NULL, '["Todo lo anterior","Campañas","Multi-sucursal","Soporte prioritario"]');

-- ============================================
-- TABLA: businesses
-- ============================================
CREATE TABLE businesses (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  phone                TEXT,
  email                TEXT,
  logo_url             TEXT,
  address              TEXT,
  points_config        JSONB DEFAULT '{
    "earn_rate": 1,
    "earn_per_amount": 100,
    "redeem_rate": 1,
    "redeem_value": 1,
    "min_redeem_points": 50,
    "expiry_days": 365,
    "welcome_bonus": 10
  }'::jsonb,
  plan_id              UUID REFERENCES subscription_plans(id),
  plan_status          TEXT DEFAULT 'trialing'
                         CHECK (plan_status IN ('trialing','active','past_due','cancelled')),
  trial_ends_at        TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  current_period_end   TIMESTAMPTZ,
  mp_subscription_id   TEXT,
  mp_customer_id       TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: staff_members
-- ============================================
CREATE TABLE staff_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'cashier'
                CHECK (role IN ('owner','admin','cashier')),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  invited_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

-- ============================================
-- TABLA: customers
-- ============================================
CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone          TEXT NOT NULL,
  name           TEXT NOT NULL,
  email          TEXT,
  birthday       DATE,
  notes          TEXT,
  total_points   INT DEFAULT 0 CHECK (total_points >= 0),
  lifetime_spend NUMERIC(12,2) DEFAULT 0,
  visit_count    INT DEFAULT 0,
  last_visit_at  TIMESTAMPTZ,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, phone)
);

-- ============================================
-- TABLA: transactions
-- ============================================
CREATE TABLE transactions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id        UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id        UUID REFERENCES customers(id) ON DELETE SET NULL,
  staff_id           UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  type               TEXT NOT NULL CHECK (type IN ('sale','refund','exchange')),
  subtotal           NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount           NUMERIC(12,2) DEFAULT 0,
  points_redeemed    INT DEFAULT 0,
  discount_by_points NUMERIC(12,2) DEFAULT 0,
  total              NUMERIC(12,2) NOT NULL,
  items              JSONB DEFAULT '[]',
  -- items: [{ name, category, price, quantity, unit }]
  ticket_number      TEXT UNIQUE,
  ticket_sent_via    TEXT[],
  ticket_url         TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: points_ledger (append-only, nunca UPDATE)
-- ============================================
CREATE TABLE points_ledger (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  type           TEXT NOT NULL
                   CHECK (type IN ('earn','redeem','expire','adjust','welcome')),
  points_delta   INT NOT NULL,   -- positivo = suma, negativo = resta
  balance_after  INT NOT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: finance_entries
-- ============================================
CREATE TABLE finance_entries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id       UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('income','expense')),
  category       TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL,
  description    TEXT,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================
CREATE INDEX idx_customers_business     ON customers(business_id);
CREATE INDEX idx_customers_phone        ON customers(business_id, phone);
CREATE INDEX idx_customers_last_visit   ON customers(business_id, last_visit_at);
CREATE INDEX idx_transactions_business  ON transactions(business_id, created_at DESC);
CREATE INDEX idx_transactions_customer  ON transactions(customer_id, created_at DESC);
CREATE INDEX idx_points_ledger_customer ON points_ledger(customer_id, created_at DESC);
CREATE INDEX idx_finance_business_date  ON finance_entries(business_id, date DESC);
CREATE INDEX idx_staff_user             ON staff_members(user_id);

-- ============================================
-- SEQUENCE para ticket numbers
-- ============================================
CREATE SEQUENCE ticket_seq;

-- ============================================
-- TRIGGER: ticket_number auto-generado
-- ============================================
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TK-' ||
    TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(NEXTVAL('ticket_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION generate_ticket_number();

-- ============================================
-- TRIGGER: capacidad de clientes por plan
-- ============================================
CREATE OR REPLACE FUNCTION check_customer_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_customers INT;
  v_plan_status   TEXT;
  v_current_count BIGINT;
BEGIN
  SELECT sp.max_customers, b.plan_status
  INTO v_max_customers, v_plan_status
  FROM businesses b
  LEFT JOIN subscription_plans sp ON sp.id = b.plan_id
  WHERE b.id = NEW.business_id;

  IF v_plan_status NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'subscription_inactive';
  END IF;

  IF v_max_customers IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM customers
    WHERE business_id = NEW.business_id AND is_active = true;

    IF v_current_count >= v_max_customers THEN
      RAISE EXCEPTION 'capacity_exceeded:% limit:%', v_current_count, v_max_customers;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_customer_capacity
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION check_customer_capacity();

-- ============================================
-- TRIGGER: updated_at automático
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- TRIGGER: sincronizar total_points en customers
-- ============================================
CREATE OR REPLACE FUNCTION sync_customer_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
  SET total_points = NEW.balance_after,
      updated_at   = NOW()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_points_after_ledger
  AFTER INSERT ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION sync_customer_points();
