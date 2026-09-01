'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { countries, parsePhoneNumber, formatPhoneNumber } from '@/lib/data/countries'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function PhoneInput({
  value,
  onChange,
  placeholder = '123 456 789',
  disabled = false,
  className,
  id,
}: PhoneInputProps) {
  const { dialCode, localNumber } = React.useMemo(() => parsePhoneNumber(value), [value])

  const selectedCountry = React.useMemo(() => {
    return countries.find(c => c.dialCode === dialCode) || countries[0]
  }, [dialCode])

  const handleCountrySelect = (newDialCode: string) => {
    onChange(formatPhoneNumber(newDialCode, localNumber))
  }

  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, spaces, and dashes
    const cleaned = e.target.value.replace(/[^\d\s\-]/g, '')
    onChange(formatPhoneNumber(dialCode, cleaned.replace(/[\s\-]/g, '')))
  }

  // Format the local number for display (add spaces for readability)
  const displayLocalNumber = React.useMemo(() => {
    if (!localNumber) return ''
    // Format as groups of 3 digits
    const digits = localNumber.replace(/\D/g, '')
    const groups = []
    for (let i = 0; i < digits.length; i += 3) {
      groups.push(digits.slice(i, i + 3))
    }
    return groups.join(' ')
  }, [localNumber])

  return (
    <div className={cn('flex items-stretch', className)}>
      {/* Country code selector */}
      <Select
        value={selectedCountry.dialCode}
        onValueChange={handleCountrySelect}
        disabled={disabled}
      >
        <SelectTrigger className="w-[100px] h-10 rounded-r-none border-r-0 shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-sm">{selectedCountry.code}</span>
              <span className="text-muted-foreground text-sm">{selectedCountry.dialCode}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px] w-[260px]">
          {countries.map((country) => (
            <SelectItem
              key={country.code}
              value={country.dialCode}
            >
              <span className="flex items-center gap-2 w-full">
                <span className="font-medium text-sm w-7">{country.code}</span>
                <span className="flex-1 truncate text-sm">{country.name}</span>
                <span className="text-muted-foreground text-xs">{country.dialCode}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Phone number input */}
      <Input
        id={id}
        type="tel"
        placeholder={placeholder}
        value={displayLocalNumber}
        onChange={handleLocalNumberChange}
        disabled={disabled}
        className="rounded-l-none flex-1 h-10"
      />
    </div>
  )
}
