'use client'

import { PhoneInput } from '@/components/ui/phone-input'

interface PhoneFieldProps {
  /** Single E.164-style string, e.g. "+48511390981". */
  value: string
  onChange: (value: string) => void
  id?: string
  required?: boolean
}

/**
 * Controlled phone input for the auto-apply application form.
 *
 * Thin wrapper over the existing `PhoneInput` primitive, which already pairs a
 * country-code selector with a number input and exposes a single E.164 string.
 */
export function PhoneField({ value, onChange, id }: PhoneFieldProps) {
  return <PhoneInput id={id} value={value} onChange={onChange} />
}
