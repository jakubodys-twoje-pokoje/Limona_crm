// Nominatim geocoder (OpenStreetMap) — free, no API key.
// Rate limit: max 1 req/s. Non-blocking: returns null on failure.

export async function geocodeAddress(
  ulica: string | null | undefined,
  miasto: string | null | undefined,
  wojewodztwo: string | null | undefined,
): Promise<{ lat: number; lng: number } | null> {
  const parts = [ulica, miasto, wojewodztwo, 'Polska'].filter(Boolean)
  if (parts.length < 2) return null

  try {
    const q = encodeURIComponent(parts.join(', '))
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=pl&limit=1`,
      {
        headers: {
          'User-Agent': 'LimonaCRM/1.0 (internal business app)',
          'Accept-Language': 'pl',
        },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}
