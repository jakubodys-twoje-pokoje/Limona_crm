'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
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

  const requestClose = useRef(onClose)
  requestClose.current = confirmClose
    ? () => { if (confirm('Zamknąć formularz? Wpisane dane przepadną.')) onClose() }
    : onClose

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
    </div>
  )
}
