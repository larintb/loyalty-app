/**
 * Normaliza un teléfono a formato E.164 sin el +
 * Detecta automáticamente si es número americano (+1) o mexicano (+52)
 * según el prefijo de área.
 *
 * Americanos (+1): 956, 361, 210, 830, 979
 * Mexicanos (+52): 868, 81, 823, 825, 826, 829, 873, 892,
 *                  833, 834, 867, 891, 897, 899, 55, 56
 *
 * "9561234567"  → "19561234567"
 * "8681234567"  → "528681234567"
 * "525512345678" → "525512345678"  (ya normalizado)
 * "19561234567"  → "19561234567"   (ya normalizado)
 */

const US_PREFIXES = ['956', '361', '210', '830', '979']

const MX_PREFIXES = [
  '868', '823', '825', '826', '829', '873', '892',
  '833', '834', '867', '891', '897', '899',
  '81', '55', '56',
]

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  // Ya tiene código de país
  if (digits.startsWith('1') && digits.length === 11) return digits   // +1 USA
  if (digits.startsWith('52') && digits.length === 12) return digits  // +52 MX

  // 10 dígitos — detectar por prefijo
  if (digits.length === 10) {
    if (US_PREFIXES.some((p) => digits.startsWith(p))) return `1${digits}`
    if (MX_PREFIXES.some((p) => digits.startsWith(p))) return `52${digits}`
    // Default: asumir mexicano
    return `52${digits}`
  }

  return digits
}

/**
 * Formatea para mostrar en pantalla
 * "19561234567"  → "+1 (956) 123-4567"
 * "528681234567" → "+52 (868) 123-4567"
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('1') && digits.length === 11) {
    const local = digits.slice(1)
    return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  }

  if (digits.startsWith('52') && digits.length === 12) {
    const local = digits.slice(2)
    return `+52 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }

  // 10 dígitos sin código de país
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return phone
}
