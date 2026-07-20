export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { driveConfigured, uploadFile, type DriveFile } from '@/lib/drive'
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
  const res = await getEntityFolderId(supabase, entity as DriveEntity, id)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
  if (!res.folderId) return NextResponse.json({ error: 'Najpierw utwórz połączenie z Drive' }, { status: 400 })

  const form = await req.formData()
  const files = form.getAll('file').filter((f): f is File => f instanceof File)
  if (!files.length) return NextResponse.json({ error: 'Brak plików' }, { status: 400 })

  const folderId = (form.get('folderId') as string | null) || res.folderId

  try {
    if (folderId !== res.folderId && !(await isInsideFolder(folderId, res.folderId))) {
      return NextResponse.json({ error: 'Folder spoza dokumentów tego rekordu' }, { status: 403 })
    }

    const uploaded: DriveFile[] = []
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `Plik ${f.name} przekracza 50 MB` }, { status: 413 })
      }
      const buf = Buffer.from(await f.arrayBuffer())
      uploaded.push(await uploadFile(f.name, f.type, buf, folderId))
    }
    return NextResponse.json({ ok: true, files: uploaded })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Błąd Google Drive'
    // Konto serwisowe nie ma własnej quoty na Dysku — zapis do zwykłego
    // "Mojego Dysku" wymaga Dysku współdzielonego albo delegacji domenowej.
    if (message.includes('storageQuotaExceeded') || message.includes('teamDriveFileLimitExceeded')) {
      return NextResponse.json({
        error: 'Google odrzucił zapis: konto usługi nie ma własnego miejsca na Dysku. ' +
          'Przenieś folder CRM na Dysk współdzielony (Workspace) albo ustaw GOOGLE_DRIVE_IMPERSONATE_USER ' +
          '(delegacja domenowa) — patrz .env.example.',
      }, { status: 502 })
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
