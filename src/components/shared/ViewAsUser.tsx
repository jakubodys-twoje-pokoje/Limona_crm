'use client'

import { useEffect, useState } from 'react'
import { Eye, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { canViewAsUser, ROLE_LABELS } from '@/lib/roles'
import type { Profile, UserRole } from '@/types/database'

function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role
}

/**
 * Włącza podgląd i przeładowuje aplikację — twardy reload, żeby wszystkie
 * widoki (menu, listy, liczniki) zaciągnęły się już na nowej tożsamości.
 */
export async function startViewAs(userId: string): Promise<string | null> {
  const res = await fetch('/api/impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) return (await res.json()).error || 'Nie udało się włączyć podglądu'
  window.location.href = '/dashboard'
  return null
}

/**
 * „Podgląd jako użytkownik" — centrala wybiera osobę i ogląda aplikację jej
 * oczami (te same filtry widoczności, menu i uprawnienia), bez możliwości
 * wprowadzania zmian. Przycisk pokazuje się tylko rolom uprawnionym.
 */
export function ViewAsButton({ className }: { className?: string }) {
  const { profile, viewAs } = useAuth()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    if (!open || profiles.length) return
    fetch('/api/profiles')
      .then(r => r.ok ? r.json() : [])
      .then((data: Profile[]) => setProfiles(data || []))
      .catch(() => {})
  }, [open, profiles.length])

  // W trakcie podglądu rola jest już rolą oglądanej osoby — wyjście z trybu
  // obsługuje pasek na górze ekranu, nie ten przycisk.
  if (viewAs || !canViewAsUser(profile?.role)) return null

  const query = search.trim().toLowerCase()
  const shown = profiles
    .filter(p => p.id !== profile?.id)
    .filter(p => !query || p.full_name.toLowerCase().includes(query) || roleLabel(p.role).toLowerCase().includes(query))

  async function handlePick(userId: string) {
    setStarting(userId)
    const error = await startViewAs(userId)
    if (error) { setStarting(null); showToast(error, 'error') }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? 'limona-btn-outline flex items-center gap-2 flex-shrink-0'}>
        <Eye size={14} /> Podgląd jako…
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Podgląd jako użytkownik" size="md">
        <div className="space-y-3">
          <p className="text-xs text-limona-text-muted">
            Zobaczysz aplikację tak, jak widzi ją wybrana osoba — jej zadania, nieruchomości,
            kontakty i menu. Tryb jest <span className="text-limona-yellow">tylko do odczytu</span>:
            zapisy są zablokowane, dopóki nie wrócisz na swoje konto.
          </p>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-limona-text-dim" />
            <input
              autoFocus
              className="limona-input pl-9"
              placeholder="Szukaj po nazwisku lub roli..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1">
            {shown.length === 0 ? (
              <p className="text-center text-sm text-limona-text-muted py-6">Brak użytkowników</p>
            ) : shown.map(p => (
              <button
                key={p.id}
                type="button"
                disabled={!!starting}
                onClick={() => handlePick(p.id)}
                className="w-full flex items-center gap-3 p-2 rounded hover:bg-limona-surface-2 transition-colors text-left disabled:opacity-50"
              >
                <Avatar name={p.full_name} url={p.avatar_url} size="sm" />
                <span className="text-sm text-limona-text flex-1 truncate">{p.full_name}</span>
                <span className="text-[10px] uppercase tracking-wider text-limona-text-dim">{roleLabel(p.role)}</span>
                <Eye size={14} className="text-limona-text-dim" />
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}

/** Ikona „podgląd jako" do wierszy list użytkowników (panel admina) */
export function ViewAsIconButton({ userId, name }: { userId: string; name: string }) {
  const { profile, viewAs } = useAuth()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  if (viewAs || !canViewAsUser(profile?.role) || userId === profile?.id) return null

  return (
    <button
      type="button"
      disabled={busy}
      title={`Podgląd jako ${name} (tylko odczyt)`}
      onClick={async () => {
        setBusy(true)
        const error = await startViewAs(userId)
        if (error) { setBusy(false); showToast(error, 'error') }
      }}
      className="p-2 text-limona-text-muted hover:text-limona-yellow transition-colors disabled:opacity-50"
    >
      <Eye size={16} />
    </button>
  )
}
