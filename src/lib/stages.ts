import type { DealType, StatusDluznika, StatusInwestora, InvestorPropertyStatus } from '@/types/database'

export const STATUS_DLUZNIKA_LABELS: Record<StatusDluznika, string> = {
  brak: 'Brak',
  analiza: 'Analiza',
  umowa: 'Umowa',
  dokumenty: 'Dokumenty',
  oferta_od_inwestora: 'Oferta od inwestora',
  sprzedaz: 'Sprzedaż',
}

export const STATUS_DLUZNIKA_OPTIONS: StatusDluznika[] = [
  'brak', 'analiza', 'umowa', 'dokumenty', 'oferta_od_inwestora', 'sprzedaz',
]

export const STATUS_INWESTORA_LABELS: Record<StatusInwestora, string> = {
  brak: 'Brak',
  oferta_zakupu: 'Oferta zakupu',
  aneks_akceptacja: 'Aneks / akceptacja',
  oferta_dla_klienta: 'Oferta dla klienta',
  zakup: 'Zakup',
}

export const STATUS_INWESTORA_OPTIONS: StatusInwestora[] = [
  'brak', 'oferta_zakupu', 'aneks_akceptacja', 'oferta_dla_klienta', 'zakup',
]

export const INVESTOR_PROPERTY_STATUS_LABELS: Record<InvestorPropertyStatus, string> = {
  zainteresowany: 'Zainteresowany',
  nie_zainteresowany: 'Nie zainteresowany',
  problematyczny: 'Problematyczny',
  sukces: 'Sukces',
}

export const INVESTOR_PROPERTY_STATUS_OPTIONS: InvestorPropertyStatus[] = [
  'zainteresowany', 'nie_zainteresowany', 'problematyczny', 'sukces',
]

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  zadluzony_ponizej: 'Zadłużona poniżej wartości',
  zadluzony_powyzej: 'Zadłużona powyżej wartości',
}

export const DEAL_TYPE_SHORT: Record<DealType, string> = {
  zadluzony_ponizej: 'Poniżej',
  zadluzony_powyzej: 'Powyżej',
}

// Szablony zadań podpowiadane przy danym etapie statusu dłużnika
export const STAGE_TASK_TEMPLATES: Partial<Record<StatusDluznika, string[]>> = {
  analiza: [
    'Zamów wycenę szacunkową',
    'Sprawdź KW w przeglądarce e-KW',
    'Weryfikacja zadłużeń i wierzycieli',
    'Ocena stanu technicznego nieruchomości',
  ],
  umowa: [
    'Przygotuj draft umowy',
    'Umów wizytę u notariusza',
    'Sprawdź tożsamość właściciela',
  ],
  dokumenty: [
    'Pobierz zaświadczenie o niezaleganiu z czynszem',
    'Skompletuj odpis z KW',
    'Skompletuj akt własności',
  ],
  oferta_od_inwestora: [
    'Prześlij dokumentację do inwestorów',
    'Zbierz oferty od inwestorów',
    'Wybierz najlepszą ofertę',
  ],
  sprzedaz: [
    'Podpisz umowę sprzedaży u notariusza',
    'Przekaż klucze kupującemu',
    'Protokół zdawczo-odbiorczy sprzedaży',
  ],
}

export function getStatusDluznikaLabel(status: string): string {
  return STATUS_DLUZNIKA_LABELS[status as StatusDluznika] ?? status
}

export function getStatusInwestoraLabel(status: string): string {
  return STATUS_INWESTORA_LABELS[status as StatusInwestora] ?? status
}
