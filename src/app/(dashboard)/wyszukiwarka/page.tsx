'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import {
  Search, ExternalLink, Phone, Mail, Building, User, MapPin,
  Save, Trash2, Clock, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

interface KrsEntity {
  name: string
  krs: string
  nip: string
  regon: string
  address: string
  role: string
  sourceUrl?: string
}

interface ExtractedContact {
  phones: string[]
  emails: string[]
  sourceUrl: string
  sourceTitle: string
}

interface CeidgEntry {
  name: string
  nip: string
  regon: string
  address: string
  phone: string | null
  email: string | null
  status: string
}

interface GoogleResult {
  title: string
  link: string
  snippet: string
}

interface SearchLink {
  label: string
  url: string
}

interface DebugEntry {
  tag: string
  msg: string
  ms: number
  ok: boolean
}

interface SearchResults {
  krs: KrsEntity[]
  ceidg: CeidgEntry[]
  google: GoogleResult[]
  contacts: ExtractedContact[]
  searchLinks: SearchLink[]
  _debug: DebugEntry[]
}

interface SavedQuery {
  id: string
  person_name: string
  kw_number: string | null
  notes: string | null
  status: string
  results: SearchResults | null
  created_by: string | null
  created_at: string
}

const TAG_COLORS: Record<string, string> = {
  SEARCH:  '#a8ff3e',
  GOOGLE:  '#4285f4',
  KRS:     '#fbbc04',
  'KRS-API': '#ff8c00',
  CEIDG:   '#34a853',
  SCRAPE:  '#ea4335',
}

function printDebug(entries: DebugEntry[]) {
  console.groupCollapsed('%c🔍 Search Debug', 'color:#a8ff3e;font-weight:bold;font-size:13px')
  for (const e of entries) {
    const color = TAG_COLORS[e.tag] || '#aaa'
    const icon = e.ok ? '✓' : '✗'
    console.log(
      `%c${icon} [${e.tag}]%c +${e.ms}ms %c${e.msg}`,
      `color:${color};font-weight:bold`,
      'color:#666',
      e.ok ? 'color:#ddd' : 'color:#ff6b6b',
    )
  }
  console.groupEnd()
}

export default function WyszukiwarkaPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [personName, setPersonName] = useState('')
  const [kwNumber, setKwNumber] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [expandedSaved, setExpandedSaved] = useState<string | null>(null)

  useEffect(() => {
    fetchSaved()
  }, [])

  async function fetchSaved() {
    const res = await fetch('/api/research')
    if (res.ok) setSavedQueries(await res.json())
    setLoadingSaved(false)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!personName.trim()) return

    setSearching(true)
    setResults(null)

    try {
      const res = await fetch('/api/research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personName: personName.trim(), kwNumber: kwNumber.trim() || undefined }),
      })

      if (!res.ok) {
        showToast('Błąd wyszukiwania', 'error')
        setSearching(false)
        return
      }

      const data: SearchResults = await res.json()
      if (data._debug) printDebug(data._debug)
      setResults(data)
    } catch {
      showToast('Błąd połączenia', 'error')
    }

    setSearching(false)
  }

  async function handleSave() {
    if (!results || !personName.trim()) return

    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personName: personName.trim(),
        kwNumber: kwNumber.trim() || null,
        results,
      }),
    })

    if (res.ok) {
      showToast('Zapisano wyszukiwanie', 'success')
      fetchSaved()
    } else {
      showToast('Błąd zapisu', 'error')
    }
  }

  async function handleDeleteSaved(id: string) {
    const res = await fetch(`/api/research/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSavedQueries(prev => prev.filter(q => q.id !== id))
      showToast('Usunięto', 'success')
    }
  }

  function loadSavedQuery(query: SavedQuery) {
    setPersonName(query.person_name)
    setKwNumber(query.kw_number || '')
    setResults(query.results)
    setShowHistory(false)
  }

  const unifiedEntities = results ? [
    ...results.krs.map(e => ({
      name: e.name, address: e.address, phone: null as string | null, email: null as string | null,
      nip: e.nip, id: `KRS: ${e.krs}`, source: 'KRS' as const, url: e.sourceUrl,
      badge: e.role, status: null as string | null,
    })),
    ...results.ceidg.map(e => ({
      name: e.name, address: e.address, phone: e.phone, email: e.email,
      nip: e.nip, id: e.nip ? `NIP: ${e.nip}` : '', source: 'CEIDG' as const, url: null as string | null,
      badge: e.status, status: e.status,
    })),
  ] : []

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <span className="limona-eyebrow">Research</span>
        <h1 className="limona-heading text-3xl mt-1">Wyszukiwarka kontaktów</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Szukaj danych kontaktowych dłużników w KRS, CEIDG, Google i social media
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="limona-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="limona-label block mb-2">Imię i nazwisko *</label>
            <input
              className="limona-input"
              value={personName}
              onChange={e => setPersonName(e.target.value)}
              placeholder="np. Jan Kowalski"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="limona-label block mb-2">Księga wieczysta (opcjonalnie)</label>
            <input
              className="limona-input"
              value={kwNumber}
              onChange={e => setKwNumber(e.target.value)}
              placeholder="np. WA1M/00123456/7"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={searching || !personName.trim()} className="limona-btn flex items-center gap-2 disabled:opacity-40">
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {searching ? 'Szukam...' : 'Szukaj'}
          </button>
          {results && (
            <button type="button" onClick={handleSave} className="limona-btn-outline flex items-center gap-2">
              <Save size={14} />
              Zapisz wynik
            </button>
          )}
          <button type="button" onClick={() => setShowHistory(!showHistory)}
            className="ml-auto limona-btn-outline flex items-center gap-2 text-xs">
            <Clock size={12} />
            Historia ({savedQueries.length})
          </button>
        </div>
      </form>

      {/* History */}
      {showHistory && (
        <div className="limona-card p-4">
          <h3 className="text-xs uppercase tracking-wider text-limona-text-muted font-bold mb-3">Zapisane wyszukiwania</h3>
          {loadingSaved ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
          ) : savedQueries.length === 0 ? (
            <p className="text-sm text-limona-text-dim text-center py-4">Brak zapisanych wyszukiwań</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {savedQueries.map(q => (
                <div key={q.id} className="flex items-center gap-3 px-3 py-2 hover:bg-limona-surface-2/50 rounded transition-colors group">
                  <button onClick={() => loadSavedQuery(q)} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-limona-white truncate">{q.person_name}</p>
                    <p className="text-[10px] text-limona-text-dim">
                      {new Date(q.created_at).toLocaleDateString('pl-PL')}
                      {q.kw_number && ` • KW: ${q.kw_number}`}
                    </p>
                  </button>
                  <button onClick={() => handleDeleteSaved(q.id)}
                    className="p-1 text-limona-text-dim hover:text-limona-red opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {searching && (
        <div className="limona-card p-8 text-center">
          <Loader2 size={32} className="animate-spin text-limona-lime mx-auto mb-3" />
          <p className="text-limona-text-muted">Przeszukuję KRS, CEIDG...</p>
        </div>
      )}

      {results && !searching && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="limona-card p-4 text-center">
              <p className="text-2xl font-bold font-mono text-limona-lime">{results.krs.length}</p>
              <p className="text-xs text-limona-text-muted mt-1">KRS</p>
            </div>
            <div className="limona-card p-4 text-center">
              <p className="text-2xl font-bold font-mono text-limona-blue">{results.ceidg.length}</p>
              <p className="text-xs text-limona-text-muted mt-1">CEIDG</p>
            </div>
            <div className="limona-card p-4 text-center">
              <p className="text-2xl font-bold font-mono text-limona-green">{results.google?.length || 0}</p>
              <p className="text-xs text-limona-text-muted mt-1">Google</p>
            </div>
            <div className="limona-card p-4 text-center">
              <p className="text-2xl font-bold font-mono text-limona-yellow">{results.searchLinks.length}</p>
              <p className="text-xs text-limona-text-muted mt-1">Linki</p>
            </div>
          </div>

          {/* Unified entities: KRS + CEIDG */}
          {unifiedEntities.length > 0 && (
            <div className="limona-card">
              <div className="p-4 border-b border-limona-border">
                <h3 className="text-sm font-bold uppercase tracking-wider text-limona-text-muted flex items-center gap-2">
                  <Building size={14} className="text-limona-lime" />
                  Podmioty ({unifiedEntities.length})
                </h3>
              </div>
              <div className="divide-y divide-limona-border/50">
                {unifiedEntities.map((e, i) => (
                  <div key={i} className="p-4 hover:bg-limona-surface-2/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-semibold text-limona-white text-sm leading-snug flex-1 min-w-0">{e.name}</p>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                          e.source === 'KRS' ? 'bg-limona-yellow/20 text-limona-yellow' : 'bg-limona-blue/20 text-limona-blue'
                        )}>
                          {e.source}
                        </span>
                        {e.status && (
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                            e.status === 'Aktywna' ? 'bg-limona-green/20 text-limona-green' :
                              e.status === 'Zawieszona' ? 'bg-limona-yellow/20 text-limona-yellow' :
                                'bg-limona-red/20 text-limona-red'
                          )}>
                            {e.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      {e.address && (
                        <div className="flex items-center gap-1.5 text-xs text-limona-text-muted">
                          <MapPin size={11} className="flex-shrink-0 text-limona-text-dim" />
                          <span>{e.address}</span>
                        </div>
                      )}
                      {e.id && (
                        e.url ? (
                          <a href={e.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-limona-text-dim hover:text-limona-lime transition-colors">
                            <ExternalLink size={11} className="flex-shrink-0" />
                            <span>{e.id}</span>
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-limona-text-dim">
                            <span>{e.id}</span>
                          </div>
                        )
                      )}
                      {e.phone && (
                        <a href={`tel:${e.phone.replace(/\s/g, '')}`}
                          className="flex items-center gap-1.5 text-xs text-limona-lime hover:text-limona-lime/80 transition-colors">
                          <Phone size={11} className="flex-shrink-0" />
                          <span>{e.phone}</span>
                        </a>
                      )}
                      {e.email && (
                        <a href={`mailto:${e.email}`}
                          className="flex items-center gap-1.5 text-xs text-limona-lime hover:text-limona-lime/80 transition-colors">
                          <Mail size={11} className="flex-shrink-0" />
                          <span>{e.email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted contacts from Google-scraped pages */}
          {results.contacts && results.contacts.length > 0 && (
            <div className="limona-card">
              <div className="p-4 border-b border-limona-border">
                <h3 className="text-sm font-bold uppercase tracking-wider text-limona-text-muted flex items-center gap-2">
                  <Phone size={14} className="text-limona-lime" />
                  Kontakty ze stron ({results.contacts.reduce((s, c) => s + c.phones.length + c.emails.length, 0)})
                </h3>
              </div>
              <div className="divide-y divide-limona-border/50">
                {results.contacts.filter(c => c.phones.length > 0 || c.emails.length > 0).map((contact, i) => (
                  <div key={i} className="p-4">
                    <a href={contact.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-limona-text-dim hover:text-limona-lime flex items-center gap-1 mb-2 truncate">
                      <ExternalLink size={9} />
                      {contact.sourceTitle || contact.sourceUrl}
                    </a>
                    <div className="flex flex-wrap gap-3">
                      {contact.phones.map((phone, j) => (
                        <a key={j} href={`tel:${phone.replace(/\s/g, '')}`}
                          className="flex items-center gap-1.5 text-xs text-limona-lime hover:text-limona-lime/80">
                          <Phone size={12} />{phone}
                        </a>
                      ))}
                      {contact.emails.map((email, j) => (
                        <a key={j} href={`mailto:${email}`}
                          className="flex items-center gap-1.5 text-xs text-limona-lime hover:text-limona-lime/80">
                          <Mail size={12} />{email}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Google Results */}
          {results.google && results.google.length > 0 && (
            <div className="limona-card">
              <div className="p-4 border-b border-limona-border">
                <h3 className="text-sm font-bold uppercase tracking-wider text-limona-text-muted flex items-center gap-2">
                  <Search size={14} className="text-limona-green" />
                  Google ({results.google.length})
                </h3>
              </div>
              <div className="divide-y divide-limona-border/50">
                {results.google.map((item, i) => (
                  <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                    className="block p-4 hover:bg-limona-surface-2/30 transition-colors group">
                    <p className="text-sm font-medium text-limona-blue group-hover:text-limona-lime transition-colors flex items-center gap-1">
                      {item.title}
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" />
                    </p>
                    <p className="text-xs text-limona-text-dim mt-1 line-clamp-2">{item.snippet}</p>
                    <p className="text-[10px] text-limona-text-dim/50 mt-1 truncate">{item.link}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {unifiedEntities.length === 0 && (!results.google || results.google.length === 0) && (
            <div className="limona-card p-6 text-center">
              <User size={32} className="text-limona-text-dim mx-auto mb-3" />
              <p className="text-limona-text-muted">Brak wyników w KRS/CEIDG/Google</p>
              <p className="text-xs text-limona-text-dim mt-1">Spróbuj linków poniżej aby szukać ręcznie</p>
            </div>
          )}

          {/* Search Links */}
          <div className="limona-card">
            <div className="p-4 border-b border-limona-border">
              <h3 className="text-sm font-bold uppercase tracking-wider text-limona-text-muted flex items-center gap-2">
                <Search size={14} />
                Szukaj ręcznie — kliknij aby otworzyć
              </h3>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {results.searchLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 bg-limona-surface-2/50 hover:bg-limona-lime/10 hover:text-limona-lime rounded-lg transition-colors text-sm text-limona-text group"
                >
                  <ExternalLink size={12} className="text-limona-text-dim group-hover:text-limona-lime flex-shrink-0" />
                  <span className="truncate">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
