import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskKind } from '@/types/database'

export const TASK_KINDS: TaskKind[] = ['zwykle', 'prawne']

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  zwykle: 'Zadanie',
  prawne: 'Zadanie prawne',
}

/** Krótka etykieta do plakietek na kartach zadań */
export const TASK_KIND_SHORT: Record<TaskKind, string> = {
  zwykle: 'Zwykłe',
  prawne: 'Prawne',
}

export function isLegalTask(kind: string | null | undefined): boolean {
  return kind === 'prawne'
}

/** Normalizuje rodzaj z requestu — nieznana wartość spada do 'zwykle' */
export function normalizeTaskKind(value: unknown): TaskKind {
  return value === 'prawne' ? 'prawne' : 'zwykle'
}

/**
 * Osoby przypisane do nieruchomości (opiekun + dodatkowi opiekunowie).
 * Zadanie prawne ma być widoczne dla opiekuna nieruchomości, więc przy
 * tworzeniu/oznaczaniu zadania jako prawne dopisujemy ich do
 * współwykonawców — dzięki temu zwykłe filtry widoczności zadań wystarczą
 * i nie trzeba dokładać zapytań przy każdym listowaniu.
 */
export async function propertyOwnerIds(
  supabase: SupabaseClient,
  propertyId: string | null | undefined,
): Promise<string[]> {
  if (!propertyId) return []
  const { data } = await supabase
    .from('properties')
    .select('assigned_to, created_by, co_assignees')
    .eq('id', propertyId)
    .maybeSingle()
  if (!data) return []
  const ids = [data.assigned_to, data.created_by, ...((data.co_assignees as string[] | null) ?? [])]
  return [...new Set(ids.filter((id): id is string => !!id))]
}

/**
 * Współwykonawcy zadania prawnego = wskazani ręcznie + opiekunowie
 * powiązanej nieruchomości, bez głównego wykonawcy (nie może być
 * jednocześnie CC).
 */
export async function withPropertyOwnersAsCoAssignees(
  supabase: SupabaseClient,
  {
    propertyId, assignedTo, coAssignees,
  }: { propertyId: string | null | undefined; assignedTo: string | null | undefined; coAssignees: unknown },
): Promise<string[]> {
  const base = Array.isArray(coAssignees) ? (coAssignees as string[]) : []
  const owners = await propertyOwnerIds(supabase, propertyId)
  return [...new Set([...base, ...owners])].filter(id => !!id && id !== assignedTo)
}

/** Konta działu prawnego — odbiorcy powiadomień o zadaniach prawnych */
export async function legalDepartmentIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('id').eq('role', 'dzial_prawny')
  return (data ?? []).map(r => r.id as string)
}
