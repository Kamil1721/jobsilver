import type { FieldType, SemanticType } from './types'

/** Infer a semantic type from a field's key, label, and base field type. */
export function classifySemanticType(
  fieldKey: string,
  label: string,
  fieldType: FieldType,
): SemanticType {
  if (fieldType === 'select' || fieldType === 'multiselect') return 'select'
  if (fieldType === 'file') return 'file'
  const hay = `${fieldKey} ${label}`.toLowerCase()
  if (/\bemail\b/.test(hay)) return 'email'
  if (/\bphone\b|\bmobile\b|\btelephone\b/.test(hay)) return 'phone'
  if (/linkedin|github|portfolio|website|\burl\b/.test(hay)) return 'url'
  if (/\bdate\b/.test(hay)) return 'date'
  return 'text'
}
