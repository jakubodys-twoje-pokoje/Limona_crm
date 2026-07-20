'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FolderOpen, RefreshCw, HardDrive } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

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
  folderId?: string
  folderUrl?: string
  files?: DriveFile[]
}

interface Props {
  entity: 'lead' | 'property' | 'kontakt'
  id: string
}

/**
 * Zakładka „Dokumenty" ↔ Google Drive: folder rekordu tworzy się przy
 * pierwszym otwarciu, tu widać listę plików z linkami. Pliki wgrywa się
 * po prostu do folderu w Drive (przycisk „Otwórz folder").
 */
export function DriveFiles({ entity, id }: Props) {
  const [data, setData] = useState<DriveData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/drive/${entity}/${id}`)
    if (res.ok) {
      setData(await res.json())
    } else {
      setError((await res.json().catch(() => ({}))).error || 'Błąd połączenia z Google Drive')
    }
    setLoading(false)
  }, [entity, id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="limona-card p-4 space-y-2">
        <p className="text-xs text-limona-lime uppercase tracking-wider font-bold flex items-center gap-2">
          <HardDrive size={13} /> Google Drive
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
          <HardDrive size={13} /> Google Drive
        </p>
        <p className="text-xs text-limona-text-dim">
          Integracja Google Drive nie jest jeszcze skonfigurowana (brak kluczy API na serwerze).
        </p>
      </div>
    )
  }

  return (
    <div className="limona-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-limona-lime uppercase tracking-wider font-bold flex items-center gap-2">
          <HardDrive size={13} /> Google Drive ({data?.files?.length ?? 0})
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-1.5 text-limona-text-dim hover:text-limona-lime transition-colors"
            title="Odśwież listę plików"
          >
            <RefreshCw size={13} />
          </button>
          {data?.folderUrl && (
            <a
              href={data.folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-limona-lime hover:text-limona-lime-hover transition-colors font-medium"
            >
              <FolderOpen size={13} /> Otwórz folder
            </a>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-xs text-limona-red break-words">{error}</p>
      ) : !data?.files?.length ? (
        <p className="text-xs text-limona-text-dim">
          Folder jest pusty — wgraj pliki przez „Otwórz folder", a pojawią się tutaj.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {data.files.map(f => (
            <a
              key={f.id}
              href={f.webViewLink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-2 rounded bg-limona-surface-2/40 hover:bg-limona-surface-2 transition-colors group"
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
          ))}
        </div>
      )}
    </div>
  )
}
