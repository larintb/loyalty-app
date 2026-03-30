# 📋 Plan Técnico: Integración de Stripe en Puntaje

**Fecha**: 29 de Marzo 2026  
**Versión**: 1.0  
**Objetivo**: Migrar de MercadoPago a Stripe para suscripciones recurrentes de planes (Inicial/Pro/Premium)

---

## 1. Overview Arquitectura

### 1.1 Componentes Stripe a Usar

```
┌─────────────────────────────────────────┐
│         Frontend (Next.js)              │
│  ┌─────────────────────────────────┐   │
│  │  Stripe.js + React Elements     │   │
│  │  (Card Element, Payment Form)   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓ (HTTPS)
┌─────────────────────────────────────────┐
│    Next.js Server Actions / API         │
│  ┌─────────────────────────────────┐   │
│  │  stripe-node (Backend SDK)      │   │
│  │  - Customers                    │   │
│  │  - SubscriptionS                │   │
│  │  - Invoices                     │   │
│  │  - Webhooks                     │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓ (HTTPS)
┌─────────────────────────────────────────┐
│         Supabase PostgreSQL             │
│  ┌─────────────────────────────────┐   │
│  │  stripe_customers (nuevo)       │   │
│  │  stripe_subscriptions (nuevo)   │   │
│  │  stripe_invoices (nuevo)        │   │
│  │  stripe_webhooks_log (novo)     │   │
│  │  billing_events (audit)         │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓ (Webhook)
┌─────────────────────────────────────────┐
│      Stripe API + Webhooks              │
│  - charge.succeeded                     │
│  - invoice.payment_succeeded            │
│  - customer.subscription.deleted        │
│  - invoice.payment_failed               │
└─────────────────────────────────────────┘
```

### 1.2 Productos Stripe Necesarios

Se crearán **3 productos base** en Stripe (una sola vez, manual):

```
┌─────────────────────────────────────────────────────┐
│ Producto: "Plan Inicial"                           │
│ ├─ SKU: puntaje_inicial                            │
│ ├─ Precio: $599 MXN / mes (recurrente)            │
│ ├─ Price ID: price_1TGS26GDUHsVaasnrWaMWNNI      │
│ └─ Metadata: {plan: "basic", tier: 1}             │
├─────────────────────────────────────────────────────┤
│ Producto: "Puntaje Pro"                             │
│ ├─ SKU: puntaje_pro                                │
│ ├─ Precio: $999 MXN / mes (recurrente)            │
│ ├─ Price ID: price_1TGS2GGDUHsVaasntwuhMi0X       │
│ └─ Metadata: {plan: "growth", tier: 2}            │
├─────────────────────────────────────────────────────┤
│ Producto: "Puntaje Premium"                         │
│ ├─ SKU: puntaje_premium                            │
│ ├─ Precio: $1699 MXN / mes (recurrente)           │
│ ├─ Price ID: price_1TGS2UGDUHsVaasnDkqgfaZG       │
│ └─ Metadata: {plan: "unlimited", tier: 3}         │
└─────────────────────────────────────────────────────┘
```

**Nota**: Estos se crean 1x en Stripe Dashboard y se guardan sus IDs (`price_*`) en variables de entorno.

---

## 2. Cambios Base de Datos

### 2.1 Nueva Migración SQL (020)

```sql
-- 020_stripe_integration.sql

-- 1. Tabla de clientes Stripe
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 2. Tabla de suscripciones Stripe
CREATE TABLE stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL, -- 'basic' (Inicial), 'growth' (Pro), 'unlimited' (Premium)
  stripe_price_id TEXT NOT NULL, -- price_* from Stripe
  status TEXT NOT NULL, -- 'active', 'past_due', 'canceled', 'trialing'
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,
  metadata JSONB, -- tiers, limits etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 3. Tabla de facturas
CREATE TABLE stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT,
  amount_paid INTEGER, -- en centavos
  amount_due INTEGER,
  currency TEXT DEFAULT 'mxn',
  status TEXT, -- 'paid', 'open', 'draft', 'uncollectible'
  paid_at TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  invoice_pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 4. Tabla de webhooks log (audit)
CREATE TABLE stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL, -- 'charge.succeeded', 'invoice.payment_failed', etc.
  stripe_object_id TEXT,
  payload JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla de auditoría (cuando se actualiza plan, estado, etc.)
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'subscription_created', 'plan_upgraded', 'payment_failed', 'subscription_canceled'
  plan_from TEXT,
  plan_to TEXT,
  amount INTEGER, -- en centavos si es relevante
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 6. RLS Policies
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- RLS: Clave foránea con businesses (reemplaza la lógica de auth_id)
CREATE POLICY "Businesses can see their own stripe data"
  ON stripe_customers FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Businesses can see their own subscriptions"
  ON stripe_subscriptions FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Businesses can see their own invoices"
  ON stripe_invoices FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Businesses can see their own billing events"
  ON billing_events FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- 7. UPDATE businesses table
ALTER TABLE businesses 
ADD COLUMN stripe_customer_id TEXT UNIQUE,
ADD COLUMN stripe_subscription_id TEXT UNIQUE,
ADD COLUMN billing_status TEXT DEFAULT 'inactive'; -- 'active', 'trial', 'past_due', 'canceled'
```

---

## 3. Estructura de Carpetas Nuevas

```
loyalty-app/
├── lib/stripe/
│   ├── client.ts          # Cliente Stripe server-side
│   ├── products.ts        # IDs de productos/precios (constantes)
│   ├── webhooks.ts        # Validación de firmas de webhooks
│   └── utils.ts           # Helpers (format prices, status mapping, etc.)
├── actions/
│   ├── billing.ts         # Server actions para suscripciones (NUEVO)
│   └── ... (existentes)
├── app/api/
│   ├── webhooks/
│   │   └── stripe/
│   │       └── route.ts   # Webhook handler POST /api/webhooks/stripe (NUEVO)
│   └── ... (existentes)
└── components/
    └── billing/
        ├── payment-form.tsx          # Formulario de tarjeta (Card Element)
        ├── plan-selector.tsx         # Selector de planes con precios
        ├── subscription-card.tsx     # Card mostrando suscripción actual
        ├── invoice-history.tsx       # Historial de facturas
        └── cancel-subscription.tsx   # Modal para cancelar suscripción
```

---

## 4. Server Actions Nuevas (actions/billing.ts)

### 4.1 `createStripeCustomer(businessId, email, name)`
**Objetivo**: Crear o recuperar cliente en Stripe

**Lógica**:
1. Verificar si business ya tiene `stripe_customer_id`
2. Si no, crear en Stripe: `stripe.customers.create({ email, name, metadata: { business_id } })`
3. Guardar en BD: `stripe_customers` table
4. Retornar `stripe_customer_id`

**Error handling**:
- Si Stripe rechaza: log evento + lanzar error descriptivo
- Si BD falla: rollback stripe?

---

### 4.2 `createSubscription(businessId, planId, paymentMethodId)`
**Objetivo**: Crear suscripción (pago inicial + recurrenta)

**Lógica**:
1. Validar `planId` es válido ('basic', 'growth', 'unlimited')
2. Obtener `stripe_price_id` del mapping (ej: PLAN_PRICES['basic'] = 'price_123abc')
3. Si no existe stripe_customer_id, llamar `createStripeCustomer()`
4. Crear subscription en Stripe:
```typescript
stripe.subscriptions.create({
  customer: stripe_customer_id,
  items: [{ price: stripe_price_id }],
  payment_settings: {
    save_default_payment_method: 'on_subscription',
    payment_method_types: ['card'],
  },
  trial_period_days: 14, // Trial gratis
  metadata: { business_id: businessId, plan_id: planId }
})
```
5. Guardar en BD: `stripe_subscriptions` table
6. Actualizar `businesses` table: `billing_status = 'trialing'`
7. Crear audit event: `billing_events` (type: 'subscription_created')
8. Retornar { success: true, subscription_id }

**Error handling**:
- Card declined: retornar error al FE para retry
- Incompatibilidad de plan: validar antes

---

### 4.3 `updateSubscription(businessId, newPlanId)`
**Objetivo**: Cambiar de plan (upgrade/downgrade)

**Lógica**:
1. Obtener suscripción actual de BD
2. Obtener `new_stripe_price_id`
3. Llamar `stripe.subscriptions.update(stripe_subscription_id, { items: [{ id: subscription_item_id, price: new_stripe_price_id }] })`
4. Actualizar BD (stripe_subscriptions, businesses)
5. Crear audit event (type: 'plan_upgraded'/'plan_downgraded')
6. Retornar success

---

### 4.4 `cancelSubscription(businessId, reason?)`
**Objetivo**: Cancelar suscripción (inmediata o fin de período)

**Lógica**:
1. Obtener suscripción de BD
2. Llamar `stripe.subscriptions.del(stripe_subscription_id, { cancellation_details: { reason: 'cancellation_requested' } })`
3. Actualizar BD: `canceled_at`, `cancel_reason`, `status = 'canceled'`
4. Actualizar businesses: `billing_status = 'canceled'`
5. Crear audit event
6. Retornar success

---

### 4.5 `getActiveSubscription(businessId)`
**Objetivo**: Obtener suscripción activa

**Retorna**: suscripción + próxima renovación + siguiente factura

---

### 4.6 `getInvoices(businessId, limit = 10)`
**Objetivo**: Obtener historial de facturas

**Retorna**: lista de invoices con status, monto, fecha

---

### 4.7 `updatePaymentMethod(businessId, paymentMethodId)`
**Objetivo**: Actualizar método de pago

**Lógica**:
1. Llamar `stripe.customers.update(stripe_customer_id, { invoice_settings: { default_payment_method: paymentMethodId } })`
2. Guardar en BD si necesario
3. Retornar success

---

## 5. API Webhook (app/api/webhooks/stripe/route.ts)

### 5.1 Configuración Webhook en Stripe Dashboard

**URL Endpoint**: `https://tu-dominio.com/api/webhooks/stripe`

**Eventos a escuchar**:
- `charge.succeeded` — Pago exitoso
- `charge.failed` — Pago fallido
- `invoice.payment_succeeded` — Factura pagada
- `invoice.payment_failed` — Factura impagable
- `customer.subscription.created` — Suscripción creada
- `customer.subscription.updated` — Suscripción actualizada
- `customer.subscription.deleted` — Suscripción cancelada
- `customer.deleted` — Cliente eliminado (cleanup)

### 5.2 Handler Lógica

```typescript
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  
  // 1. Validar firma del webhook
  const event = stripe.webhooks.constructEvent(
    body, 
    sig, 
    STRIPE_WEBHOOK_SECRET
  );
  
  if (!event) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // 2. Log en BD (stripe_webhook_events)
  
  // 3. Procesar por event.type:
  switch (event.type) {
    case 'charge.succeeded':
      await handleChargeSucceeded(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handleInvoiceFailed(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    // ... más casos
  }
  
  // 4. Retornar 200 al Stripe (importante para evitar reintentos)
  return Response.json({ received: true }, { status: 200 });
}
```

### 5.3 Handlers Específicos

#### handleChargeSucceeded
1. Obtener business_id de metadata
2. Actualizar businesses.billing_status = 'active'
3. Crear billing_event (type: 'payment_succeeded')
4. Enviar email de recepción de pago (Resend)

#### handleInvoiceFailed
1. Obtener business_id
2. Actualizar businesses.billing_status = 'past_due'
3. Crear billing_event (type: 'payment_failed')
4. Enviar email de alerta de pago fallido
5. Deshabilitar features (ej: campañas WhatsApp) si es necesario

#### handleSubscriptionDeleted
1. Actualizar BD (cancelled_at, status = 'canceled')
2. Actualizar businesses.billing_status = 'canceled'
3. Crear audit event
4. Enviar email de confirmación de cancelación

---

## 6. UI Components Nuevas (components/billing/)

### 6.1 `payment-form.tsx`
- Integra Stripe Elements (Card/Payment Element)
- Valida tarjeta en cliente
- Envía token al servidor (server action)
- Muestra errores/confirmación

### 6.2 `plan-selector.tsx`
- Grid de 3 planes (Inicial/Pro/Premium)
- Muestra precio, features, límites
- Botón "Cambiar plan" → abre `payment-form` si no tiene suscripción
- Botón "Actualizar" si ya tiene suscripción

### 6.3 `subscription-card.tsx`
- Card que muestra suscripción **actual**
  - Plan actual
  - Próxima renovación
  - Estado (activa, en trial, vencida, etc.)
  - Botón "Cambiar plan"
  - Botón "Cancelar suscripción"

### 6.4 `invoice-history.tsx`
- Tabla de facturas descargables
- Columnas: Fecha, periodo, monto, estado, acciones (descargar PDF)
- Paginación

### 6.5 `cancel-subscription.tsx`
- Modal con confirmación
- Campo de razón opcional
- Botón "Darme de baja" con confirmación 2x

---

## 7. Variables de Entorno Necesarias

```bash
# .env.local (desarrollo)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Precios (crear en Stripe Dashboard primero)
NEXT_PUBLIC_STRIPE_PLAN_STARTER_PRICE_ID=price_1TGS26GDUHsVaasnrWaMWNNI
NEXT_PUBLIC_STRIPE_PLAN_PRO_PRICE_ID=price_1TGS2GGDUHsVaasntwuhMi0X
NEXT_PUBLIC_STRIPE_PLAN_PREMIUM_PRICE_ID=price_1TGS2UGDUHsVaasnDkqgfaZG

# Producción
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
```

---

## 8. Flujo de Usuario: Checkout

```
┌─────────────────┐
│  Usuario en     │
│  settings page  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Ver suscripción actual (si      │
│ existe) o selector de planes    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Clickea "Crear suscripción" o   │
│ "Cambiar plan"                  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Modal con Stripe Card Element   │
│ (también datos de empresa)      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Cliente rellena tarjeta + busca │
│ "Confirmar pago"                │
└────────┬────────────────────────┘
         │
         ▼ (llamada a server action)
┌─────────────────────────────────┐
│ createSubscription() server      │
│ ├─ Crear customer Stripe        │
│ ├─ Crear subscription           │
│ ├─ Guardar en BD                │
│ └─ Retornar success             │
└────────┬────────────────────────┘
         │
         ├─ Éxito → show toast "¡Suscripción creada!"
         │           refresh page, mostrar trial
         │
         └─ Error → show error message
              (card errors, etc.)
```

---

## 9. Flujo de Restricciones: Feature Gating

**Para cada feature, antes de mostrar/permitir**:

```typescript
// lib/plan-access.ts (ya existe, ACTUALIZAR)

export function canAccessCampaigns(planId: string, billingStatus: string): boolean {
  // Campaigns solo en Pro+
  if (!['growth', 'unlimited'].includes(planId)) return false;
  // Solo si está pagado
  if (!['active', 'trialing'].includes(billingStatus)) return false;
  return true;
}

export function canAccessReports(planId: string): boolean {
  // Reports en Pro+
  return ['growth', 'unlimited'].includes(planId);
}

export function getCustomerLimit(planId: string): number {
  const limits = {
    basic: 250,
    growth: 1000,
    unlimited: Infinity,
  };
  return limits[planId] ?? 0;
}
```

---

## 10. Cambios en app/(dashboard)/settings/page.tsx

**Nueva sección "Facturación"**:

```tsx
// app/(dashboard)/settings/page.tsx

export default async function SettingsPage() {
  const business = await getBusinessProfile(); // server action
  const subscription = await getActiveSubscription(business.id); // server action
  
  return (
    <div className="space-y-8">
      {/* Sección existente: General, Integraciones, etc. */}
      
      {/* NUEVA: Billing */}
      <Card>
        <CardHeader>
          <CardTitle>Facturación y Planes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {subscription ? (
            <>
              <SubscriptionCard subscription={subscription} />
              <InvoiceHistory businessId={business.id} />
            </>
          ) : (
            <PlanSelector businessId={business.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 11. Testing Checklist

### 11.1 Unit Tests
- [ ] `createStripeCustomer()` maneja respuesta Stripe
- [ ] `createSubscription()` valida plan_id
- [ ] Webhook valida firma correctamente
- [ ] Status mapping (stripe → negocio)

### 11.2 Integration Tests
- [ ] Crear suscripción end-to-end (fixture de Stripe test mode)
- [ ] Webhook trigger actualiza BD
- [ ] Plan upgrade mantiene datos

### 11.3 Manual Tests (Stripe test mode)
- [ ] Crear suscripción con `pk_test_` (USA Stripe test credit card: `4242 4242 4242 4242`)
- [ ] Crear suscripción con card decline (`4000 0000 0000 0002`)
- [ ] Cambiar plan (upgrade/downgrade)
- [ ] Cancelar suscripción
- [ ] Webhook trigger manual desde Stripe Dashboard

---

## 12. Fases de Implementación

### Fase 1: Setup Stripe (1-2 horas)
- [ ] Crear cuenta Stripe
- [ ] Crear 4 productos y precios (manual en Dashboard)
- [ ] Obtener credencial sk_test_ / pk_test_
- [ ] Crear webhook endpoint en Stripe Dashboard

### Fase 2: BD + Backend (3-4 horas)
- [ ] Crear migración SQL (020_stripe_integration.sql)
- [ ] Ejecutar migración en Supabase
- [ ] Crear `lib/stripe/` (client, products, webhooks utils)
- [ ] Crear `actions/billing.ts` (todas las server actions)
- [ ] Crear `app/api/webhooks/stripe/route.ts`

### Fase 3: UI Components (2-3 horas)
- [ ] Crear `components/billing/payment-form.tsx`
- [ ] Crear `components/billing/plan-selector.tsx`
- [ ] Crear `components/billing/subscription-card.tsx`
- [ ] Crear `components/billing/invoice-history.tsx`
- [ ] Crear `components/billing/cancel-subscription.tsx`

### Fase 4: Integración en Settings (1-2 horas)
- [ ] Agregar sección "Facturación" en settings page
- [ ] Conectar componentes con server actions
- [ ] Testing UI (crear suscripción, cambiar plan, etc.)

### Fase 5: Feature Gating (1 hora)
- [ ] Actualizar `lib/plan-access.ts`
- [ ] Agregar checks en componentes (campaigns, reports, etc.)
- [ ] Mostrar "paywalls" cuando necesario

### Fase 6: Email Notifications (1 hora)
- [ ] Integrar Resend (ya está instalado)
- [ ] Templates: subscription_created, payment_failed, invoice_sent
- [ ] Realizar en webhooks + server actions

### Fase 7: Testing + Deployment (2-3 horas)
- [ ] Tests locales con Stripe test mode
- [ ] Webhook trigger manual
- [ ] Deploy a producción con credenciales live
- [ ] Monitoreo de eventos en Stripe Dashboard

---

## 13. Recursos Externos

- **Documentación Stripe**: https://stripe.com/docs
- **Stripe SDK Node.js**: https://github.com/stripe/stripe-node
- **Stripe React Libraries**: https://stripe.com/docs/stripe-js
- **Webhooks**: https://stripe.com/docs/webhooks

---

## 14. Notas Importantes

1. **Trial de 14 días**: Se configura en `createSubscription()` con `trial_period_days: 14`. Durante trial NO se cobra nada.

2. **Moneda**: Usar MXN (pesos mexicanos). Stripe lo maneja nativamente.

3. **Manejo de errores**: Siempre retornar errores descriptivos al FE (card declined, etc.)

4. **Rollback DB**: Si Stripe crea recurso pero BD falla, usar transacciones de Supabase o rollback manual.

5. **Timezone**: Usar `TIMESTAMP WITH TIME ZONE` en BD para consistencia.

6. **Seguridad**:
   - ✅ STRIPE_SECRET_KEY NUNCA en cliente (solo en server)
   - ✅ Validar firma de webhook
   - ✅ RLS policies en BD
   - ✅ Validar ownership de businessId en server actions

7. **Auditoría**: Todos los cambios de plan/facturación quedan en `billing_events` para compliance.

---

## 15. Código Boilerplate: lib/stripe/client.ts

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const PLAN_PRICES = {
  basic: process.env.NEXT_PUBLIC_STRIPE_PLAN_STARTER_PRICE_ID!,
  growth: process.env.NEXT_PUBLIC_STRIPE_PLAN_PRO_PRICE_ID!,
  unlimited: process.env.NEXT_PUBLIC_STRIPE_PLAN_PREMIUM_PRICE_ID!,
};

export const PLAN_NAMES = {
  basic: 'Inicial',
  growth: 'Pro',
  unlimited: 'Premium',
};

export const PLAN_PRICES_MXN = {
  basic: 599,
  growth: 999,
  unlimited: 1699,
};
```

---

**Próximo paso**: ¿Comenzamos con la Fase 1 (Setup Stripe) o prefieres refinamientos en el plan?
