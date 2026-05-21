export type AtsPlatform = 'greenhouse' | 'lever' | 'ashby' | 'other'

export type FieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'file'

export type SemanticType =
  | 'text' | 'email' | 'phone' | 'url' | 'select' | 'file' | 'date' | 'number'

export interface QuestionOption { label: string; value: string }

export interface ApplicationQuestion {
  fieldKey: string
  label: string
  fieldType: FieldType
  semanticType: SemanticType
  required: boolean
  options?: QuestionOption[]
  position: number
  source: 'api' | 'skyvern'
}

export interface ExtractionResult {
  postingKey: string
  questions: ApplicationQuestion[]
}

/** A question plus, if applicable, the value pre-filled from the user's profile. */
export interface PrefilledQuestion extends ApplicationQuestion {
  prefilledValue?: string
  prefilledFromProfile: boolean
}
