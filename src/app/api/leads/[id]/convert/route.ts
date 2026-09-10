export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, unauthorized } from '@/lib/api-auth'
import { canAccessLead, recordNotFound } from '@/lib/record-access'
import { geocodeAddress } from '@/lib/geocode'
import { formatStatusChangeComment, LEAD_STATUS_LABELS } from '@/lib/status-comments'
import { driveConfigured } from '@/lib/drive'
import { migrateLeadFolderOnConvert } from '@/lib/driveEntities'

/**
 * Konwersja leada — jedyna droga do statusu 'converted'.
 *
 * Body: {
 *   comment: string                     — obowiązkowe uzasadnienie (jak każda zmiana statusu)
 *   property?: { adres, kod_pocztowy?, miasto?, notes? }   — utwórz nieruchomość
 *   klient?:   { nazwa, telefon?, email?, miasto?, ulica? } — utwórz kontakt typ 'klient'
 * }
 * Przynajmniej jedna z sekcji property/klient jest wymagana. Utworzone
 * rekordy zapisują się na leadzie (property_id / kontakt_id) — lead
 * zostaje jako zamrożony ślad, skąd co się wzięło.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const supabase = await createClient()
  const { id } = await params
  if (!(await canAccessLead(supabase, user, id))) return recordNotFound()

  const body = await req.json()
  const comment: string | undefined = body.comment

  if (!comment?.trim()) {
    return NextResponse.json({ error: 'Konwersja wymaga komentarza — opisz, co ustalono' }, { status: 400 })
  }
  if (!body.property && !body.klient) {
    return NextResponse.json({ error: 'Wybierz, co utworzyć: nieruchomość, klienta albo oba' }, { status: 400 })
  }
  if (body.property && !body.property.adres?.trim()) {
    return NextResponse.json({ error: 'Nieruchomość wymaga adresu' }, { status: 400 })
  }
  if (body.klient && !body.klient.nazwa?.trim()) {
    return NextResponse.json({ error: 'Klient wymaga imienia i nazwiska / nazwy' }, { status: 400 })
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, phone, email, location, status, assigned_to, property_id, kontakt_id')
    .eq('id', id)
    .maybeSingle()
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (lead.status === 'converted') {
    return NextResponse.json({ error: 'Ten lead został już skonwertowany' }, { status: 409 })
  }

  // Właścicielem nowych rekordów zostaje agent prowadzący leada (fallback: wykonujący konwersję)
  const ownerId = lead.assigned_to || user.id

  let kontaktId: string | null = null
  let propertyId: string | null = null

  if (body.klient) {
    const coords = await geocodeAddress(body.klient.ulica || null, body.klient.miasto || null, null)
    const { data: kontakt, error } = await supabase
      .from('kontakty')
      .insert({
        typ: 'klient',
        nazwa: body.klient.nazwa.trim(),
        telefon: body.klient.telefon?.trim() || lead.phone,
        email: body.klient.email?.trim() || lead.email,
        miasto: body.klient.miasto || null,
        ulica: body.klient.ulica || null,
        opis: `Klient z leada „${lead.name}"`,
        assigned_to: ownerId,
        created_by: user.id,
        ...(coords ?? {}),
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: `Błąd tworzenia klienta: ${error.message}` }, { status: 500 })
    kontaktId = kontakt.id
  }

  if (body.property) {
    const coords = await geocodeAddress(body.property.adres, body.property.miasto || null, null)
    const { data: property, error } = await supabase
      .from('properties')
      .insert({
        adres: body.property.adres.trim(),
        kod_pocztowy: body.property.kod_pocztowy || null,
        miasto: body.property.miasto || null,
        owner_name: body.klient?.nazwa?.trim() || lead.name,
        phone: body.klient?.telefon?.trim() || lead.phone,
        notes: body.property.notes || `Nieruchomość z leada „${lead.name}"`,
        assigned_to: ownerId,
        created_by: user.id,
        ...(coords ?? {}),
      })
      .select('id')
      .single()
    if (error) {
      // Klient mógł już powstać — nie wycofujemy (świadomie: częściowa konwersja
      // jest widoczna na leadzie i można ją dokończyć ręcznie), ale zgłaszamy
      if (kontaktId) {
        await supabase.from('leads').update({ kontakt_id: kontaktId }).eq('id', id)
      }
      return NextResponse.json({ error: `Błąd tworzenia nieruchomości: ${error.message}` }, { status: 500 })
    }
    propertyId = property.id

    await supabase.from('activity_log').insert({
      property_id: propertyId,
      user_id: user.id,
      action: 'created',
      details: { adres: body.property.adres, miasto: body.property.miasto, from_lead: lead.id },
    })
  }

  const { data: updated, error: updateError } = await supabase
    .from('leads')
    .update({
      status: 'converted',
      converted_at: new Date().toISOString(),
      property_id: propertyId ?? lead.property_id,
      kontakt_id: kontaktId ?? lead.kontakt_id,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from('lead_comments').insert({
    lead_id: id,
    user_id: user.id,
    content: formatStatusChangeComment(
      LEAD_STATUS_LABELS.converted,
      `${comment.trim()}${propertyId ? '\n→ utworzono nieruchomość' : ''}${kontaktId ? '\n→ utworzono klienta' : ''}`,
    ),
  })

  // Google Drive: pliki leada wędrują do folderu nieruchomości/klienta,
  // folder leada trafia do Leady/Archiwum. Best-effort — awaria Drive
  // nie może zablokować samej konwersji.
  let driveWarning: string | null = null
  if (driveConfigured()) {
    try {
      await migrateLeadFolderOnConvert(supabase, id, lead.name, { propertyId, kontaktId })
    } catch (e) {
      driveWarning = `Konwersja OK, ale nie udało się przenieść plików w Google Drive: ${e instanceof Error ? e.message : e}`
    }
  }

  return NextResponse.json({ lead: updated, propertyId, kontaktId, driveWarning })
}
