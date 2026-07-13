import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, normalizeEmail } from '@/lib/lead-rules'

export interface DuplicateLead {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: string
  assigned_to: string | null
  assignee: { full_name: string } | { full_name: string }[] | null
}

/**
 * Duplikat = otwarty (nie converted/rejected) lead z tym samym numerem
 * telefonu (po normalizacji: same cyfry, bez prefiksu 48) albo emailem.
 * Szukamy service role'em, żeby agent dostał ostrzeżenie nawet wtedy,
 * gdy duplikat prowadzi ktoś inny (zwykły user nie widzi cudzych leadów).
 */
export async function findDuplicateLead(phone: string | null, email: string | null): Promise<DuplicateLead | null> {
  const normPhone = normalizePhone(phone)
  const normEmail = normalizeEmail(email)
  if (!normPhone && !normEmail) return null

  const admin = createAdminClient()
  const { data: candidates } = await admin
    .from('leads')
    .select('id, name, phone, email, status, assigned_to, assignee:profiles!leads_assigned_to_fkey(full_name)')
    .not('status', 'in', '(converted,rejected)')
    .order('created_at', { ascending: false })
    .limit(500)

  for (const c of (candidates ?? []) as DuplicateLead[]) {
    if (normPhone && normalizePhone(c.phone) === normPhone) return c
    if (normEmail && normalizeEmail(c.email) === normEmail) return c
  }
  return null
}

export function duplicateAssigneeName(dup: DuplicateLead): string | null {
  const a = Array.isArray(dup.assignee) ? dup.assignee[0] : dup.assignee
  return a?.full_name ?? null
}
