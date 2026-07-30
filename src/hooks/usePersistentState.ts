'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * useState, który zapamiętuje wartość w sessionStorage pod danym kluczem.
 * Dzięki temu filtry list (kontakty, nieruchomości, leady, zadania) nie
 * resetują się po wejściu w kartę i powrocie — zostają do końca sesji karty.
 *
 * Odczyt następuje po zamontowaniu (nie w inicjalizatorze), żeby uniknąć
 * niezgodności hydracji SSR. Pierwszy zapis (wartość domyślna) jest pomijany,
 * by nie nadpisać zapamiętanej wartości zanim zdąży się wczytać.
 */
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial)
  const skipWrite = useRef(true)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw != null) setState(JSON.parse(raw) as T)
    } catch { /* brak/niepoprawny wpis — zostaje wartość domyślna */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (skipWrite.current) { skipWrite.current = false; return }
    try { sessionStorage.setItem(key, JSON.stringify(state)) } catch { /* pełny/zablokowany storage */ }
  }, [key, state])

  return [state, setState]
}
