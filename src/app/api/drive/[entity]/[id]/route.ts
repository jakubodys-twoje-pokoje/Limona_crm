export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { driveConfigured, driveFolderUrl, listFiles } from '@/lib/drive'
import { ensureEntityFolder, type DriveEntity } from '@/lib/driveEntities'

const ENTITIES: DriveEntity[] = ['lead', 'property', 'kontakt']

/**
 * GET /api/drive/[entity]/[id] — folder Drive rekordu + lista plików.
 * Tworzy folder przy pierwszym wejściu (lazy), potem to jeden request
 * files.list na odświeżenie zakładki.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { entity, id } = await params
  if (!ENTITIES.includes(entity as DriveEntity)) {
    return NextResponse.json({ error: 'Nieznany typ rekordu' }, { status: 400 })
  }

  if (!driveConfigured()) {
    return NextResponse.json({ configured: false })
  }

  const supabase = await createClient()
  try {
    const res = await ensureEntityFolder(supabase, entity as DriveEntity, id)
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

    const files = await listFiles(res.folderId)
    return NextResponse.json({
      configured: true,
      folderId: res.folderId,
      folderUrl: driveFolderUrl(res.folderId),
      files,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Błąd Google Drive'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
