# Plan: Sistema de Productos Canjeables por Puntos

## Objetivo
Permitir que los negocios creen un catálogo de productos/servicios que se pueden canjear directamente por puntos en el POS. Los clientes pueden "comprar" estos productos usando sus puntos acumulados con un simple tap.

Ej: "☕ Café (100 pts)", "🍪 Galletas (50 pts)", "🍕 Pizza Gratis (500 pts)"

## Problema actual
- Los clientes solo pueden redimir puntos como descuento en dinero
- No hay forma de ofrecer "premios" o productos gratis usando puntos
- El cajero no tiene forma rápida de registrar canjes de productos

## Enfoque recomendado
Sistema de "productos canjeables" con tap rápido en POS

- Cada producto canjeable tiene:
  - Nombre (Ej: "Café Gratis", "Galletas Premium")
  - Costo en puntos (Ej: 100, 500, 1000)
  - Ícono/color para identificación visual rápida
  - Stock opcional (si el negocio quiere limitar disponibilidad)
  
- En POS:
  - Botones "tap rápido" para cada producto canjeable activo
  - Al tocar: sistema valida que el cliente tenga puntos suficientes
  - Si valida: descuenta puntos + registra redención
  - Feedback visual clara del canje realizado

---

## Modelo de datos

### 1) Tabla `redeemable_products`
Campos sugeridos:
```sql
CREATE TABLE redeemable_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Configuración básica
  name TEXT NOT NULL,                      -- Ej: "Café Gratis", "Galletas Premium"
  description TEXT,                        -- Descripción (Ej: "Café expreso pequeño")
  
  -- Costo en puntos
  points_cost INTEGER NOT NULL,            -- Ej: 100, 500, 1000
  
  -- Configuración visual
  color TEXT DEFAULT '#3B82F6',           -- Color Tailwind (hex)
  icon_name TEXT DEFAULT 'gift',          -- Icon de lucide-react
  emoji TEXT,                              -- Emoji opcional (Ej: "☕", "🍪")
  
  -- Disponibilidad y stock
  is_active BOOLEAN DEFAULT TRUE,
  has_stock BOOLEAN DEFAULT FALSE,         -- ¿tiene limite de stock?
  stock_quantity INTEGER,                  -- Cantidad disponible (null si no tiene limite)
  
  -- Control de uso
  max_redeems_per_day INTEGER,            -- Máximo de canjes diarios (null = ilimitado)
  max_redeems_per_customer INTEGER,       -- Máximo por cliente (null = ilimitado)
  
  -- Auditoría
  created_by UUID NOT NULL REFERENCES staff_members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT business_product_name_unique UNIQUE(business_id, name)
);

-- Índices
CREATE INDEX idx_redeemable_products_business_active 
  ON redeemable_products(business_id, is_active);
```

### 2) Tabla `redemptions` (Auditoría de canjes)
```sql
CREATE TABLE redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  redeemable_product_id UUID NOT NULL REFERENCES redeemable_products(id),
  
  -- Snapshot del producto al redimirlo
  product_name TEXT NOT NULL,
  points_deducted INTEGER NOT NULL,
  
  -- Contexto
  redeemed_by_user_id UUID REFERENCES staff_members(id),
  notes TEXT,                              -- Notas adicionales (Ej: sin azúcar)
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para búsquedas rápidas
CREATE INDEX idx_redemptions_business_customer 
  ON redemptions(business_id, customer_id);
CREATE INDEX idx_redemptions_product 
  ON redemptions(redeemable_product_id);
```

### 3) Extender `points_ledger`
Agregar nueva razón en ledger_type:
- `'redeem_product'` - cuando se canjea un producto (además de 'redeem')

---

## Reglas de negocio

### Creación de productos canjeables
- Solo `owner/admin` pueden crear/editar productos
- Mínimo 0, máximo 15 productos activos por negocio
- Cada producto tiene un costo en puntos fijo (no variable)

### Redención en POS
- Cliente debe tener **puntos suficientes** para canjear
- Si canjeables + stock habilitado: restar del inventory
- Registrar en tabla `redemptions` para auditoría + historial
- No se puede canjear producto si:
  - Ya alcanzó `max_redeems_per_day` globales
  - Ya alcanzó `max_redeems_per_customer` para ese cliente
  - Stock = 0 (si tiene stock habilitado)

### Deducción de puntos
- Automática y validada: cliente.total_points >= product.points_cost
- Se registra en `points_ledger` con tipo `'redeem_product'`
- Se crea entry en `redemptions` para auditoría

### Restricciones opcionales
- `max_redeems_per_day`: limita cuántas veces se puede canjear ese producto en el día (globalmente)
- `max_redeems_per_customer`: limita cuántas veces un cliente individual puede canjear ese producto
- `stock_quantity`: si habilitado, limita entregas disponibles

---

## UX propuesta

### Pantalla Settings → Productos Canjeables
**Ubicación:** Settings > Productos o Descuentos → nueva sub-sección "Canjeables"

**Estado: Lista de productos**
- Tabla/Cards con:
  - Ícono + Emoji + Nombre
  - Costo en puntos
  - Stock disponible (si habilitado)
  - ¿Activo? (toggle)
  - Acciones: Editar, Duplicar, Eliminar

- Botón: "+ Nuevo producto canjeable"

**Modal: Crear/Editar producto canjeable**
- Campo: Nombre (requerido) - Ej: "Café Gratis"
- Campo: Descripción (opcional) - Ej: "Expreso pequeño, sin azúcar"
- Campo: Costo en puntos (requerido) - Ej: 100
- Selector: Emoji (búsqueda rápida)
- Selector: Color (palette de 8 colores)
- Selector: Ícono lucide-react
- Toggle: ¿Tener stock? 
  - Si SÍ: Campo para cantidad inicial
- Campo: Max canjes/día (numeral, null = ilimitado)
- Campo: Max canjes por cliente (numeral, null = ilimitado)
- Toggle: ¿Activo?
- Botón guardar + validaciones

---

### Pantalla POS - Sección: "Canjeables por Puntos"
**Ubicación:** Arriba de los campos de total, después de la búsqueda de cliente

**Estado: Sin cliente seleccionado**
- Mensaje: "Selecciona un cliente para canjeables"
- Botones deshabilitados (grayed out)

**Estado: Con cliente seleccionado**
- Mostrar puntos disponibles del cliente: "💰 500 puntos disponibles"
- Grid/scroll horizontal de botones:
  - Por cada producto canjeable **activo** y con **puntos suficientes**:
    - Botón con:
      - Emoji + Nombre + Costo en puntos
      - Color personalizado
      - Ej: "☕ Café (100 pts)"
    - Al TAP:
      - ✅ Animación visual (glow + scale)
      - Usuario ve:"¡Canjeo exitoso! Puntos disponibles: 400"
      - Registra redención automáticamente
      - Detalles: "Redención: Café Gratis - 100 pts"
  
  - Productos con **puntos insuficientes**:
    - Botón deshabilitado (opaco) con label: "100 pts (necesita X más)"

**Feedback después de canje**
- Toast: "☕ Café canjeado - 100 pts descontados"
- (Opcional) Audio/vibración suave de confirmación
- Actualizar puntos disponibles en tiempo real

**Historial de canjes (en esta venta)**
- Mostrar bajo los botones:
  - "Canjeados en esta venta:" 
  - Lista: "☕ Café -100 pts", "🍪 Galletas -50 pts"
  - Total descontado: -150 pts

---

## Fases de implementación

### Fase 1 - Backend: Modelo + APIs
**Entregables:**
1. Crear tabla `redeemable_products` y `redemptions`
2. Crear Server Actions en `actions/redeemable.ts`:
   - `createRedeemableProduct()` - POST
   - `updateRedeemableProduct()` - PATCH
   - `deleteRedeemableProduct()` - DELETE
   - `getBusinessRedeemables()` - GET
   - `redeemProduct()` - Lógica de canje + validación + auditoría

3. Actualizar tipos TypeScript
4. RLS policies para redeemable_products y redemptions
5. Extender `points_ledger` con tipo `'redeem_product'`

**Criterios de aceptación:**
- BD lista y testeada con data de prueba
- Validaciones: puntos suficientes, stock, límites diarios
- Auditoría se registra correctamente en `redemptions`
- Deducción de puntos funciona

### Fase 2 - Frontend: Settings UI
**Entregables:**
1. Nueva sección en Settings: "Productos Canjeables"
2. Componente `RedeemablesList` - lista de productos
3. Modal `CreateEditRedeemableModal` - crear/editar con validaciones
4. Integración con Server Actions
5. Toast feedback (creado, actualizado, eliminado, duplicado)

**Criterios de aceptación:**
- CRUD completo funcional
- Validaciones claras (nombre duplicado, campos requeridos, puntos válidos)
- UX smooth sin lag
- Stock se actualiza correctamente

### Fase 3 - Frontend: POS Integration
**Entregables:**
1. Componente `RedeemablesButtons` - botones tapeable por producto
2. Lógica de validación antes de canje (puntos suficientes, stock, límites)
3. Display de "Puntos disponibles"
4. Historial de canjes en esta venta
5. Feedback visual (animaciones, colores, toast)
6. Actualización de saldo de puntos en tiempo real

**Criterios de aceptación:**
- Botones se activan/desactivan según puntos disponibles
- Canje funciona sin errores
- Auditoría se registra
- Interfaz es intuitiva

### Fase 4 - Reportes y Auditoría (Opcional pero recomendable)
**Entregables:**
1. Endpoint: obtener historial de canjes (`redemptions`)
2. Reportes básicos:
   - Productos más canjeados
   - Total de puntos redimidos por día/semana/mes
   - Clientes con más canjes

**Criterios de aceptación:**
- Datos de auditoría precisos
- Reportes son útiles para el negocio

---

## Ejemplo de flujo de uso

### Escenario: Canjear un Café con Puntos

**Setup en Settings:**
1. Owner crea producto canjeable:
   - Nombre: "☕ Café Gratis"
   - Puntos: 100
   - Emoji: ☕
   - Color: Naranja (#F97316)
   - Stock: no habilitado
   - Max canjes/día: null (ilimitado)

2. Owner activa el producto

**En POS:**
1. Cajero busca cliente por teléfono → "Juan López"
2. Sistema muestra: "💰 500 puntos disponibles"
3. Botones de productos aparecen:
   - ☕ Café (100 pts) ← color naranja
   - 🍪 Galletas (50 pts)
   - 🍕 Pizza (500 pts)
4. Cajero toca botón "☕ Café"
5. Validación:
   - ✅ Cliente tiene 500 pts (necesita 100)
   - ✅ Producto está activo
   - ✅ No hay límite de canjes diarios alcanzado
6. Sistema registra:
   - Deduce 100 pts → Juan López tiene 400 pts
   - Crea entry en `redemptions` con fecha/hora
   - Crea entry en `points_ledger` tipo `'redeem_product'`
7. Feedback inmediato:
   - Toast: "☕ Café canjeado! (100 pts)"
   - Actualiza display: "💰 400 puntos disponibles"
   - Muestra en historial: "Canjeados: ☕ Café -100 pts"
8. Cajero puede canjear más productos o confirmar la venta

---

## Riesgos y mitigación

| Riesgo | Mitigación |
|--------|-----------|
| Cliente no tiene puntos suficientes | Botón deshabilitado (grayed out) con label de puntos requeridos |
| Producto sin stock se canjea | Validar stock > 0 antes de canje; descontar inventory |
| Same producto se canjea 2x simultáneamente | Race condition: usar transacción BD con lock |
| Muchos productos se ven cluttered | Mostrar solo activos; scroll horizontal o modal con búsqueda |
| Auditoría no se registra | Registrar en `redemptions` transaccionalmente con puntos_ledger |
| El negocio crea 100 productos | Limitar a 30 productos por negocio (como recomendación) |
| Stock se actualiza mal en multi-venta | Usar transacciones BD; increment/decrement seguro |

---

## Orden de implementación recomendado

1. ✅ **(Este plan) Documentación y validación**
2. 🚀 **Fase 1**: Migraciones SQL + Server Actions (`actions/redeemable.ts`)
3. 🚀 **Fase 2**: Settings UI (crear/editar/listar productos canjeables)
4. 🚀 **Fase 3**: POS buttons + lógica (canje de productos)
5. 🚀 **Fase 4**: Reportes y auditoría (historia de canjes)

---

## Estimación de esfuerzo

| Fase | T-Shirt | Horas |
|------|---------|-------|
| Fase 1 (BD + APIs) | M | 3-4h |
| Fase 2 (Settings UI) | M | 4-5h |
| Fase 3 (POS UI + lógica) | M | 4-5h |
| Fase 4 (Reportes) | S | 2-3h |
| **Total** | **~3-4 días** | **13-17h** |

---

## Estado
- [x] Plan creado - Sistema de productos canjeables por puntos
- [ ] Fase 1: Migraciones SQL + Server Actions
- [ ] Fase 2: Settings UI para gestionar productos
- [ ] Fase 3: POS Integration - botones de canje
- [ ] Fase 4: Auditoría + Reports

## Notas finales
- Sistema es **independiente** del sistema de puntos existente: simple integración
- Es **aditivo**: no reemplaza puntos_ledger, solo lo extiende
- **Seguridad**: validaciones en BD + RLS policies
- **Escalable**: soporta multi-negocio sin problemas
- **Intuitivo**: tap = canje inmediato, sin complejidad
- **Auditable**: cada canje es registrado con fecha/hora/usuario/cliente para reportes
