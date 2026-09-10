export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canAccessEntity, recordNotFound } from '@/lib/record-access'
import { driveConfigured, uploadFile, driveErrorMessage, driveNeedsReconnect, type DriveFile } from '@/lib/drive'
import { getEntityFolderId, isInsideFolder, type DriveEntity } from '@/lib/driveEntities'

const ENTITIES: DriveEntity[] = ['lead', 'property', 'kontakt']
const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB — skan aktu z zapasem

/**
 * POST /api/drive/[entity]/[id]/upload — wgranie plików z CRM do folderu
 * rekordu (formData: folderId?, file...).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { entity, id } = await params
  if (!ENTITIES.includes(entity as DriveEntity)) {
    return NextResponse.json({ error: 'Nieznany typ rekordu' }, { status: 400 })
  }
  if (!driveConfigured()) {
    return NextResponse.json({ error: 'Integracja Google Drive nie jest skonfigurowana' }, { status: 400 })
  }

  const supabase = await createClient()
  if (!(await canAccessEntity(supabase, user, entity, id))) return recordNotFound()

  const res = await getEntityFolderId(supabase, entity as DriveEntity, id)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
  if (!res.folderId) return NextResponse.json({ error: 'Najpierw utwórz połączenie z Drive' }, { status: 400 })

  // Parsowanie multipartu może rzucić (uszkodzony body, limit rozmiaru na
  // proxy/hostingu) — zwracamy wtedy czytelny JSON zamiast surowego 500
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({
      error: 'Nie udało się odczytać przesłanych plików. Jeśli plik jest duży, spróbuj mniejszego — ' +
        'serwer lub sieć mogły odrzucić zbyt duże żądanie.',
    }, { status: 400 })
  }

  const files = form.getAll('file').filter((f): f is File => f instanceof File)
  if (!files.length) return NextResponse.json({ error: 'Brak plików' }, { status: 400 })

  // Limit sprawdzamy przed uploadem — czytelny komunikat zamiast błędu z Google
  const tooBig = files.find(f => f.size > MAX_FILE_BYTES)
  if (tooBig) {
    return NextResponse.json({ error: `Plik „${tooBig.name}" przekracza 50 MB` }, { status: 413 })
  }

  const folderId = (form.get('folderId') as string | null) || res.folderId

  try {
    if (folderId !== res.folderId && !(await isInsideFolder(folderId, res.folderId))) {
      return NextResponse.json({ error: 'Folder spoza dokumentów tego rekordu' }, { status: 403 })
    }

    const uploaded: DriveFile[] = []
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer())
      uploaded.push(await uploadFile(f.name, f.type, buf, folderId))
    }
    return NextResponse.json({ ok: true, files: uploaded })
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    // Log pełnej treści błędu Google — do diagnozy po stronie serwera
    console.error('[drive upload] błąd zapisu do Google Drive:', raw)
    return NextResponse.json(
      { error: driveErrorMessage(raw), reconnect: driveNeedsReconnect(raw) },
      { status: 502 },
    )
  }
}
