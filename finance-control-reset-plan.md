# Plan: Control y Reset de Finanzas (Semanal/Mensual)

## Objetivo
Agregar un sistema para controlar periodos financieros y poder cerrar/resetear semana o mes sin perder historial.

## Problema actual
- Las finanzas se guardan como movimientos en `finance_entries`.
- El filtro mensual existe en código, pero no hay concepto formal de cierre de periodo.
- No existe reset controlado ni trazabilidad de quién cerró.

## Enfoque recomendado
Usar **cierres de periodo** (ledger-friendly) en lugar de borrar datos.

- Nunca eliminar movimientos históricos para "resetear".
- Cerrar periodo => congelar resultados.
- Abrir nuevo periodo => arrancar con saldo inicial configurable (carry-over o cero).

---

## Modelo de datos (nueva capa)

### 1) Tabla `finance_periods`
Campos sugeridos:
- `id` uuid pk
- `business_id` uuid fk
- `period_type` text check (`week`, `month`)
- `period_start` date
- `period_end` date
- `status` text check (`open`, `closed`)
- `opening_balance` numeric(12,2) default 0
- `total_income` numeric(12,2) default 0
- `total_expense` numeric(12,2) default 0
- `closing_balance` numeric(12,2) default 0
- `reset_mode` text check (`carry_over`, `zero_base`)
- `closed_by` uuid nullable
- `closed_at` timestamptz nullable
- `created_at` timestamptz default now

Índices/constraints:
- unique (`business_id`, `period_type`, `period_start`, `period_end`)
- index (`business_id`, `status`, `period_type`)

### 2) Extender `finance_entries`
Agregar:
- `period_id` uuid nullable fk -> `finance_periods(id)`
- `locked` boolean default false

Regla:
- Al crear movimiento, asignar automáticamente al periodo abierto correspondiente.

### 3) (Opcional, recomendable) Tabla `finance_period_events`
Auditoría de acciones:
- `event_type`: `opened`, `closed`, `reopened`, `reset_applied`
- `payload` jsonb con resumen
- `actor_user_id`

---

## Reglas de negocio

### Cierre de periodo
- Solo `owner/admin` pueden cerrar.
- Un periodo cerrado no permite edición/eliminación de movimientos.
- Cálculo al cerrar:
  - `total_income` = suma de ingresos del periodo
  - `total_expense` = suma de egresos del periodo
  - `closing_balance = opening_balance + total_income - total_expense`

### Reset para siguiente semana/mes
Ofrecer 2 modos:
1. `carry_over`:
   - Nuevo periodo inicia con `opening_balance = closing_balance` del anterior.
2. `zero_base`:
   - Nuevo periodo inicia con `opening_balance = 0`.

### Reapertura (controlada)
- Permitida solo para `owner`.
- Requiere razón obligatoria.
- Genera evento de auditoría.

---

## UX propuesta

### Pantalla Finanzas
Bloques nuevos:
1. **Selector de periodo**
   - Tipo: semana/mes
   - Navegación: actual, anterior, siguiente
2. **Estado de periodo**
   - Badge: Abierto/Cerrado
   - Resumen: saldo inicial, ingresos, egresos, saldo final
3. **Acciones de control**
   - Botón: "Cerrar periodo"
   - Botón: "Iniciar siguiente" (elige carry_over/zero_base)
   - Botón owner-only: "Reabrir" (si está cerrado)

### Modal de cierre/reset
Mostrar preview antes de confirmar:
- Ingresos del periodo
- Egresos del periodo
- Saldo final proyectado
- Selector de reset mode para próximo periodo

Copia recomendada:
- "Cerrar semana"
- "Cerrar mes"
- "Iniciar siguiente periodo con saldo acumulado"
- "Iniciar siguiente periodo en cero"

---

## API/acciones (server actions)

Agregar en `actions/finance.ts`:
- `getFinancePeriod(params)`
- `getOrCreateOpenPeriod(params)`
- `closeFinancePeriod(payload)`
- `openNextFinancePeriod(payload)`
- `reopenFinancePeriod(payload)` (owner)

Actualizar:
- `createFinanceEntry(...)` para asignar `period_id` y bloquear inserción si no existe periodo abierto.

---

## Migraciones SQL (orden)
1. Crear `finance_periods`.
2. Alter `finance_entries` con `period_id` + `locked`.
3. Backfill histórico:
   - Mapear entradas existentes a periodos mensuales por `date`.
4. Crear índices y constraints.
5. (Opcional) Crear `finance_period_events`.

---

## Seguridad / RLS
- Lectura: staff activo del negocio.
- Escritura/cierre:
  - `cashier`: crear movimientos en periodo abierto.
  - `admin/owner`: cerrar/abrir siguiente.
  - `owner`: reabrir periodo cerrado.

---

## Estrategia de rollout

### Fase A (MVP seguro)
- Cierre mensual manual.
- Apertura siguiente con `carry_over`.
- Sin reapertura.

### Fase B
- Cierre semanal + selector semana/mes.
- Opción `zero_base`.

### Fase C
- Reapertura con auditoría.
- Recordatorios automáticos de cierre.

---

## Riesgos y mitigación
- Riesgo: doble cierre por clicks repetidos.
  - Mitigación: transacción SQL + lock lógico por estado.
- Riesgo: periodos superpuestos.
  - Mitigación: constraint único y validación de rango.
- Riesgo: confusión entre "reset" y borrado.
  - Mitigación: UX explícita: reset no borra historial.

---

## Definición de éxito
- Existe estado de periodo abierto/cerrado.
- Se puede cerrar semana/mes con resumen congelado.
- Se puede abrir siguiente periodo con carry-over o base cero.
- No se pierde historial y hay trazabilidad de cambios.

---

## Estado actual (implementado)
- Migracion de periodos y backfill mensual creada (`004_finance_periods.sql`).
- Enlace obligatorio de `finance_entries` con `period_id` reforzado (`005_enforce_finance_period_id.sql`).
- UI de Finanzas con control de periodo mensual (cerrar mes y abrir siguiente con carry_over/zero_base).
- Bloqueo de movimientos cuando el periodo esta cerrado.
- Si aun no hay ventas, finanzas inicia desde la primera orden registrada.

## Pendiente
- Reapertura de periodo solo owner con motivo y auditoria.
- Soporte completo de periodos semanales en UI y acciones.
