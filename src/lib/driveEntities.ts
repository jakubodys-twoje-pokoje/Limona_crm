import type { SupabaseClient } from '@supabase/supabase-js'
import {
  driveRootId, findOrCreateFolder, listFiles, moveItem, renameItem,
} from '@/lib/drive'
import { formatPropertyAddress } from '@/lib/utils'

/**
 * Warstwa encji nad Google Drive: każdy lead / nieruchomość / kontakt ma
 * swój folder w strukturze:
 *
 *   <ROOT>/Leady/<nazwa leada>
 *   <ROOT>/Nieruchomości/<adres>
 *   <ROOT>/Spółdzielnie|Wspólnoty|Zarządcy|Komornicy|Klienci|Inwestorzy/<nazwa>
 *   <ROOT>/Leady/Archiwum/<nazwa> (skonwertowany)   — po konwersji leada
 *
 * Foldery powstają LENIWIE — dopiero gdy ktoś pierwszy raz otworzy
 * zakładkę Dokumenty danego rekordu. ID folderów kategorii trzymamy
 * w tabeli drive_folders, ID folderu rekordu w kolumnie drive_folder_id,
 * więc kolejne wejścia nie szukają niczego w Drive.
 */

export type DriveEntity = 'lead' | 'property' | 'kontakt'

const ENTITY_TABLE: Record<DriveEntity, string> = {
  lead: 'leads',
  property: 'properties',
  kontakt: 'kontakty',
}

const KONTAKT_CATEGORY: Record<string, string> = {
  spoldzielnia: 'Spółdzielnie',
  wspolnota: 'Wspólnoty',
  zarzadca: 'Zarządcy',
  komornik: 'Komornicy',
  klient: 'Klienci',
  inwestor: 'Inwestorzy',
}

/** Drive nie pozwala na / w nazwie; przycinamy też białe znaki i długość */
function sanitizeName(name: string): string {
  return (name.replace(/[/\\]/g, '-').trim() || 'Bez nazwy').slice(0, 180)
}

/** ID folderu kategorii (np. „Spółdzielnie") — cache w drive_folders */
export async function getCategoryFolderId(
  supabase: SupabaseClient,
  key: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const { data: cached } = await supabase
    .from('drive_folders')
    .select('folder_id')
    .eq('key', key)
    .maybeSingle()
  if (cached?.folder_id) return cached.folder_id

  const folderId = await findOrCreateFolder(name, parentId ?? driveRootId())
  await supabase.from('drive_folders').upsert({ key, folder_id: folderId }, { onConflict: 'key' })
  return folderId
}

interface EntityRecord {
  id: string
  drive_folder_id: string | null
  folderName: string
  categoryKey: string
  categoryName: string
}

async function loadEntity(supabase: SupabaseClient, entity: DriveEntity, id: string): Promise<EntityRecord | null> {
  if (entity === 'lead') {
    const { data } = await supabase.from('leads').select('id, name, drive_folder_id').eq('id', id).maybeSingle()
    if (!data) return null
    return { id: data.id, drive_folder_id: data.drive_folder_id, folderName: sanitizeName(data.name), categoryKey: 'leady', categoryName: 'Leady' }
  }
  if (entity === 'property') {
    const { data } = await supabase.from('properties').select('id, adres, kod_pocztowy, miasto, drive_folder_id').eq('id', id).maybeSingle()
    if (!data) return null
    return { id: data.id, drive_folder_id: data.drive_folder_id, folderName: sanitizeName(formatPropertyAddress(data)), categoryKey: 'nieruchomosci', categoryName: 'Nieruchomości' }
  }
  const { data } = await supabase.from('kontakty').select('id, nazwa, typ, drive_folder_id').eq('id', id).maybeSingle()
  if (!data) return null
  const categoryName = KONTAKT_CATEGORY[data.typ] || 'Kontakty inne'
  return { id: data.id, drive_folder_id: data.drive_folder_id, folderName: sanitizeName(data.nazwa), categoryKey: `kontakty:${data.typ}`, categoryName }
}

/**
 * Zwraca ID folderu Drive dla rekordu — tworzy go przy pierwszym użyciu
 * i zapamiętuje w drive_folder_id.
 */
export async function ensureEntityFolder(
  supabase: SupabaseClient,
  entity: DriveEntity,
  id: string,
): Promise<{ folderId: string } | { error: string; status: number }> {
  const record = await loadEntity(supabase, entity, id)
  if (!record) return { error: 'Not found', status: 404 }
  if (record.drive_folder_id) return { folderId: record.drive_folder_id }

  const categoryId = await getCategoryFolderId(supabase, record.categoryKey, record.categoryName)
  const folderId = await findOrCreateFolder(record.folderName, categoryId)
  await supabase.from(ENTITY_TABLE[entity]).update({ drive_folder_id: folderId }).eq('id', id)
  return { folderId }
}

/**
 * Konwersja leada: pliki z folderu leada przenoszą się do folderu nowej
 * nieruchomości (lub klienta, gdy nieruchomości nie tworzono), a sam folder
 * leada wędruje do Leady/Archiwum z dopiskiem — nic nie jest usuwane.
 */
export async function migrateLeadFolderOnConvert(
  supabase: SupabaseClient,
  leadId: string,
  leadName: string,
  target: { propertyId: string | null; kontaktId: string | null },
): Promise<void> {
  const { data: lead } = await supabase.from('leads').select('drive_folder_id').eq('id', leadId).maybeSingle()
  const leadFolderId = lead?.drive_folder_id
  if (!leadFolderId) return // lead nigdy nie miał folderu — nic do przenoszenia

  // Folder docelowy: nieruchomość ma pierwszeństwo przed klientem
  let targetFolderId: string | null = null
  if (target.propertyId) {
    const res = await ensureEntityFolder(supabase, 'property', target.propertyId)
    if ('folderId' in res) targetFolderId = res.folderId
  } else if (target.kontaktId) {
    const res = await ensureEntityFolder(supabase, 'kontakt', target.kontaktId)
    if ('folderId' in res) targetFolderId = res.folderId
  }

  if (targetFolderId) {
    const files = await listFiles(leadFolderId)
    for (const f of files) {
      await moveItem(f.id, leadFolderId, targetFolderId)
    }
  }

  // Archiwizacja folderu leada (pusty ślad zostaje, nic nie znika)
  const leadyId = await getCategoryFolderId(supabase, 'leady', 'Leady')
  const archiwumId = await getCategoryFolderId(supabase, 'leady:archiwum', 'Archiwum', leadyId)
  await moveItem(leadFolderId, leadyId, archiwumId)
  await renameItem(leadFolderId, `${sanitizeName(leadName)} (skonwertowany)`)
}
