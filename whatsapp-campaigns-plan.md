# Plan: Vista de Campañas Publicitarias por WhatsApp (Anti-Spam)

## 1. Objetivo
Crear una vista de campañas en el dashboard para enviar mensajes masivos por WhatsApp a clientes segmentados, cuidando la reputación del número y evitando prácticas de spam.

## 2. Principios clave (no negociables)
- Valor primero: cada campaña debe ofrecer beneficio claro para el cliente.
- Consentimiento explícito (opt-in) para mensajes promocionales.
- Baja fácil (opt-out) con palabras como ALTO, STOP, BAJA.
- Frecuencia limitada por cliente para prevenir fatiga.
- Envío por lotes (throttling), no blast instantáneo.
- Trazabilidad total: a quién se envió, cuándo, resultado y motivo de bloqueo.

## 3. Alcance funcional de la nueva vista
Ruta sugerida: `/campaigns`

### 3.1 Módulos de la vista
1. Resumen
- Campañas activas, programadas, finalizadas y pausadas.
- Enviados hoy, entregados, errores, bloqueados por reglas.
- Semáforo de salud del canal (verde/amarillo/rojo).

2. Crear campaña (wizard)
- Paso 1: Audiencia
- Paso 2: Mensaje
- Paso 3: Reglas de seguridad
- Paso 4: Programación
- Paso 5: Confirmación y lanzamiento

3. Historial de campañas
- Lista con estado, fecha, tamaño de audiencia, resultados.
- Acciones: ver detalle, pausar, duplicar, cancelar.

4. Detalle de campaña
- Funnel: elegibles -> bloqueados por regla -> encolados -> enviados -> entregados -> fallidos.
- Tabla de destinatarios con motivo de exclusión/fallo.

## 4. Wizard de creación de campaña

### Paso 1: Audiencia
- Segmentos iniciales (MVP):
  - Clientes con saldo de puntos mayor a X.
  - Clientes inactivos (sin compra en N días).
  - Clientes con visitas mayores a X.
- Exclusiones obligatorias:
  - Sin opt-in.
  - En lista de supresión.
  - Ya contactados en ventana de enfriamiento (cooldown).
- Mostrar conteo estimado en tiempo real.

### Paso 2: Mensaje
- Plantillas predefinidas (recomendado en MVP).
- Variables permitidas: nombre, saldo de puntos, nombre negocio.
- Preview antes de enviar.
- Reglas de copy:
  - Mensajes cortos y claros.
  - 1 CTA por mensaje.
  - Evitar exceso de emojis, mayúsculas y signos.

### Paso 3: Reglas de seguridad
- Frecuencia por cliente (ejemplo: max 1 promo cada 72h).
- Quiet hours (ejemplo: 09:00-20:00 hora local).
- Límite diario por negocio (ejemplo: 200 mensajes día en warm-up).
- Dedupe por campaña para no repetir al mismo cliente.

### Paso 4: Programación
- Enviar ahora o agendar.
- Horario recomendado basado en engagement histórico (fase posterior).
- Confirmar zona horaria del negocio.

### Paso 5: Confirmación
- Resumen final:
  - Audiencia total.
  - Bloqueados por regla.
  - Estimado a enviar.
- Checklist de cumplimiento antes de confirmar.

## 5. Modelo de datos propuesto

### 5.1 `marketing_campaigns`
- `id`
- `business_id`
- `name`
- `objective` (reactivacion, fidelizacion, promo, etc.)
- `status` (draft, scheduled, running, paused, completed, cancelled, failed)
- `segment_json`
- `rules_json`
- `template_name`
- `message_body`
- `scheduled_at`
- `started_at`
- `finished_at`
- `created_by`
- `created_at`
- `updated_at`

### 5.2 `marketing_campaign_recipients`
- `id`
- `campaign_id`
- `customer_id`
- `phone`
- `status` (blocked, queued, sent, delivered, failed, opted_out)
- `blocked_reason`
- `provider_message_id`
- `attempt_count`
- `last_attempt_at`
- `sent_at`
- `created_at`

### 5.3 `marketing_campaign_events`
- `id`
- `campaign_id`
- `recipient_id`
- `event_type` (queued, sent, delivered, failed, replied, opted_out)
- `payload_json`
- `created_at`

### 5.4 `customer_marketing_prefs`
- `customer_id` (PK/FK)
- `whatsapp_opt_in` (bool)
- `opt_in_source`
- `opt_in_at`
- `whatsapp_opt_out_at`
- `last_marketing_sent_at`
- `timezone`

### 5.5 `whatsapp_suppression_list`
- `id`
- `business_id`
- `phone`
- `reason`
- `source` (manual, keyword, provider)
- `created_at`

## 6. Reglas anti-spam (servidor)
Validar SIEMPRE antes de encolar y antes de enviar:
1. Cliente con `whatsapp_opt_in = true`.
2. Cliente no presente en `whatsapp_suppression_list`.
3. No superar frecuencia por cliente (`last_marketing_sent_at + cooldown`).
4. Respetar quiet hours del negocio.
5. Respetar límite diario del negocio.
6. Dedupe por campaña y por ventana temporal.

Si falla una validación, registrar `blocked` con `blocked_reason`.

## 7. Motor de envío (orquestación)
1. Crear campaña en estado `draft`.
2. Al lanzar:
- Resolver audiencia.
- Aplicar reglas y generar recipients (`blocked` o `queued`).
3. Worker procesa `queued` en lotes pequeños.
4. Enviar mensaje via cliente existente de WhatsApp (`lib/whatsapp/client.ts`).
5. Guardar resultado por recipient y evento.
6. Actualizar métricas agregadas de campaña.
7. Si supera umbral de error/bloqueo, pausar automáticamente.

## 8. Métricas clave
- Total elegibles.
- Total bloqueados (por tipo de regla).
- Tasa de envío exitoso.
- Tasa de entrega.
- Tasa de fallo.
- Tasa de respuesta.
- Tasa de opt-out.
- Conversión comercial (cuando exista atribución a venta/canje).

## 9. UX/UI propuesta (alineada al dashboard actual)
- Tarjetas KPI en la parte superior.
- Tabla de campañas recientes con filtros por estado/fecha.
- Botón principal: "Nueva campaña".
- Wizard en modal grande o vista dedicada.
- Estados con badges claros: Draft, Programada, En curso, Pausada, Finalizada, Fallida.
- Confirmaciones y errores con toasts consistentes.

## 10. Permisos y seguridad
- Owner/Admin: crear, editar, lanzar, pausar y cancelar campañas.
- Cashier: solo lectura (opcional según negocio).
- RLS por `business_id` en todas las tablas nuevas.
- Sanitización de variables de plantilla para evitar inyección de contenido.

## 11. Plan por fases

### Fase 1 (MVP seguro)
- Nueva ruta `/campaigns`.
- Modelo de datos base (5 tablas).
- Crear campaña manual simple.
- Segmentación básica (inactivos y puntos altos).
- Envío por lotes con guardrails anti-spam.
- Historial y detalle básico de resultados.

### Fase 2 (optimización)
- Programación avanzada.
- Más segmentos y filtros combinables.
- Pausa automática por riesgo.
- Reintentos inteligentes para fallos temporales.

### Fase 3 (escala)
- A/B testing de copy.
- Recomendación de mejor hora de envío.
- Scoring de fatiga por cliente.
- Atribución de ventas/canjes por campaña.

## 12. Checklist de salida a producción
- Variables WHAPI configuradas por ambiente.
- Pruebas de límites y opt-out.
- Prueba en muestra pequeña (5-10%) antes del envío total.
- Logs y alertas de error operativas.
- Documentación operativa para equipo (playbook de campañas).

## 13. Riesgos y mitigación
- Riesgo: aumento de bloqueos por volumen alto.
  - Mitigación: warm-up progresivo y límites diarios.
- Riesgo: usuarios molestos por frecuencia.
  - Mitigación: cooldown estricto + segmentación relevante.
- Riesgo: mensajes fuera de horario.
  - Mitigación: quiet hours por zona horaria.
- Riesgo: datos de consentimiento incompletos.
  - Mitigación: opt-in obligatorio y auditoría de fuente.

## 14. Siguiente paso recomendado
Implementar Fase 1 con una primera entrega técnica:
1. Migración SQL de tablas de campañas.
2. Server actions para crear campaña, listar y lanzar.
3. Página `/campaigns` con resumen + tabla + botón "Nueva campaña".
4. Worker simple para envío por lotes con validaciones anti-spam.
