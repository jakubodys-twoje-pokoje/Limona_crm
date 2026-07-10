'use client'

// Skaluje obraz do maksymalnego wymiaru i re-koduje jako JPEG z wysoką
// jakością — redukuje rozmiar pliku bez zauważalnej utraty jakości
// (zdjęcia z telefonu / ekranu bywają wielokrotnie większe niż potrzeba
// do podglądu w CRM). Nie-obrazy i błędy dekodowania zwracają oryginał.
export async function compressImage(
  file: File,
  { maxDim = 1920, quality = 0.85 }: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], newName, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
