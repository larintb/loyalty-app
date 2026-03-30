# Plan Tecnico: Consentimiento de Cliente con Firma

## 1. Objetivo
Implementar un flujo legalmente auditable para que, al registrar un cliente, quede evidencia de:
- Inscripcion al sistema de recompensas.
- Aceptacion de aviso de privacidad.
- Aceptacion de terminos y condiciones.
- Firma capturada en la app.
- Contrato/snapshot firmado almacenado en Supabase.

## 2. Alcance MVP
Incluye:
- Modelo de datos en Supabase (versiones legales, consentimientos, auditoria).
- Flujo UI en registro de cliente con checkboxes + modal de firma.
- Persistencia de firma y contrato snapshot.
- Registro auditable por cliente.

No incluye en MVP:
- Firma avanzada con certificado digital.
- Integracion de proveedor externo de e-signature.
- OCR/biometria.

## 3. Arquitectura
### 3.1 Persistencia
- Tabla `legal_document_versions`: versiones inmutables de textos legales.
- Tabla `customer_consents`: evidencia principal de aceptacion.
- Tabla `customer_consent_events`: bitacora de eventos de auditoria.
- Storage bucket `consent-signatures`: imagen de firma.
- Storage bucket `consent-contracts` (fase 2): PDF final del contrato.

### 3.2 Flujo funcional
1. Staff abre registro de cliente.
2. Completa datos del cliente.
3. Marca checkboxes de consentimiento.
4. Abre modal de firma y captura firma en canvas.
5. Backend genera snapshot del contrato con variables.
6. Backend guarda firma (storage) y consentimiento (DB).
7. Se crea evento de auditoria.

## 4. Modelo de datos (MVP)
### legal_document_versions
- id (uuid pk)
- business_id (uuid, nullable para version global)
- doc_type (privacy_notice | terms_conditions | rewards_terms)
- version_label (ej. v2026-03)
- title
- body_markdown
- content_hash
- effective_from
- is_active
- created_at

### customer_consents
- id (uuid pk)
- business_id (uuid fk businesses)
- customer_id (uuid fk customers)
- signed_by_staff_id (uuid fk staff_members, nullable)
- privacy_version_id (uuid fk legal_document_versions)
- terms_version_id (uuid fk legal_document_versions)
- rewards_version_id (uuid fk legal_document_versions)
- accepted_rewards_program (bool)
- accepted_privacy_notice (bool)
- accepted_terms_conditions (bool)
- signature_path (text)
- contract_snapshot_json (jsonb)
- signed_at (timestamptz)
- signer_name_typed (text)
- signer_phone (text)
- signer_ip (text)
- signer_user_agent (text)
- signer_device (text)
- revoked_at (timestamptz, nullable)
- revoke_reason (text, nullable)
- created_at (timestamptz)

### customer_consent_events
- id (uuid pk)
- consent_id (uuid fk customer_consents)
- event_type (created | exported_pdf | revoked)
- payload_json (jsonb)
- created_at (timestamptz)

## 5. Seguridad y cumplimiento
- RLS habilitado en las 3 tablas.
- Lectura: solo miembros del negocio.
- Escritura: owner/admin para crear y revocar.
- Inmutabilidad: no permitir update libre de snapshot/versiones.
- Si hay cambio legal: nueva version en `legal_document_versions`.

## 6. Plan por fases
## Fase 1 (iniciada)
- [x] Definir plan tecnico.
- [x] Crear migracion inicial de tablas + indices + RLS + seeds legales base.

## Fase 2
- [ ] Extender `register-modal` con checkboxes obligatorios.
- [ ] Modal de firma canvas (limpiar/confirmar).
- [ ] Validacion de firma no vacia antes de submit.

## Fase 3
- [ ] Crear server action para guardar consentimiento + firma.
- [ ] Integrar con registro de cliente en una operacion atomica.
- [ ] Guardar evento `created`.

## Fase 4
- [ ] Vista de consentimiento por cliente.
- [ ] Mostrar fecha de firma y version legal.
- [ ] Link para ver snapshot/archivo.

## Fase 5 (opcional)
- [ ] Generacion PDF del contrato y almacenamiento en `consent-contracts`.
- [ ] Evento `exported_pdf`.

## 7. Riesgos
- Validez legal depende de jurisdiccion.
- Requiere revision legal final del texto contractual.
- Datos personales sensibles: aplicar minimizacion y retencion.

## 8. Criterios de aceptacion MVP
- No se puede registrar cliente sin checkboxes + firma.
- Se guarda 1 registro de consentimiento por alta de cliente.
- Se conserva version legal exacta firmada.
- Existe trazabilidad de evento `created`.
