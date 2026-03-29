# Refactor UX + Motion Plan (estilo delivery)

## Objetivo
Convertir la app en una experiencia dinámica y moderna, con animaciones suaves, tipografía más profesional para food-tech y feedback de éxito claro: **"Mensaje enviado"**.

## Principios de diseño
- Rápida y confiable: animaciones cortas y con intención.
- Estado visible: toda acción importante muestra transición y resultado.
- Sin saturación: microinteracciones suaves, no efectos exagerados.
- Performance first: animar opacidad y transform para mantener fluidez.

## Fase 1 - Fundación visual y motion
### Entregables
- Tipografía global renovada (headings + body).
- Tokens de motion en CSS (duraciones, easing, keyframes).
- Clases utilitarias para:
  - entrada de pantalla
  - entrada escalonada de cards
  - hover elevación suave
  - overlay de éxito

### Criterios de aceptación
- Navegar entre módulos ya no se percibe estático.
- Los componentes principales tienen entrada suave.

## Fase 2 - POS y confirmación de orden
### Entregables
- Pantalla de confirmación con fondo verde y palomita.
- Secuencia visual de éxito al confirmar venta.
- Botón de WhatsApp con estados:
  - Enviar por WhatsApp
  - Enviando...
  - Mensaje enviado

### Criterios de aceptación
- Confirmar venta muestra un momento de éxito claro.
- Al enviar WhatsApp, el estado final muestra exactamente "Mensaje enviado".

## Fase 3 - Dashboard, reportes y tablas
### Entregables
- Cards con animación de aparición escalonada.
- Grids/listas con transición de entrada.
- Hover y focus states más vivos (sin ruido visual).

### Criterios de aceptación
- Dashboard y reportes se sienten activos y con ritmo visual.

## Fase 4 - Calidad y accesibilidad
### Entregables
- Soporte para prefers-reduced-motion.
- Revisión de contraste y foco visible.
- Validación de rendimiento en móvil y desktop.

### Criterios de aceptación
- UI fluida en dispositivos medios.
- Animaciones respetan accesibilidad.

## Fase 5 - Control y reset de finanzas
### Entregables
- Modelo de periodos financieros (semana/mes) con estado abierto/cerrado.
- Flujo de cierre de periodo con resumen final.
- Flujo de inicio de siguiente periodo con modos:
  - carry_over (arrastrar saldo)
  - zero_base (reiniciar a cero)
- Bloqueo de edición en periodos cerrados y trazabilidad de acciones.

### Criterios de aceptación
- El negocio puede cerrar semana o mes sin borrar historial.
- El siguiente periodo se abre con saldo acumulado o en cero.
- Existe control de permisos para cerrar/reabrir.

## Orden de implementación recomendado
1. Tokens globales (CSS + layout).
2. POS confirmación verde + mensaje enviado.
3. Dashboard y reportes con entradas suaves.
4. Ajustes de performance y accesibilidad.

## Riesgos y mitigación
- Riesgo: animación excesiva en vistas con muchos elementos.
  - Mitigación: usar animación solo en primera aparición y limitar stagger.
- Riesgo: sensación lenta por duraciones largas.
  - Mitigación: rango 180ms a 320ms con easing suave.

## Estado
- [x] Plan creado
- [x] Fase 1 aplicada
- [x] Fase 2 aplicada
- [x] Fase 3 aplicada
- [x] Fase 4 aplicada
- [ ] Fase 5 aplicada

Nota de avance Fase 5:
- MVP mensual implementado (periodos, cierre de mes, apertura de siguiente mes y bloqueo de periodos cerrados).
- Pendiente para cerrar Fase 5 al 100%: reapertura owner-only con auditoria y modo semanal completo.
