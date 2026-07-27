import crypto from 'crypto'
import { getSetting, setSetting } from '@/lib/appSettings'

/**
 * Niskopoziomowy klient Google Drive (bez zewnętrznych zależności).
 * Dwa tryby uwierzytelnienia — wybierany automatycznie z env:
 *
 * 1. OAuth (zalecany dla zwykłych kont Google): admin łączy konto
 *    jednym kliknięciem w panelu Admin, refresh token ląduje w tabeli
 *    app_settings (service role only). Pliki należą do połączonego
 *    konta i liczą się do jego miejsca. Zakres drive.file — CRM widzi
 *    wyłącznie foldery/pliki, które sam utworzył. Env:
 *      GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
 *      (opcjonalnie GOOGLE_OAUTH_REDIRECT_URL, gdy origin za proxy)
 *    Folder-korzeń „Limona CRM" tworzy się sam na Dysku połączonego
 *    konta (ID w app_settings) — GOOGLE_DRIVE_ROOT_FOLDER_ID zbędne.
 *
 * 2. Konto serwisowe (Workspace/Dysk współdzielony). Env:
 *      GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY,
 *      GOOGLE_DRIVE_ROOT_FOLDER_ID (+ ew. GOOGLE_DRIVE_IMPERSONATE_USER)
 *
 * Oszczędzanie limitów API: token cache'owany w pamięci procesu (~55 min),
 * ID folderów kategorii cache'owane w tabeli drive_folders, ID folderu
 * rekordu w kolumnie drive_folder_id — typowe wejście w Dokumenty to
 * JEDEN request (files.list).
 */

import { FOLDER_MIME } from '@/lib/driveShared'
export { FOLDER_MIME }

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/drive/v3'
const SCOPE = 'https://www.googleapis.com/auth/drive'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  iconLink: string | null
  modifiedTime: string | null
  size: string | null
}

export type DriveAuthMode = 'oauth' | 'sa' | null

/** Który tryb uwierzytelnienia jest skonfigurowany w env (OAuth ma pierwszeństwo) */
export function driveAuthMode(): DriveAuthMode {
  if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) return 'oauth'
  if (
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  ) return 'sa'
  return null
}

export function driveConfigured(): boolean {
  return driveAuthMode() !== null
}

const REFRESH_TOKEN_KEY = 'google_oauth_refresh_token'
const OAUTH_ROOT_KEY = 'google_drive_root_folder_id'
// Zapamiętany poziom publicznego dostępu ustawiony na korzeniu — pozwala
// nie odpytywać Drive przy każdym otwarciu Dokumentów (patrz ensureRootShared)
const PUBLIC_ACCESS_KEY = 'drive_public_access_role'

export type DriveShareRole = 'reader' | 'writer'

/** Tryb OAuth: czy admin połączył już konto Google (refresh token w bazie) */
export async function driveOAuthConnected(): Promise<boolean> {
  return !!(await getSetting(REFRESH_TOKEN_KEY))
}

/**
 * ID folderu-korzenia CRM. Tryb SA: z env. Tryb OAuth: folder „Limona CRM"
 * tworzony przez aplikację na Dysku połączonego konta (zakres drive.file
 * widzi tylko własne pliki, więc korzeń musi utworzyć sama aplikacja).
 */
export async function resolveRootFolderId(): Promise<string> {
  if (driveAuthMode() === 'sa') return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!
  const stored = await getSetting(OAUTH_ROOT_KEY)
  if (stored) return stored
  const folderId = await createFolder('Limona CRM', 'root')
  await setSetting(OAUTH_ROOT_KEY, folderId)
  return folderId
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

function b64url(input: Buffer | string): string {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token
  if (driveAuthMode() === 'oauth') return getOAuthAccessToken()
  return getServiceAccountAccessToken()
}

/** Tryb OAuth: access token z refresh tokena zapisanego w app_settings */
async function getOAuthAccessToken(): Promise<string> {
  const refreshToken = await getSetting(REFRESH_TOKEN_KEY)
  if (!refreshToken) {
    throw new Error('Google Drive: konto nie jest połączone — administrator musi kliknąć „Połącz z Google Drive" w panelu Admin')
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) {
    throw new Error(`Google OAuth refresh: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 }
  return cachedToken.token
}

async function getServiceAccountAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, '\n')
  // Opcjonalna delegacja domenowa (Workspace): token działa jako wskazany
  // użytkownik — pliki wgrywane z CRM należą wtedy do niego i liczą się do
  // jego miejsca (konto serwisowe samo nie ma quoty na Dysku).
  const impersonate = process.env.GOOGLE_DRIVE_IMPERSONATE_USER
  const now = Math.floor(Date.now() / 1000)

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
    ...(impersonate ? { sub: impersonate } : {}),
  }))
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const jwt = `${header}.${claims}.${b64url(signer.sign(key))}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    throw new Error(`Google OAuth: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  // 5 min zapasu przed faktycznym wygaśnięciem
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 }
  return cachedToken.token
}

async function driveFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken()
  const sep = path.includes('?') ? '&' : '?'
  // supportsAllDrives — działa też, gdy korzeń CRM leży na Dysku współdzielonym
  const res = await fetch(`${API}${path}${sep}supportsAllDrives=true`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    throw new Error(`Google Drive ${path.split('?')[0]}: ${res.status} ${await res.text()}`)
  }
  return res
}

/** Escapowanie nazwy do zapytania q (apostrofy i backslashe) */
function q(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export async function findFolder(name: string, parentId: string): Promise<string | null> {
  const query = encodeURIComponent(
    `name = '${q(name)}' and '${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`
  )
  const res = await driveFetch(`/files?q=${query}&fields=files(id)&pageSize=1&includeItemsFromAllDrives=true`)
  const { files } = await res.json()
  return files?.[0]?.id ?? null
}

export async function createFolder(name: string, parentId: string): Promise<string> {
  const res = await driveFetch('/files?fields=id', {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  })
  return (await res.json()).id
}

export async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  return (await findFolder(name, parentId)) ?? createFolder(name, parentId)
}

export async function listFiles(folderId: string): Promise<DriveFile[]> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const fields = encodeURIComponent('files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size)')
  const res = await driveFetch(
    `/files?q=${query}&fields=${fields}&pageSize=100&orderBy=folder,name&includeItemsFromAllDrives=true`
  )
  return (await res.json()).files ?? []
}

/** Przenosi plik/folder między folderami (zmiana rodzica, bez kopiowania) */
export async function moveItem(itemId: string, fromParentId: string, toParentId: string): Promise<void> {
  await driveFetch(`/files/${itemId}?addParents=${toParentId}&removeParents=${fromParentId}&fields=id`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
}

export async function renameItem(itemId: string, name: string): Promise<void> {
  await driveFetch(`/files/${itemId}?fields=id`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

/** Rodzice pliku/folderu — do weryfikacji, że element leży w drzewie rekordu */
export async function getParents(itemId: string): Promise<string[]> {
  const res = await driveFetch(`/files/${itemId}?fields=parents`)
  return (await res.json()).parents ?? []
}

/** Przenosi do kosza Drive (nie kasuje trwale — da się odzyskać) */
export async function trashItem(itemId: string): Promise<void> {
  await driveFetch(`/files/${itemId}?fields=id`, {
    method: 'PATCH',
    body: JSON.stringify({ trashed: true }),
  })
}

/**
 * Ustawia uprawnienie „każdy z linkiem" na pliku/folderze (idempotentnie).
 * allowFileDiscovery=false → link działa, ale element nie wyskakuje w
 * wyszukiwarce Google. Gdy uprawnienie już istnieje z inną rolą — podmienia.
 */
export async function shareAnyone(fileId: string, role: DriveShareRole): Promise<void> {
  const res = await driveFetch(`/files/${fileId}/permissions?fields=permissions(id,type,role)`)
  const perms: { id: string; type: string; role: string }[] = (await res.json()).permissions ?? []
  const existing = perms.find(p => p.type === 'anyone')
  if (existing) {
    if (existing.role !== role) {
      await driveFetch(`/files/${fileId}/permissions/${existing.id}?fields=id`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
    }
    return
  }
  await driveFetch(`/files/${fileId}/permissions?fields=id`, {
    method: 'POST',
    body: JSON.stringify({ type: 'anyone', role, allowFileDiscovery: false }),
  })
}

/**
 * Gwarantuje, że folder-korzeń CRM jest udostępniony „każdemu z linkiem".
 * Uprawnienia w Drive dziedziczą się w dół, więc jedno ustawienie na
 * korzeniu obejmuje wszystkie foldery rekordów i pliki (również przyszłe) —
 * dzięki temu linki webViewLink otwierają się każdemu użytkownikowi CRM bez
 * logowania na konto Google właściciela dysku.
 *
 * Tani no-op przy kolejnych wywołaniach: zapamiętany poziom w app_settings
 * pozwala pominąć odpytywanie Drive, dopóki żądana rola się nie zmieni.
 */
export async function ensureRootShared(role: DriveShareRole = 'writer'): Promise<void> {
  if ((await getSetting(PUBLIC_ACCESS_KEY)) === role) return
  const rootId = await resolveRootFolderId()
  await shareAnyone(rootId, role)
  await setSetting(PUBLIC_ACCESS_KEY, role)
}

const FILE_FIELDS = 'id,name,mimeType,webViewLink,iconLink,modifiedTime,size'

/** Upload pliku (multipart) do wskazanego folderu */
export async function uploadFile(
  name: string,
  mimeType: string,
  data: Buffer,
  parentId: string,
): Promise<DriveFile> {
  const token = await getAccessToken()
  const boundary = `limona-${crypto.randomBytes(12).toString('hex')}`
  const metadata = JSON.stringify({ name, parents: [parentId] })

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`
    ),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=${encodeURIComponent(FILE_FIELDS)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: new Uint8Array(body),
    }
  )
  if (!res.ok) {
    throw new Error(`Google Drive upload: ${res.status} ${await res.text()}`)
  }
  return res.json()
}
