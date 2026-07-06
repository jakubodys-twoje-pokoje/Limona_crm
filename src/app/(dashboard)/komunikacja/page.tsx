'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, MessageCircle, Users, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { WallContent } from '@/components/wall/WallContent'
import { cn } from '@/lib/utils'
// Profile type only used locally via useAuth's profile shape

type Tab = 'wall' | 'chat' | 'grupy'

type ChatPeer = { id: string; full_name: string; avatar_url: string | null; role: string }

/* ─── Direct Message types ─── */
interface DMMessage {
  id: string
  from_id: string
  to_id: string
  content: string
  read: boolean
  created_at: string
  sender: { id: string; full_name: string; avatar_url: string | null }
}

interface Conversation {
  peer: ChatPeer
  lastMessage: { content: string; created_at: string; from_id: string } | null
  unreadCount: number
}

/* ─── Group Message types ─── */
interface GroupMessage {
  id: string
  group_id: string
  user_id: string
  content: string
  created_at: string
  author: { id: string; full_name: string; avatar_url: string | null }
}

interface Group {
  id: string
  name: string
  memberCount: number
  role: string
}

/* ─── helpers ─── */
function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'teraz'
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return d.toLocaleDateString('pl-PL')
}

/* ════════════════════════════════════════════
   DIRECT CHAT TAB
   ════════════════════════════════════════════ */
function DirectChatTab({ currentUser }: { currentUser: ChatPeer }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [allProfiles, setAllProfiles] = useState<ChatPeer[]>([])
  const [selectedPeer, setSelectedPeer] = useState<ChatPeer | null>(null)
  const [messages, setMessages] = useState<DMMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [archiveMode, setArchiveMode] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/dm')
    if (res.ok) {
      setConversations(await res.json())
    }
    setLoadingConvs(false)
  }, [])

  useEffect(() => {
    fetchConversations()
    fetch('/api/profiles').then(r => r.json()).then(data => setAllProfiles(data as ChatPeer[]))
  }, [fetchConversations])

  const fetchMessages = useCallback(async (peerId: string, archive: boolean) => {
    setLoadingMsgs(true)
    const days = archive ? 90 : 30
    const res = await fetch(`/api/dm/${peerId}?days=${days}`)
    if (res.ok) setMessages(await res.json())
    setLoadingMsgs(false)
  }, [])

  useEffect(() => {
    if (!selectedPeer) return
    fetchMessages(selectedPeer.id, archiveMode)
    const id = setInterval(() => fetchMessages(selectedPeer.id, archiveMode), 10000)
    return () => clearInterval(id)
  }, [selectedPeer, fetchMessages, archiveMode])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const otherProfiles = allProfiles.filter(p => p.id !== currentUser.id)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || !selectedPeer || sending) return
    setSending(true)
    const res = await fetch(`/api/dm/${selectedPeer.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newMsg.trim() }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      setNewMsg('')
      await fetchConversations()
    }
    setSending(false)
  }

  function selectPeer(peer: ChatPeer) {
    setSelectedPeer(peer)
    setMessages([])
  }

  const conversationPeerIds = new Set(conversations.map(c => c.peer.id))

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[400px] gap-0 border border-limona-border rounded overflow-hidden">
      {/* Sidebar: conversation list */}
      <div className="w-64 flex-shrink-0 border-r border-limona-border flex flex-col bg-limona-surface">
        <div className="p-3 border-b border-limona-border">
          <p className="text-[10px] uppercase tracking-wider text-limona-text-muted font-bold">Konwersacje</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-3 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <>
              {conversations.map(c => (
                <button key={c.peer.id} onClick={() => selectPeer(c.peer)}
                  className={cn(
                    'w-full flex items-center gap-2 p-3 text-left transition-colors border-b border-limona-border/50',
                    selectedPeer?.id === c.peer.id
                      ? 'bg-limona-lime/10 text-limona-lime'
                      : 'hover:bg-limona-surface-2'
                  )}>
                  <div className="relative flex-shrink-0">
                    <Avatar name={c.peer.full_name} url={c.peer.avatar_url} size="sm" />
                    {c.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-limona-lime rounded-full text-[9px] font-bold text-black flex items-center justify-center">
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-limona-white truncate">{c.peer.full_name}</p>
                    {c.lastMessage && (
                      <p className="text-xs text-limona-text-dim truncate">
                        {c.lastMessage.from_id === currentUser.id ? 'Ty: ' : ''}{c.lastMessage.content}
                      </p>
                    )}
                  </div>
                </button>
              ))}
              {/* New conversation — show profiles without existing conversation */}
              {otherProfiles.filter(p => !conversationPeerIds.has(p.id)).map(p => (
                <button key={p.id} onClick={() => selectPeer(p)}
                  className={cn(
                    'w-full flex items-center gap-2 p-3 text-left transition-colors border-b border-limona-border/50',
                    selectedPeer?.id === p.id
                      ? 'bg-limona-lime/10 text-limona-lime'
                      : 'hover:bg-limona-surface-2'
                  )}>
                  <Avatar name={p.full_name} url={p.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-limona-white truncate">{p.full_name}</p>
                    <p className="text-xs text-limona-text-dim">Zacznij rozmowę</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main area: message thread */}
      <div className="flex-1 flex flex-col bg-limona-bg">
        {!selectedPeer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageCircle size={48} className="text-limona-text-dim mb-4" />
            <p className="text-limona-text-muted">Wybierz osobę z listy,<br />aby rozpocząć rozmowę</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-limona-border bg-limona-surface">
              <Avatar name={selectedPeer.full_name} url={selectedPeer.avatar_url} size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium text-limona-white">{selectedPeer.full_name}</p>
                <p className="text-xs text-limona-text-dim capitalize">{selectedPeer.role}</p>
              </div>
              <button
                onClick={() => setArchiveMode(!archiveMode)}
                className={cn(
                  'text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors',
                  archiveMode
                    ? 'border-limona-yellow text-limona-yellow bg-limona-yellow/10'
                    : 'border-limona-border text-limona-text-dim hover:border-limona-text-muted'
                )}
                title={archiveMode ? 'Pokaż ostatnie 30 dni' : 'Pokaż archiwum (30–90 dni)'}
              >
                {archiveMode ? '📦 Archiwum' : '🕐 Ostatnie 30 dni'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMsgs ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-limona-text-dim text-sm">
                  {archiveMode ? 'Brak wiadomości w archiwum (30–90 dni)' : 'Brak wiadomości z ostatnich 30 dni'}
                </div>
              ) : (
                messages.map(msg => {
                  const isOwn = msg.from_id === currentUser.id
                  return (
                    <div key={msg.id} className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                      <Avatar name={msg.sender.full_name} url={msg.sender.avatar_url} size="sm" />
                      <div className={cn(
                        'max-w-[70%] px-3 py-2 rounded text-sm',
                        isOwn
                          ? 'bg-limona-lime/20 text-limona-white rounded-tr-none'
                          : 'bg-limona-surface border border-limona-border rounded-tl-none'
                      )}>
                        <p className="break-words">{msg.content}</p>
                        <p className={cn('text-[10px] mt-1', isOwn ? 'text-limona-lime/60 text-right' : 'text-limona-text-dim')}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 border-t border-limona-border flex gap-2 bg-limona-surface">
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
                placeholder="Wpisz wiadomość..."
                className="flex-1 bg-limona-bg border border-limona-border rounded px-3 py-2 text-sm text-limona-white placeholder-limona-text-dim focus:outline-none focus:border-limona-lime"
              />
              <button type="submit" disabled={!newMsg.trim() || sending}
                className="limona-btn-sm flex items-center gap-2 disabled:opacity-40 flex-shrink-0">
                <Send size={14} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   GROUPS TAB
   ════════════════════════════════════════════ */
function GroupsTab({ currentUser }: { currentUser: ChatPeer }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [archiveMode, setArchiveMode] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/groups')
      .then(r => r.json())
      .then(data => { setGroups(data as Group[]); setLoadingGroups(false) })
  }, [])

  const fetchMessages = useCallback(async (groupId: string, archive: boolean) => {
    setLoadingMsgs(true)
    const days = archive ? 90 : 30
    const res = await fetch(`/api/groups/${groupId}/messages?days=${days}`)
    if (res.ok) setMessages(await res.json())
    setLoadingMsgs(false)
  }, [])

  useEffect(() => {
    if (!selectedGroup) return
    fetchMessages(selectedGroup.id, archiveMode)
    const id = setInterval(() => fetchMessages(selectedGroup.id, archiveMode), 10000)
    return () => clearInterval(id)
  }, [selectedGroup, fetchMessages, archiveMode])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || !selectedGroup || sending) return
    setSending(true)
    const res = await fetch(`/api/groups/${selectedGroup.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newMsg.trim() }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      setNewMsg('')
    }
    setSending(false)
  }

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[400px] gap-0 border border-limona-border rounded overflow-hidden">
      {/* Groups list */}
      <div className="w-64 flex-shrink-0 border-r border-limona-border flex flex-col bg-limona-surface">
        <div className="p-3 border-b border-limona-border">
          <p className="text-[10px] uppercase tracking-wider text-limona-text-muted font-bold">Grupy</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingGroups ? (
            <div className="p-3 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : groups.length === 0 ? (
            <div className="p-4 text-center text-limona-text-dim text-sm">
              Brak grup — grupy tworzone są automatycznie gdy menedżer ma przypisanych pracowników
            </div>
          ) : groups.map(g => (
            <button key={g.id} onClick={() => setSelectedGroup(g)}
              className={cn(
                'w-full flex items-start gap-2 p-3 text-left transition-colors border-b border-limona-border/50',
                selectedGroup?.id === g.id
                  ? 'bg-limona-lime/10'
                  : 'hover:bg-limona-surface-2'
              )}>
              <div className="w-8 h-8 rounded bg-limona-lime/20 flex items-center justify-center flex-shrink-0">
                <Users size={14} className="text-limona-lime" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate', selectedGroup?.id === g.id ? 'text-limona-lime' : 'text-limona-white')}>
                  {g.name}
                </p>
                <p className="text-xs text-limona-text-dim">{g.memberCount} {g.memberCount === 1 ? 'osoba' : 'osoby'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Group thread */}
      <div className="flex-1 flex flex-col bg-limona-bg">
        {!selectedGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Users size={48} className="text-limona-text-dim mb-4" />
            <p className="text-limona-text-muted">Wybierz grupę, aby zobaczyć rozmowę</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-limona-border bg-limona-surface">
              <div className="w-8 h-8 rounded bg-limona-lime/20 flex items-center justify-center flex-shrink-0">
                <Users size={14} className="text-limona-lime" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-limona-white">{selectedGroup.name}</p>
                <p className="text-xs text-limona-text-dim">{selectedGroup.memberCount} członków</p>
              </div>
              <button
                onClick={() => setArchiveMode(!archiveMode)}
                className={cn(
                  'text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors',
                  archiveMode
                    ? 'border-limona-yellow text-limona-yellow bg-limona-yellow/10'
                    : 'border-limona-border text-limona-text-dim hover:border-limona-text-muted'
                )}
              >
                {archiveMode ? '📦 Archiwum' : '🕐 Ostatnie 30 dni'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMsgs ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-limona-text-dim text-sm">
                  {archiveMode ? 'Brak wiadomości w archiwum (30–90 dni)' : 'Brak wiadomości z ostatnich 30 dni'}
                </div>
              ) : (
                messages.map(msg => {
                  const isOwn = msg.user_id === currentUser.id
                  return (
                    <div key={msg.id} className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                      <Avatar name={msg.author.full_name} url={msg.author.avatar_url} size="sm" />
                      <div className={cn(
                        'max-w-[70%] px-3 py-2 rounded text-sm',
                        isOwn
                          ? 'bg-limona-lime/20 text-limona-white rounded-tr-none'
                          : 'bg-limona-surface border border-limona-border rounded-tl-none'
                      )}>
                        {!isOwn && (
                          <p className="text-[10px] font-bold text-limona-lime mb-1">{msg.author.full_name}</p>
                        )}
                        <p className="break-words">{msg.content}</p>
                        <p className={cn('text-[10px] mt-1', isOwn ? 'text-limona-lime/60 text-right' : 'text-limona-text-dim')}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 border-t border-limona-border flex gap-2 bg-limona-surface">
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
                placeholder={`Napisz do ${selectedGroup.name}...`}
                className="flex-1 bg-limona-bg border border-limona-border rounded px-3 py-2 text-sm text-limona-white placeholder-limona-text-dim focus:outline-none focus:border-limona-lime"
              />
              <button type="submit" disabled={!newMsg.trim() || sending}
                className="limona-btn-sm flex items-center gap-2 disabled:opacity-40 flex-shrink-0">
                <Send size={14} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════ */
export default function KomunikacjaPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('wall')

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'wall',  label: 'Wall',              icon: MessageSquare },
    { id: 'chat',  label: 'Chat bezpośredni',  icon: MessageCircle },
    { id: 'grupy', label: 'Grupy',             icon: Users },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="limona-eyebrow">Komunikacja</span>
        <h1 className="limona-heading text-3xl mt-1">Komunikacja</h1>
        <p className="text-limona-text-muted text-sm mt-1">
          Wall zespołowy, czat 1:1 i grupowy
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-limona-border">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium uppercase tracking-wider transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-limona-lime text-limona-lime'
                : 'border-transparent text-limona-text-muted hover:text-limona-white'
            )}>
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'wall' && (
        <div className="max-w-3xl">
          <p className="text-limona-text-muted text-sm mb-4">
            Kanał zespołowy — wiadomości trzymane 90 dni •{' '}
            <span className="text-limona-lime">@imię</span> aby oznaczyć •{' '}
            <span className="text-limona-blue">#&quot;nazwa zadania&quot;</span> aby odnieść się do zadania
          </p>
          <WallContent />
        </div>
      )}

      {activeTab === 'chat' && profile && (
        <DirectChatTab currentUser={profile} />
      )}

      {activeTab === 'grupy' && profile && (
        <GroupsTab currentUser={profile} />
      )}
    </div>
  )
}
