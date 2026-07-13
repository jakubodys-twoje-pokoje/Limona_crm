import type { LeadStatus } from '@/types/database'

// Twarde reguły pipeline'u leadów (źródłem prawdy jest API, nie UI):
//  - status płynie do przodu; cofnięcie tylko o jeden krok (pomyłka),
//  - 'rejected' osiągalny z każdego stanu nie-końcowego,
//  - 'converted' TYLKO przez endpoint /convert (nie przez zwykły PATCH),
//  - stany końcowe (converted/rejected) można opuścić wyłącznie
//    rejected → new (reaktywacja leada), converted jest nieodwracalny.
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'qualified', 'assigned', 'rejected'],
  contacted: ['new', 'qualified', 'assigned', 'rejected'],
  qualified: ['contacted', 'assigned', 'rejected'],
  assigned: ['qualified', 'rejected'],
  converted: [],
  rejected: ['new'],
}

export function validateLeadTransition(from: LeadStatus, to: LeadStatus): string | null {
  if (from === to) return null
  if (to === 'converted') {
    return 'Konwersja tylko przez „Rozbij na nieruchomość i klienta" — nie przez zmianę statusu'
  }
  if (!LEAD_TRANSITIONS[from]?.includes(to)) {
    return `Niedozwolone przejście statusu (${from} → ${to})`
  }
  return null
}

/** Normalizacja numeru telefonu do porównań — same cyfry, bez prefiksu 48. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('48')) digits = digits.slice(2)
  return digits.length >= 7 ? digits : null
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase()
  return e && e.includes('@') ? e : null
}
