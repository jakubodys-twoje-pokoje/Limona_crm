import type { PropertyStatus, DealType } from '@/types/database'

export interface StageInfo {
  value: PropertyStatus
  label: string
}

export const STAGES: Record<DealType, StageInfo[]> = {
  zadluzony_ponizej: [
    { value: 'nowa', label: 'Nowa' },
    { value: 'analiza', label: 'Analiza' },
    { value: 'oferta', label: 'Oferta wysłana' },
    { value: 'umowa_przedwstepna_kupna', label: 'Umowa przedwstępna kupna' },
    { value: 'umowa_kupna', label: 'Umowa kupna' },
    { value: 'zaplata_ceny', label: 'Zapłata ceny' },
    { value: 'odebranie_posiadania', label: 'Odebranie posiadania' },
    { value: 'odswiezenie', label: 'Odświeżenie' },
    { value: 'reklama_sprzedazy', label: 'Reklama sprzedaży' },
    { value: 'pokazywanie', label: 'Pokazywanie' },
    { value: 'umowa_przedwstepna_sprzedazy', label: 'Umowa przedwstępna sprzedaży' },
    { value: 'sprzedaz', label: 'Sprzedaż' },
    { value: 'zakonczona', label: 'Zakończona' },
  ],
  zadluzony_powyzej: [
    { value: 'nowa', label: 'Nowa' },
    { value: 'analiza', label: 'Analiza' },
    { value: 'oferta', label: 'Oferta wysłana' },
    { value: 'negocjacje_wierzyciele', label: 'Negocjacje z wierzycielami' },
    { value: 'umowa_przedwstepna_kupna', label: 'Umowa przedwstępna kupna' },
    { value: 'umowa_kupna', label: 'Umowa kupna' },
    { value: 'zaplata_ceny', label: 'Zapłata ceny' },
    { value: 'odebranie_posiadania', label: 'Odebranie posiadania' },
    { value: 'odswiezenie', label: 'Odświeżenie' },
    { value: 'reklama_sprzedazy', label: 'Reklama sprzedaży' },
    { value: 'pokazywanie', label: 'Pokazywanie' },
    { value: 'umowa_przedwstepna_sprzedazy', label: 'Umowa przedwstępna sprzedaży' },
    { value: 'sprzedaz', label: 'Sprzedaż' },
    { value: 'akt_nabycia', label: 'Akt nabycia' },
    { value: 'wynajem', label: 'Wynajem' },
    { value: 'zakonczona', label: 'Zakończona' },
  ],
  savedeal: [
    { value: 'nowa', label: 'Nowa' },
    { value: 'analiza', label: 'Analiza' },
    { value: 'umowa_savedeal', label: 'Umowa SaveDeal' },
    { value: 'wycena', label: 'Wycena' },
    { value: 'reklama_sprzedazy', label: 'Reklama sprzedaży' },
    { value: 'pokazywanie', label: 'Pokazywanie' },
    { value: 'umowa_przedwstepna_sprzedazy', label: 'Umowa przedwstępna sprzedaży' },
    { value: 'sprzedaz', label: 'Sprzedaż' },
    { value: 'zakonczona', label: 'Zakończona' },
  ],
}

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  zadluzony_ponizej: 'Zadłużona poniżej wartości',
  zadluzony_powyzej: 'Zadłużona powyżej wartości',
  savedeal: 'SaveDeal',
}

export const DEAL_TYPE_SHORT: Record<DealType, string> = {
  zadluzony_ponizej: 'Poniżej',
  zadluzony_powyzej: 'Powyżej',
  savedeal: 'SaveDeal',
}

export const LEGACY_STAGES: StageInfo[] = [
  { value: 'new', label: 'Nowa' },
  { value: 'analysis', label: 'Analiza' },
  { value: 'offer_sent', label: 'Oferta wysłana' },
  { value: 'negotiation', label: 'Negocjacja' },
  { value: 'contract', label: 'Umowa' },
  { value: 'legal_cleanup', label: 'Regulacja prawna' },
  { value: 'sale', label: 'Sprzedaż' },
  { value: 'completed', label: 'Zakończona' },
  { value: 'rejected', label: 'Odrzucona' },
]

export function getStages(dealType: DealType | null | undefined): StageInfo[] {
  if (!dealType) return LEGACY_STAGES
  return STAGES[dealType] ?? LEGACY_STAGES
}

export const STAGE_TASK_TEMPLATES: Partial<Record<string, string[]>> = {
  analiza: [
    'Zamów operat szacunkowy',
    'Sprawdź KW w przeglądarce e-KW',
    'Weryfikacja zadłużeń i wierzycieli',
    'Ocena stanu technicznego nieruchomości',
  ],
  oferta: [
    'Przygotuj ofertę zakupu',
    'Wyślij ofertę właścicielowi',
    'Potwierdź odbiór oferty telefonicznie',
  ],
  negocjacje_wierzyciele: [
    'Skontaktuj się z 1. wierzycielem',
    'Skontaktuj się z 2. wierzycielem',
    'Skontaktuj się z 3. wierzycielem',
    'Ustal warunki redukcji długu',
  ],
  umowa_przedwstepna_kupna: [
    'Przygotuj draft umowy przedwstępnej',
    'Umów wizytę u notariusza',
    'Sprawdź tożsamość właściciela',
    'Pobierz zaświadczenie o niezaleganiu z czynszem',
  ],
  umowa_kupna: [
    'Finalizuj umowę kupna u notariusza',
    'Opłać podatek PCC',
    'Złóż wniosek o zmianę właściciela w KW',
  ],
  zaplata_ceny: [
    'Przelej cenę na konto właściciela',
    'Przelej spłatę dla wierzycieli',
    'Zbierz potwierdzenia przelewów',
    'Uzyskaj potwierdzenia wykreślenia hipotek',
  ],
  odebranie_posiadania: [
    'Umów protokół zdawczo-odbiorczy',
    'Odbierz klucze',
    'Zrób dokumentację fotograficzną stanu',
    'Wymień zamki',
  ],
  odswiezenie: [
    'Zamów ekipę remontową',
    'Ustal zakres i kosztorys prac',
    'Kup materiały',
    'Nadzoruj prace',
    'Odbiór końcowy prac',
  ],
  reklama_sprzedazy: [
    'Zrób profesjonalne zdjęcia',
    'Przygotuj opis oferty',
    'Wystaw ogłoszenie na OLX',
    'Wystaw ogłoszenie na Otodom',
    'Ustaw cenę sprzedaży',
  ],
  pokazywanie: [
    'Potwierdź terminy pokazywania',
    'Przygotuj nieruchomość na pokazywanie',
    'Zebranie feedbacku od oglądających',
  ],
  umowa_przedwstepna_sprzedazy: [
    'Podpisz umowę przedwstępną sprzedaży',
    'Pobierz zaliczkę / zadatek',
    'Sprawdź financing kupującego',
  ],
  sprzedaz: [
    'Podpisz umowę sprzedaży u notariusza',
    'Przekaż klucze kupującemu',
    'Protokół zdawczo-odbiorczy sprzedaży',
  ],
  umowa_savedeal: [
    'Podpisz umowę SaveDeal',
    'Weryfikacja tytułu prawnego nieruchomości',
    'Sprawdź stan prawny u notariusza',
  ],
  wycena: [
    'Zamów niezależną wycenę (rzeczoznawca)',
    'Przygotuj raport wyceny',
    'Ustal cenę ofertową na podstawie wyceny',
  ],
}

export function getStageLabel(status: string, dealType?: DealType | null): string {
  if (dealType) {
    const found = STAGES[dealType]?.find(s => s.value === status)
    if (found) return found.label
  }
  // Search all pipelines
  for (const stages of Object.values(STAGES)) {
    const found = stages.find(s => s.value === status)
    if (found) return found.label
  }
  const legacyFound = LEGACY_STAGES.find(s => s.value === status)
  return legacyFound?.label ?? status
}
