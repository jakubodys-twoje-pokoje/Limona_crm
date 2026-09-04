'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Copy, Check, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'

export function CalendarSync() {
  const { showToast } = useToast()
  const confirmDialog = useConfirm()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    fetch('/api/calendar/me')
      .then(r => r.ok ? r.json() : { token: null })
      .then(d => setToken(d.token))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = token ? `${origin}/api/calendar/${token}` : ''
  const webcal = url.replace(/^https?:\/\//, 'webcal://')

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    showToast('Adres skopiowany', 'success')
  }

  async function regenerate() {
    const ok = await confirmDialog({
      message: 'Wygenerować nowy adres? Stary link przestanie działać — trzeba będzie dodać kalendarz ponownie.',
      confirmLabel: 'Generuj nowy',
    })
    if (!ok) return
    setResetting(true)
    const res = await fetch('/api/calendar/me', { method: 'POST' })
    setResetting(false)
    if (res.ok) { setToken((await res.json()).token); showToast('Nowy adres gotowy', 'success') }
    else showToast('Nie udało się wygenerować', 'error')
  }

  return (
    <div className="limona-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-limona-lime" />
        <h2 className="limona-eyebrow">Synchronizacja z kalendarzem</h2>
      </div>
      <p className="text-sm text-limona-text-muted">
        Twoje zadania z terminem pojawią się w Google / Apple / Outlook Calendar. Dodajesz adres
        <b> raz</b>, a kalendarz sam się odświeża. To połączenie tylko do odczytu — nic nie usuwa ani nie zmienia w CRM.
      </p>

      {loading ? (
        <div className="h-10 bg-limona-surface-2/50 rounded-lg animate-pulse" />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-limona-surface-2 rounded-lg px-3 py-2.5 text-xs font-mono break-all select-all">{url}</code>
            <button onClick={copy} title="Kopiuj adres"
              className="p-2.5 rounded-lg border border-limona-border text-limona-text-muted hover:text-limona-lime hover:border-limona-lime transition-colors flex-shrink-0">
              {copied ? <Check size={16} className="text-limona-green" /> : <Copy size={16} />}
            </button>
          </div>

          <div className="rounded-lg border border-limona-border/60 bg-limona-surface-2/30 p-4 text-sm text-limona-text-muted space-y-1.5">
            <p className="font-bold text-limona-text">Jak dodać w Google Calendar (telefon lub komputer):</p>
            <p>1. Skopiuj adres powyżej (przycisk kopiowania).</p>
            <p>2. Na komputerze: <b>calendar.google.com</b> → po lewej „Inne kalendarze" → <b>+</b> → <b>„Z adresu URL"</b>.</p>
            <p>3. Wklej adres i kliknij <b>„Dodaj kalendarz"</b>. Gotowe — zadania pojawią się w kalendarzu.</p>
            <p className="text-limona-text-dim text-xs pt-1">
              Na iPhone/Apple: Ustawienia → Kalendarz → Konta → Dodaj konto → Inne → „Dodaj subskrypcję kalendarza" i wklej adres.
              Google odświeża subskrypcje co jakiś czas (nie natychmiast).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a href={webcal} className="limona-btn-sm inline-flex items-center gap-2">
              <CalendarDays size={14} /> Dodaj do kalendarza w telefonie
            </a>
            <button onClick={regenerate} disabled={resetting}
              className="inline-flex items-center gap-1.5 text-xs text-limona-text-dim hover:text-limona-red transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={resetting ? 'animate-spin' : ''} /> Wygeneruj nowy adres
            </button>
          </div>
          <p className="text-[11px] text-limona-text-dim">
            Adres jest prywatny — nie udostępniaj go. Jeśli wyciekł, użyj „Wygeneruj nowy adres".
          </p>
        </>
      )}
    </div>
  )
}
