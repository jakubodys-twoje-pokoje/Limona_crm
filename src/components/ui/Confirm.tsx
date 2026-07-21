'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Wewnętrzny dialog potwierdzeń zamiast window.confirm — Safari (zwłaszcza
 * CRM dodany do ekranu głównego jako aplikacja) potrafi wyciszać natywne
 * dialogi: confirm() wracał od razu z "nie" i akcje (usuń, resetuj…)
 * wyglądały na zepsute na Macu/iPhonie.
 *
 * Użycie:
 *   const confirmDialog = useConfirm()
 *   if (!(await confirmDialog('Na pewno usunąć?'))) return
 */

interface ConfirmOptions {
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

const ConfirmContext = createContext<((opts: ConfirmOptions | string) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirmDialog = useCallback((input: ConfirmOptions | string): Promise<boolean> => {
    const options = typeof input === 'string' ? { message: input } : input
    return new Promise<boolean>(resolve => {
      // Ewentualny wcześniejszy, niedomknięty dialog kończymy jako "nie"
      resolverRef.current?.(false)
      resolverRef.current = resolve
      setOpts(options)
    })
  }, [])

  function settle(value: boolean) {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOpts(null)
  }

  return (
    <ConfirmContext.Provider value={confirmDialog}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) settle(false) }}
        >
          <div className="limona-card p-5 max-w-sm w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-limona-yellow/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={17} className="text-limona-yellow" />
              </div>
              <p className="text-sm text-limona-text whitespace-pre-wrap">{opts.message}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => settle(false)} className="limona-btn-outline text-xs">
                {opts.cancelLabel || 'Anuluj'}
              </button>
              <button
                onClick={() => settle(true)}
                className="bg-limona-red text-white font-bold uppercase tracking-wider rounded-full px-5 py-2.5 text-xs hover:opacity-90 transition-opacity"
                autoFocus
              >
                {opts.confirmLabel || 'Tak, wykonaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  // Awaryjnie (poza providerem) — natywny confirm; lepsze to niż brak pytania
  return ctx ?? (async (input: ConfirmOptions | string) =>
    window.confirm(typeof input === 'string' ? input : input.message))
}
