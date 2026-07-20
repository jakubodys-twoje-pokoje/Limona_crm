import crypto from 'crypto'

/**
 * Niskopoziomowy klient Google Drive (service account, bez zewnętrznych
 * zależności — JWT RS256 podpisywany node:crypto).
 *
 * Wymagane zmienne środowiskowe:
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL  — email konta serwisowego (…@…iam.gserviceaccount.com)
 *  - GOOGLE_SERVICE_ACCOUNT_KEY   — private_key z pliku JSON konta (z \n jako literalne "\n" lub prawdziwe nowe linie)
 *  - GOOGLE_DRIVE_ROOT_FOLDER_ID  — ID folderu-korzenia CRM w Drive,
 *    udostępnionego kontu serwisowemu z uprawnieniem „Edytujący"
 *
 * Oszczędzanie limitów API: token cache'owany w pamięci procesu (~55 min),
 * ID folderów kategorii cache'owane w tabeli drive_folders, ID folderu
 * rekordu w kolumnie drive_folder_id — typowe wejście w Dokumenty to
 * JEDEN request (files.list).
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/drive/v3'
const SCOPE = 'https://www.googleapis.com/auth/drive'
export const FOLDER_MIME = 'application/vnd.google-apps.folder'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  iconLink: string | null
  modifiedTime: string | null
  size: string | null
}

export function driveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  )
}

export function driveRootId(): string {
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!
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

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }))
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
