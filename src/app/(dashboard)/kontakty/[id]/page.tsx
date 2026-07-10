'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, Phone, Mail, MapPin, Clock, User,
  CheckSquare, Square, Edit, Trash2, ExternalLink, Plus, Circle, CheckCircle, Users, X, ListTodo
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/hooks/useTasks'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { KontaktForm } from '@/components/kontakty/KontaktForm'
import { KontaktKomentarze } from '@/components/kontakty/KontaktKomentarze'
import { StatusChangeCommentModal } from '@/components/shared/StatusChangeCommentModal'
import { cn } from '@/lib/utils'
import { formatWeeklyHours } from '@/lib/godziny'
import type { Kontakt, KontaktTyp, KontaktShare, Profile, Task } from '@/types/database'

const KontaktMiniMap = dynamic(() => import('@/components/kontakty/KontaktMiniMap'), { ssr: false })
import { KONTAKT_TYP_LABELS, TYPY_SPOLDZIELNIA, TYPY_Z_PROWIZJA } from '@/types/database'

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2 border-b border-limona-border/40 last:border-0">
      <Icon size={14} className="text-limona-text-muted mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-limona-text-dim">{label}</p>
        <p className="text-sm text-limona-text break-words">{value}</p>
      </div>
    </div>
  )
}

function CheckboxRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 text-sm py-1.5 w-full text-left hover:text-limona-white transition-colors group"
    >
      {checked
        ? <CheckSquare size={16} className="text-limona-lime flex-shrink-0" />
        : <Square size={16} className="text-limona-text-dim flex-shrink-0 group-hover:text-limona-text-muted" />
      }
      <span className={cn(checked ? 'text-limona-white' : 'text-limona-text-muted')}>{label}</span>
    </button>
  )
}

export default function KontaktDetailPage() {
  const { id } = useParams()
  const kontaktId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const { tasks, createTask, updateTask, deleteTask } = useTasks(undefined, undefined, undefined, kontaktId)

  const [kontakt, setKontakt] = useState<Kontakt | null>(null)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  // Udostępnianie
  const [shares, setShares] = useState<KontaktShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const [shareUserId, setShareUserId] = useState('')

  async function loadKontakt() {
    const res = await fetch(`/api/kontakty/${kontaktId}`)
    if (!res.ok) { router.push('/kontakty'); return }
    setKontakt(await res.json())
    setLoading(false)
  }

  async function loadShares() {
    setSharesLoading(true)
    const res = await fetch(`/api/kontakty/${kontaktId}/shares`)
    if (res.ok) setShares(await res.json())
    setSharesLoading(false)
  }

  useEffect(() => {
    loadKontakt()
    loadShares()
    fetch('/api/profiles').then(r => r.ok ? r.json() : []).then(setProfiles)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kontaktId])

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskTitle.trim() || !user) return
    await createTask({ title: newTaskTitle.trim(), kontakt_id: kontaktId, status: 'todo', priority: 'medium' }, user.id)
    setNewTaskTitle('')
  }

  async function handleToggleTask(task: Task) {
    if (!user) return
    await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' }, user.id)
  }

  async function handleAddShare(e: React.FormEvent) {
    e.preventDefault()
    if (!shareUserId) return
    const res = await fetch(`/api/kontakty/${kontaktId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: shareUserId }),
    })
    if (res.ok) { setShareUserId(''); loadShares() }
    else showToast((await res.json()).error || 'Błąd udostępniania', 'error')
  }

  async function handleRemoveShare(shareId: string) {
    await fetch(`/api/kontakty/${kontaktId}/shares/${shareId}`, { method: 'DELETE' })
    setShares(prev => prev.filter(s => s.id !== shareId))
  }

  async function patchField(updates: Partial<Kontakt> & { statusComment?: string }) {
    if (!kontakt) return
    setSaving(true)
    const res = await fetch(`/api/kontakty/${kontaktId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const updated: Kontakt = await res.json()
      setKontakt(updated)
    } else {
      showToast((await res.json()).error || 'Błąd zapisu', 'error')
    }
    setSaving(false)
  }

  // Chęć współpracy / niezainteresowani = decyzje, które trzeba uzasadnić
  const [pendingFlag, setPendingFlag] = useState<
    { field: 'chec_wspolpracy' | 'niezainteresowani'; newValue: boolean; label: string } | null
  >(null)

  function toggleDecisionFlag(field: 'chec_wspolpracy' | 'niezainteresowani', newValue: boolean, label: string) {
    setPendingFlag({ field, newValue, label })
  }

  async function confirmFlagChange(comment: string) {
    if (!pendingFlag) return
    const { field, newValue } = pendingFlag
    setPendingFlag(null)
    await patchField({ [field]: newValue, statusComment: comment })
  }

  async function handleEdit(data: Partial<Kontakt>) {
    await patchField(data)
    showToast('Zaktualizowano kontakt', 'success')
    setShowEditModal(false)
  }

  async function handleDelete() {
    const res = await fetch(`/api/kontakty/${kontaktId}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Kontakt usunięty', 'success')
      router.push('/kontakty')
    } else {
      showToast('Błąd usuwania', 'error')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!kontakt || !kontaktId) return null
  const currentKontaktId = kontaktId

  const typ = kontakt.typ as KontaktTyp
  const isSpoldzielnia = TYPY_SPOLDZIELNIA.has(typ)
  const hasProwizja = TYPY_Z_PROWIZJA.has(typ)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/kontakty"
          className="mt-1 p-1.5 rounded text-limona-text-muted hover:text-limona-white hover:bg-limona-surface-2 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs uppercase tracking-widest text-limona-lime font-bold">
              {KONTAKT_TYP_LABELS[typ] || typ}
            </span>
            {saving && <span className="text-xs text-limona-text-dim animate-pulse">Zapisywanie…</span>}
          </div>
          <h1 className="limona-heading text-2xl mt-0.5">{kontakt.nazwa}</h1>
          {(kontakt.miasto || kontakt.wojewodztwo) && (
            <p className="text-limona-text-muted text-sm mt-0.5">
              {[kontakt.miasto, kontakt.wojewodztwo].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm border border-limona-border text-limona-text-muted hover:border-limona-text-muted hover:text-limona-white transition-colors"
          >
            <Edit size={13} /> Edytuj
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded border border-limona-border text-limona-text-muted hover:border-limona-red hover:text-limona-red transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details + statuses */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact info */}
          <div className="limona-card p-5">
            <p className="limona-eyebrow mb-4">Dane kontaktowe</p>
            <div className="space-y-0">
              <InfoRow icon={Phone}    label="Telefon"       value={kontakt.telefon} />
              <InfoRow icon={Mail}     label="E-mail"        value={kontakt.email} />
              <InfoRow icon={MapPin}   label="Adres"         value={[kontakt.ulica, kontakt.miasto, kontakt.wojewodztwo].filter(Boolean).join(', ')} />
              <InfoRow icon={Clock}    label="Godziny otwarcia / przyjęć stron" value={formatWeeklyHours(kontakt.godziny_otwarcia)} />
              <InfoRow icon={User}     label="Oddział"       value={kontakt.oddzial} />
            </div>

            {kontakt.assignee && (
              <div className="mt-4 pt-4 border-t border-limona-border/40">
                <p className="text-[10px] uppercase tracking-wider text-limona-text-dim mb-2">Opiekun</p>
                <div className="flex items-center gap-2">
                  <Avatar name={kontakt.assignee.full_name} url={kontakt.assignee.avatar_url} size="sm" />
                  <span className="text-sm text-limona-text">{kontakt.assignee.full_name}</span>
                </div>
              </div>
            )}

            {kontakt.opis && (
              <div className="mt-4 pt-4 border-t border-limona-border/40">
                <p className="text-[10px] uppercase tracking-wider text-limona-text-dim mb-2">Opis</p>
                <p className="text-sm text-limona-text whitespace-pre-wrap">{kontakt.opis}</p>
              </div>
            )}

            {/* Mini-mapa */}
            <div className="mt-4 pt-4 border-t border-limona-border/40">
              <p className="text-[10px] uppercase tracking-wider text-limona-text-dim mb-3">Lokalizacja</p>
              <KontaktMiniMap
                lat={kontakt.lat}
                lng={kontakt.lng}
                nazwa={kontakt.nazwa}
                kontaktId={currentKontaktId}
                onGeocode={(newLat: number, newLng: number) => setKontakt(prev => prev ? { ...prev, lat: newLat, lng: newLng } : prev)}
              />
            </div>
          </div>

          {/* Zadania */}
          <div className="limona-card p-5">
            <p className="limona-eyebrow mb-4 flex items-center gap-2">
              <ListTodo size={14} /> Zadania ({tasks.length})
            </p>
            <form onSubmit={handleAddTask} className="flex gap-2 mb-3">
              <input
                className="limona-input flex-1"
                placeholder="Dodaj zadanie..."
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
              />
              <button type="submit" className="limona-btn-sm flex items-center gap-1 whitespace-nowrap">
                <Plus size={14} /> Dodaj
              </button>
            </form>
            {tasks.length === 0 ? (
              <p className="text-center text-limona-text-muted text-sm py-4">Brak zadań</p>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2.5 rounded bg-limona-surface-2/40">
                    <button
                      onClick={() => handleToggleTask(task)}
                      className={cn('flex-shrink-0 transition-colors', task.status === 'done' ? 'text-limona-green' : 'text-limona-text-dim hover:text-limona-lime')}
                    >
                      {task.status === 'done' ? <CheckCircle size={16} /> : <Circle size={16} />}
                    </button>
                    <p className={cn('flex-1 text-sm', task.status === 'done' ? 'line-through text-limona-text-muted' : 'text-limona-text')}>
                      {task.title}
                    </p>
                    <Badge value={task.priority} />
                    <button onClick={() => deleteTask(task.id)} className="p-1 text-limona-text-dim hover:text-limona-red transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Udostępnianie */}
          <div className="limona-card p-5">
            <p className="limona-eyebrow mb-4 flex items-center gap-2">
              <Users size={14} /> Udostępnianie ({shares.length})
            </p>
            <form onSubmit={handleAddShare} className="flex gap-2 mb-3">
              <select className="limona-input flex-1" value={shareUserId} onChange={e => setShareUserId(e.target.value)}>
                <option value="">Wybierz osobę...</option>
                {profiles
                  .filter(p => p.id !== kontakt.assigned_to && !shares.some(s => s.shared_with_user_id === p.id))
                  .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <button type="submit" disabled={!shareUserId} className="limona-btn-sm whitespace-nowrap disabled:opacity-40">Udostępnij</button>
            </form>
            {sharesLoading ? (
              <Skeleton className="h-8" />
            ) : shares.length === 0 ? (
              <p className="text-xs text-limona-text-dim">Kontakt widoczny tylko dla opiekuna i zespołu. Udostępnij, by pokazać go innym.</p>
            ) : (
              <div className="space-y-2">
                {shares.map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded bg-limona-surface-2/40">
                    <Avatar name={s.shared_with?.full_name || '?'} url={s.shared_with?.avatar_url} size="sm" />
                    <span className="flex-1 text-sm text-limona-text">{s.shared_with?.full_name || '—'}</span>
                    <button onClick={() => handleRemoveShare(s.id)} className="p-1 text-limona-text-dim hover:text-limona-red transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Statuses */}
          <div className="limona-card p-5">
            <p className="limona-eyebrow mb-4">Statusy realizacji</p>
            <div className="space-y-0.5">
              <CheckboxRow
                checked={kontakt.wizyta_osobista}
                label="Wizyta osobista"
                onToggle={() => patchField({ wizyta_osobista: !kontakt.wizyta_osobista })}
              />
              <CheckboxRow
                checked={kontakt.wyslany_mail_oferta}
                label="Wysłany mail z ofertą / zostawiona oferta"
                onToggle={() => patchField({ wyslany_mail_oferta: !kontakt.wyslany_mail_oferta })}
              />
            </div>

            <p className="limona-eyebrow mt-5 mb-3">Statusy wykonawcze</p>
            <div className="space-y-0.5">
              <CheckboxRow
                checked={kontakt.chec_wspolpracy}
                label="Chęć współpracy (będą polecać)"
                onToggle={() => toggleDecisionFlag('chec_wspolpracy', !kontakt.chec_wspolpracy, 'Chęć współpracy')}
              />
              <CheckboxRow
                checked={kontakt.niezainteresowani}
                label="Niezainteresowani"
                onToggle={() => toggleDecisionFlag('niezainteresowani', !kontakt.niezainteresowani, 'Niezainteresowani')}
              />
              {isSpoldzielnia && (
                <>
                  <CheckboxRow
                    checked={kontakt.zgoda_ulotki}
                    label="Zgoda na ulotki"
                    onToggle={() => patchField({ zgoda_ulotki: !kontakt.zgoda_ulotki })}
                  />
                  <CheckboxRow
                    checked={kontakt.zgoda_plakat}
                    label="Zgoda na plakat"
                    onToggle={() => patchField({ zgoda_plakat: !kontakt.zgoda_plakat })}
                  />
                  <CheckboxRow
                    checked={kontakt.operator_budowy_zainteresowani}
                    label="Operator do budowy na gruncie — zainteresowani"
                    onToggle={() => patchField({ operator_budowy_zainteresowani: !kontakt.operator_budowy_zainteresowani })}
                  />
                </>
              )}
            </div>

            {/* Prowizja / umowa */}
            {hasProwizja && kontakt.chec_wspolpracy && (
              <div className="mt-5 pt-4 border-t border-limona-border/40 space-y-2">
                <p className="limona-eyebrow mb-3">Warunki współpracy</p>
                {kontakt.ustalona_prowizja && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-limona-text-dim">Ustalona prowizja</p>
                    <p className="text-sm text-limona-lime font-medium mt-0.5">{kontakt.ustalona_prowizja}</p>
                  </div>
                )}
                {kontakt.umowa_url && (
                  <a
                    href={kontakt.umowa_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-limona-blue hover:underline"
                  >
                    <ExternalLink size={13} /> Otwórz umowę
                  </a>
                )}
                {!kontakt.ustalona_prowizja && !kontakt.umowa_url && (
                  <p className="text-xs text-limona-text-dim">Brak szczegółów — edytuj kontakt, by uzupełnić.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: comments */}
        <div className="limona-card p-5">
          <KontaktKomentarze kontaktId={currentKontaktId} />
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edytuj kontakt" size="xl">
        <KontaktForm
          initial={kontakt}
          profiles={profiles}
          onSubmit={handleEdit}
          onCancel={() => setShowEditModal(false)}
          submitLabel="Zapisz zmiany"
        />
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Potwierdź usunięcie" size="sm">
        <div className="space-y-4">
          <p className="text-limona-text">
            Czy na pewno usunąć{' '}
            <span className="text-limona-white font-medium">{kontakt.nazwa}</span>?
            Tej operacji nie można cofnąć. Wszystkie komentarze zostaną usunięte.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowDeleteModal(false)} className="limona-btn-outline">
              Anuluj
            </button>
            <button
              onClick={handleDelete}
              className="bg-limona-red text-white font-bold uppercase tracking-wider rounded-full px-6 py-3 text-sm hover:opacity-90 transition-opacity"
            >
              Usuń
            </button>
          </div>
        </div>
      </Modal>

      <StatusChangeCommentModal
        isOpen={!!pendingFlag}
        onClose={() => setPendingFlag(null)}
        onConfirm={confirmFlagChange}
        newStatusLabel={pendingFlag ? `${pendingFlag.label}: ${pendingFlag.newValue ? 'tak' : 'nie'}` : ''}
        entityLabel="kontaktu"
      />
    </div>
  )
}
