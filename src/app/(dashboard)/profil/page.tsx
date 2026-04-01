'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Mail, Lock, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'

export default function ProfilPage() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSavingProfile(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, avatar_url: avatarUrl || null })
      .eq('id', user.id)
    if (error) showToast(error.message, 'error')
    else showToast('Profil zaktualizowany', 'success')
    setSavingProfile(false)
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail) return
    setSavingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) showToast(error.message, 'error')
    else showToast('Sprawdź nową skrzynkę email, aby potwierdzić zmianę', 'success')
    setSavingEmail(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { showToast('Hasła nie są identyczne', 'error'); return }
    if (newPassword.length < 6) { showToast('Hasło musi mieć minimum 6 znaków', 'error'); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) showToast(error.message, 'error')
    else { showToast('Hasło zmienione', 'success'); setNewPassword(''); setConfirmPassword('') }
    setSavingPassword(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <span className="limona-eyebrow">Konto</span>
        <h1 className="limona-heading text-3xl mt-1">Profil</h1>
      </div>

      {/* Profile info */}
      <form onSubmit={handleSaveProfile} className="limona-card p-6 space-y-5">
        <h2 className="limona-eyebrow">Dane profilu</h2>
        <div className="flex items-center gap-4">
          <Avatar name={fullName || 'User'} url={avatarUrl || null} size="lg" />
          <div>
            <p className="text-sm text-limona-white">{fullName || 'Użytkownik'}</p>
            <p className="text-xs text-limona-text-dim">{profile?.role || 'user'}</p>
          </div>
        </div>
        <div>
          <label className="limona-label block mb-2">Imię i nazwisko</label>
          <input className="limona-input" value={fullName} onChange={e => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="limona-label block mb-2">Avatar URL</label>
          <input className="limona-input" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://... lub pozostaw puste" />
          <p className="text-xs text-limona-text-dim mt-1">Wklej link do zdjęcia profilowego</p>
        </div>
        <button type="submit" disabled={savingProfile} className="limona-btn disabled:opacity-50 flex items-center gap-2">
          <Save size={14} />
          {savingProfile ? 'Zapisywanie...' : 'Zapisz profil'}
        </button>
      </form>

      {/* Email */}
      <form onSubmit={handleChangeEmail} className="limona-card p-6 space-y-5">
        <h2 className="limona-eyebrow">Zmiana adresu email</h2>
        <p className="text-xs text-limona-text-muted">Aktualny: <span className="text-limona-white">{user?.email}</span></p>
        <div>
          <label className="limona-label block mb-2">Nowy email</label>
          <input type="email" className="limona-input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="nowy@email.com" required />
        </div>
        <button type="submit" disabled={savingEmail} className="limona-btn-outline flex items-center gap-2">
          <Mail size={14} />
          {savingEmail ? 'Wysyłanie...' : 'Zmień email'}
        </button>
      </form>

      {/* Password */}
      <form onSubmit={handleChangePassword} className="limona-card p-6 space-y-5">
        <h2 className="limona-eyebrow">Zmiana hasła</h2>
        <div>
          <label className="limona-label block mb-2">Nowe hasło</label>
          <input type="password" className="limona-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 znaków" required minLength={6} />
        </div>
        <div>
          <label className="limona-label block mb-2">Potwierdź nowe hasło</label>
          <input type="password" className="limona-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Powtórz hasło" required />
        </div>
        <button type="submit" disabled={savingPassword} className="limona-btn-outline flex items-center gap-2">
          <Lock size={14} />
          {savingPassword ? 'Zmienianie...' : 'Zmień hasło'}
        </button>
      </form>
    </div>
  )
}
