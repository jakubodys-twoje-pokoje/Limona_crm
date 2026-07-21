'use client'

import { useEffect, useRef, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /**
   * Formularze z wpisywanymi danymi: zamknięcie przez klik w tło, Escape
   * lub ✕ pyta o potwierdzenie, żeby przypadkowy klik nie skasował pracy.
   * Przycisk „Anuluj" wewnątrz formularza zamyka bez pytania (woła onClose rodzica).
   */
  confirmClose?: boolean
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ isOpen, onClose, title, children, size = 'md', className, confirmClose = false }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Wewnętrzny dialog zamiast window.confirm — Safari (zwłaszcza jako
  // aplikacja z ekranu głównego) potrafi wyciszać natywne confirm(),
  // przez co formularz zamykał się bez pytania i dane przepadały.
  const [confirmVisible, setConfirmVisible] = useState(false)
  useEffect(() => { if (!isOpen) setConfirmVisible(false) }, [isOpen])

  const requestClose = useRef(onClose)
  requestClose.current = confirmClose ? () => setConfirmVisible(true) : onClose

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose.current()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) requestClose.current() }}
    >
      <div className={cn(
        'w-full limona-card p-6 max-h-[90vh] overflow-y-auto',
        sizeClasses[size],
        className
      )}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="limona-heading text-xl">{title}</h2>
          <button
            onClick={() => requestClose.current()}
            className="p-2 text-limona-text-muted hover:text-limona-lime transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>

      {/* Potwierdzenie porzucenia formularza (własny dialog, nie window.confirm) */}
      {confirmVisible && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) setConfirmVisible(false) }}
        >
          <div className="limona-card p-5 max-w-sm w-full space-y-4 border-limona-yellow/40">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-limona-yellow/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={17} className="text-limona-yellow" />
              </div>
              <p className="text-sm text-limona-text">
                Zamknąć formularz? <span className="text-limona-white font-medium">Wpisane dane przepadną.</span>
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmVisible(false)}
                className="limona-btn-outline text-xs"
              >
                Wróć do formularza
              </button>
              <button
                onClick={() => { setConfirmVisible(false); onClose() }}
                className="bg-limona-red text-white font-bold uppercase tracking-wider rounded-full px-5 py-2.5 text-xs hover:opacity-90 transition-opacity"
              >
                Zamknij i odrzuć
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
