'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ExternalLink, RefreshCw, HardDrive, Folder, FolderPlus, Upload, Trash2, Link2, ChevronRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { FOLDER_MIME } from '@/lib/driveShared'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  iconLink: string | null
  modifiedTime: string | null
}

interface DriveData {
  configured: boolean
  oauthPending?: boolean
  connected?: boolean
  rootFolderId?: string
  folderId?: string
  files?: DriveFile[]
}

interface Crumb { id: string; name: string }

interface Props {
  entity: 'lead' | 'property' | 'kontakt'
  id: string
}

/**
 * Menedżer dokumentów rekordu w Google Drive — wszystko z poziomu CRM:
 * jednorazowe „Utwórz połączenie", nawigacja po podfolderach, upload,
 * nowy folder, kosz. Tylko otwarcie samego pliku przenosi do Drive.
 */
export function DriveFiles({ entity, id }: Props) {
  const { showToast } = useToast()
  const [data, setData] = useState<DriveData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null) // 'connect' | 'upload' | 'mkdir' | itemId
  const [path, setPath] = useState<Crumb[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentFolderId = path.length ? path[path.length - 1].id : data?.rootFolderId

  const load = useCallback(async (folderId?: string) => {
    setLoading(true)
    setError(null)
    const qs = folderId ? `?folderId=${folderId}` : ''
    const res = await fetch(`/api/drive/${entity}/${id}${qs}`)
    if (res.ok) {
      setData(await res.json())
    } else {
      setError((await res.json().catch(() => ({}))).error || 'Błąd połączenia z Google Drive')
    }
    setLoading(false)
  }, [entity, id])

  useEffect(() => { load() }, [load])

  async function handleConnect() {
    setBusy('connect')
    const res = await fetch(`/api/drive/${entity}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect' }),
    })
    setBusy(null)
    if (!res.ok) {
      showToast((await res.json().catch(() => ({}))).error || 'Błąd tworzenia połączenia', 'error')
      return
    }
    showToast('Połączono z Google Drive — folder utworzony', 'success')
    load()
  }

  function openFolder(folder: DriveFile) {
    setPath(prev => [...prev, { id: folder.id, name: folder.name }])
    load(folder.id)
  }

  function goTo(index: number) {
    // index -1 = korzeń rekordu
    const next = index < 0 ? [] : path.slice(0, index + 1)
    setPath(next)
    load(next.length ? next[next.length - 1].id : undefined)
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !currentFolderId) return
    setBusy('upload')
    const form = new FormData()
    form.set('folderId', currentFolderId)
    for (const f of Array.from(files)) form.append('file', f)
    const res = await fetch(`/api/drive/${entity}/${id}/upload`, { method: 'POST', body: form })
    setBusy(null)
    if (!res.ok) {
      showToast((await res.json().catch(() => ({}))).error || 'Błąd wgrywania', 'error')
      return
    }
    showToast(files.length > 1 ? `Wgrano ${files.length} plików` : 'Plik wgrany', 'success')
    load(path.length ? currentFolderId : undefined)
  }

  async function handleMkdir() {
    const name = prompt('Nazwa nowego folderu:')?.trim()
    if (!name || !currentFolderId) return
    setBusy('mkdir')
    const res = await fetch(`/api/drive/${entity}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mkdir', name, parentId: currentFolderId }),
    })
    setBusy(null)
    if (!res.ok) {
      showToast((await res.json().catch(() => ({}))).error || 'Błąd tworzenia folderu', 'error')
      return
    }
    load(path.length ? currentFolderId : undefined)
  }

  async function handleDelete(item: DriveFile) {
    const isFolder = item.mimeType === FOLDER_MIME
    if (!confirm(`Przenieść ${isFolder ? 'folder' : 'plik'} „${item.name}" do kosza Drive?`)) return
    setBusy(item.id)
    const res = await fetch(`/api/drive/${entity}/${id}?itemId=${item.id}`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) {
      showToast((await res.json().catch(() => ({}))).error || 'Błąd usuwania', 'error')
      return
    }
    setData(d => d ? { ...d, files: (d.files || []).filter(f => f.id !== item.id) } : d)
  }

  if (loading && !data) {
    return (
      <div className="limona-card p-4 space-y-2">
        <p className="text-xs text-limona-lime uppercase tracking-wider font-bold flex items-center gap-2">
          <HardDrive size={13} /> Dokumenty (Google Drive)
        </p>
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    )
  }

  if (data && !data.configured) {
    return (
      <div className="limona-card p-4">
        <p className="text-xs text-limona-text-muted uppercase tracking-wider font-bold flex items-center gap-2 mb-2">
          <HardDrive size={13} /> Dokumenty (Google Drive)
        </p>
        <p className="text-xs text-limona-text-dim">
          {data.oauthPending
            ? 'Administrator musi połączyć konto Google — panel Admin → Integracje → „Połącz z Google Drive".'
            : 'Integracja Google Drive nie jest jeszcze skonfigurowana (brak kluczy API na serwerze).'}
        </p>
      </div>
    )
  }

  // Połączenie jeszcze nie istnieje — jednorazowy przycisk, potem znika
  if (data && !data.connected) {
    return (
      <div className="limona-card p-4 space-y-3">
        <p className="text-xs text-limona-text-muted uppercase tracking-wider font-bold flex items-center gap-2">
          <HardDrive size={13} /> Dokumenty (Google Drive)
        </p>
        <p className="text-xs text-limona-text-dim">
          Ten rekord nie ma jeszcze folderu dokumentów w Google Drive.
        </p>
        <button
          onClick={handleConnect}
          disabled={busy === 'connect'}
          className="limona-btn-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Link2 size={13} />
          {busy === 'connect' ? 'Tworzenie połączenia…' : 'Utwórz połączenie'}
        </button>
      </div>
    )
  }

  const files = data?.files ?? []
  const folders = files.filter(f => f.mimeType === FOLDER_MIME)
  const regularFiles = files.filter(f => f.mimeType !== FOLDER_MIME)

  return (
    <div className="limona-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-limona-lime uppercase tracking-wider font-bold flex items-center gap-2">
          <HardDrive size={13} /> Dokumenty ({regularFiles.length})
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => load(path.length ? currentFolderId : undefined)}
            className="p-1.5 text-limona-text-dim hover:text-limona-lime transition-colors"
            title="Odśwież"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
          </button>
          <button
            onClick={handleMkdir}
            disabled={!!busy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] uppercase tracking-wider font-medium border border-limona-border text-limona-text-muted hover:border-limona-text-muted hover:text-limona-white transition-colors disabled:opacity-50"
          >
            <FolderPlus size={12} /> Folder
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!!busy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] uppercase tracking-wider font-medium border border-limona-lime/40 text-limona-lime hover:bg-limona-lime/10 transition-colors disabled:opacity-50"
          >
            <Upload size={12} /> {busy === 'upload' ? 'Wgrywanie…' : 'Wgraj pliki'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => { handleUpload(e.target.files); e.target.value = '' }}
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      {path.length > 0 && (
        <div className="flex items-center gap-1 text-xs flex-wrap">
          <button onClick={() => goTo(-1)} className="text-limona-text-muted hover:text-limona-lime transition-colors">
            Dokumenty
          </button>
          {path.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight size={11} className="text-limona-text-dim" />
              {i === path.length - 1 ? (
                <span className="text-limona-white font-medium">{c.name}</span>
              ) : (
                <button onClick={() => goTo(i)} className="text-limona-text-muted hover:text-limona-lime transition-colors">
                  {c.name}
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-xs text-limona-red break-words">{error}</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-limona-text-dim">
          Pusto — wgraj pliki przyciskiem powyżej albo utwórz podfolder.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {folders.map(f => (
            <div key={f.id} className="flex items-center gap-2.5 p-2 rounded bg-limona-surface-2/40 hover:bg-limona-surface-2 transition-colors group">
              <button
                type="button"
                onClick={() => openFolder(f)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              >
                <Folder size={15} className="text-limona-yellow flex-shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-limona-text truncate group-hover:text-limona-white transition-colors">
                  {f.name}
                </span>
              </button>
              <button
                onClick={() => handleDelete(f)}
                disabled={busy === f.id}
                className="p-1 text-limona-text-dim hover:text-limona-red opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                title="Do kosza"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {regularFiles.map(f => (
            <div key={f.id} className="flex items-center gap-2.5 p-2 rounded bg-limona-surface-2/40 hover:bg-limona-surface-2 transition-colors group">
              <a
                href={f.webViewLink || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 flex-1 min-w-0"
                title="Otwórz w Google Drive"
              >
                {f.iconLink ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.iconLink} alt="" className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ExternalLink size={14} className="text-limona-text-dim flex-shrink-0" />
                )}
                <span className="flex-1 min-w-0 text-sm text-limona-text truncate group-hover:text-limona-white transition-colors">
                  {f.name}
                </span>
                {f.modifiedTime && (
                  <span className="text-[10px] text-limona-text-dim flex-shrink-0">
                    {new Date(f.modifiedTime).toLocaleDateString('pl-PL')}
                  </span>
                )}
              </a>
              <button
                onClick={() => handleDelete(f)}
                disabled={busy === f.id}
                className="p-1 text-limona-text-dim hover:text-limona-red opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                title="Do kosza"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
