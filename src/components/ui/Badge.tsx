'use client'

import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  new: 'bg-gray-500/20 text-gray-400',
  analysis: 'bg-[#448AFF]/20 text-[#448AFF]',
  offer_sent: 'bg-purple-500/20 text-purple-400',
  negotiation: 'bg-[#BEFF00]/20 text-[#BEFF00]',
  contract: 'bg-orange-500/20 text-orange-400',
  legal_cleanup: 'bg-cyan-500/20 text-cyan-400',
  sale: 'bg-[#00E676]/20 text-[#00E676]',
  completed: 'bg-emerald-700/20 text-emerald-500',
  rejected: 'bg-[#FF3D3D]/20 text-[#FF3D3D]',
  // Task priorities
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-[#448AFF]/20 text-[#448AFF]',
  high: 'bg-[#FFD600]/20 text-[#FFD600]',
  urgent: 'bg-[#FF3D3D]/20 text-[#FF3D3D]',
  // Task statuses
  todo: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-[#448AFF]/20 text-[#448AFF]',
  done: 'bg-[#00E676]/20 text-[#00E676]',
  blocked: 'bg-[#FF3D3D]/20 text-[#FF3D3D]',
  // Decision
  OK: 'bg-[#00E676]/20 text-[#00E676]',
  NIE: 'bg-[#FF3D3D]/20 text-[#FF3D3D]',
  // Status dłużnika
  brak: 'bg-gray-500/20 text-gray-400',
  analiza: 'bg-[#448AFF]/20 text-[#448AFF]',
  umowa: 'bg-orange-500/20 text-orange-400',
  dokumenty: 'bg-purple-500/20 text-purple-400',
  oferta_od_inwestora: 'bg-[#BEFF00]/20 text-[#BEFF00]',
  sprzedaz: 'bg-[#00E676]/20 text-[#00E676]',
  // Status inwestora
  oferta_zakupu: 'bg-[#448AFF]/20 text-[#448AFF]',
  aneks_akceptacja: 'bg-orange-500/20 text-orange-400',
  oferta_dla_klienta: 'bg-[#BEFF00]/20 text-[#BEFF00]',
  zakup: 'bg-[#00E676]/20 text-[#00E676]',
  // Status inwestora (per nieruchomość)
  zainteresowany: 'bg-[#448AFF]/20 text-[#448AFF]',
  nie_zainteresowany: 'bg-gray-500/20 text-gray-400',
  problematyczny: 'bg-[#FF3D3D]/20 text-[#FF3D3D]',
  sukces: 'bg-[#00E676]/20 text-[#00E676]',
}

const statusLabels: Record<string, string> = {
  new: 'Nowa',
  analysis: 'Analiza',
  offer_sent: 'Oferta wysłana',
  negotiation: 'Negocjacja',
  contract: 'Umowa',
  legal_cleanup: 'Regulacja prawna',
  sale: 'Sprzedaż',
  completed: 'Zakończona',
  rejected: 'Odrzucona',
  todo: 'Do zrobienia',
  in_progress: 'W trakcie',
  done: 'Zrobione',
  blocked: 'Zablokowane',
  low: 'Niski',
  medium: 'Średni',
  high: 'Wysoki',
  urgent: 'Pilny',
  brak: 'Brak',
  analiza: 'Analiza',
  umowa: 'Umowa',
  dokumenty: 'Dokumenty',
  oferta_od_inwestora: 'Oferta od inwestora',
  sprzedaz: 'Sprzedaż',
  oferta_zakupu: 'Oferta zakupu',
  aneks_akceptacja: 'Aneks / akceptacja',
  oferta_dla_klienta: 'Oferta dla klienta',
  zakup: 'Zakup',
  zainteresowany: 'Zainteresowany',
  nie_zainteresowany: 'Nie zainteresowany',
  problematyczny: 'Problematyczny',
  sukces: 'Sukces',
}

interface BadgeProps {
  value: string
  className?: string
  showLabel?: boolean
}

export function Badge({ value, className, showLabel = true }: BadgeProps) {
  const colors = statusColors[value] || 'bg-gray-500/20 text-gray-400'
  const label = showLabel ? (statusLabels[value] || value) : value

  return (
    <span className={cn('limona-badge', colors, className)}>
      {label}
    </span>
  )
}
