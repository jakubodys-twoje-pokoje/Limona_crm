export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { driveConfigured, driveAuthMode, driveOAuthConnected, listFiles, createFolder, trashItem, driveErrorMessage, driveNeedsReconnect } from '@/lib/drive'
import {
  ensureEntityFolder, getEntityFolderId, isInsideFolder, safeFolderName, type DriveEntity,
} from '@/lib/driveEntities'

const ENTITIES: DriveEntity[] = ['lead', 'property', 'kontakt']

function driveError(e: unknown): NextResponse {
  const raw = e instanceof Error ? e.message : String(e)
  console.error('[drive] błąd operacji Google Drive:', raw)
  return NextResponse.json(
    { error: driveErrorMessage(raw), reconnect: driveNeedsReconnect(raw) },
    { status: 502 },
  )
}

async function resolveRoot(entity: string, id: string) {
  const supabase = await createClient()
  const res = await getEntityFolderId(supabase, entity as DriveEntity, id)
  return { supabase, res }
}

/**
 * GET /api/drive/[entity]/[id]?folderId=... — zawartość folderu rekordu
 * (lub podfolderu). Nie tworzy niczego — połączenie zakłada się jawnie
 * przez POST action=connect.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { entity, id } = await params
  if (!ENTITIES.includes(entity as DriveEntity)) {
    return NextResponse.json({ error: 'Nieznany typ rekordu' }, { status: 400 })
  }
  if (!driveConfigured()) return NextResponse.json({ configured: false })
  // OAuth skonfigurowany w env, ale admin nie połączył jeszcze konta Google
  if (driveAuthMode() === 'oauth' && !(await driveOAuthConnected())) {
    return NextResponse.json({ configured: false, oauthPending: true })
  }

  try {
    const { res } = await resolveRoot(entity, id)
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
    if (!res.folderId) return NextResponse.json({ configured: true, connected: false })

    const requested = req.nextUrl.searchParams.get('folderId')
    let target = res.folderId
    if (requested && requested !== res.folderId) {
      if (!(await isInsideFolder(requested, res.folderId))) {
        return NextResponse.json({ error: 'Folder spoza dokumentów tego rekordu' }, { status: 403 })
      }
      target = requested
    }

    const files = await listFiles(target)
    return NextResponse.json({
      configured: true,
      connected: true,
      rootFolderId: res.folderId,
      folderId: target,
      files,
    })
  } catch (e) {
    return driveError(e)
  }
}

/**
 * POST — akcje:
 *  { action: 'connect' }                    — utwórz folder rekordu (jednorazowo)
 *  { action: 'mkdir', name, parentId }      — nowy podfolder
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

  const body = await req.json().catch(() => ({}))

  try {
    const { supabase, res } = await resolveRoot(entity, id)
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

    if (body.action === 'connect') {
      const created = await ensureEntityFolder(supabase, entity as DriveEntity, id)
      if ('error' in created) return NextResponse.json({ error: created.error }, { status: created.status })
      return NextResponse.json({ connected: true, folderId: created.folderId })
    }

    if (body.action === 'mkdir') {
      if (!res.folderId) return NextResponse.json({ error: 'Najpierw utwórz połączenie z Drive' }, { status: 400 })
      const name = typeof body.name === 'string' ? safeFolderName(body.name) : ''
      if (!name) return NextResponse.json({ error: 'Podaj nazwę folderu' }, { status: 400 })
      const parentId = body.parentId || res.folderId
      if (!(await isInsideFolder(parentId, res.folderId))) {
        return NextResponse.json({ error: 'Folder spoza dokumentów tego rekordu' }, { status: 403 })
      }
      const folderId = await createFolder(name, parentId)
      return NextResponse.json({ ok: true, folderId })
    }

    return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
  } catch (e) {
    return driveError(e)
  }
}

/** DELETE ?itemId=... — przenosi plik/podfolder do kosza Drive */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { entity, id } = await params
  if (!ENTITIES.includes(entity as DriveEntity)) {
    return NextResponse.json({ error: 'Nieznany typ rekordu' }, { status: 400 })
  }
  if (!driveConfigured()) {
    return NextResponse.json({ error: 'Integracja Google Drive nie jest skonfigurowana' }, { status: 400 })
  }

  const itemId = req.nextUrl.searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId wymagane' }, { status: 400 })

  try {
    const { res } = await resolveRoot(entity, id)
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
    if (!res.folderId) return NextResponse.json({ error: 'Brak połączenia z Drive' }, { status: 400 })
    if (itemId === res.folderId) {
      return NextResponse.json({ error: 'Nie można usunąć głównego folderu rekordu' }, { status: 400 })
    }
    if (!(await isInsideFolder(itemId, res.folderId))) {
      return NextResponse.json({ error: 'Element spoza dokumentów tego rekordu' }, { status: 403 })
    }

    await trashItem(itemId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return driveError(e)
  }
}
