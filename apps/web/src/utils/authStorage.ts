/**
 * Almacenamiento de sesión.
 *
 * - "Recordarme" activo  -> localStorage (la sesión sobrevive al cerrar el navegador).
 * - "Recordarme" inactivo -> sessionStorage (la sesión dura solo la pestaña actual).
 *
 * Se centraliza aquí para que la lectura funcione sin importar en qué storage
 * se guardó originalmente.
 */

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

function readFromStorages(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

/** Storage donde vive actualmente la sesión (o null si no hay token). */
export function getAuthStorage(): Storage | null {
  if (localStorage.getItem(TOKEN_KEY)) return localStorage
  if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage
  return null
}

export function getStoredToken(): string | null {
  return readFromStorages(TOKEN_KEY)
}

export function getStoredUser<T>(): T | null {
  const raw = readFromStorages(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Guarda token y usuario en el storage adecuado según "recordarme". */
export function setStoredAuth(token: string, user: unknown, remember: boolean): void {
  clearStoredAuth()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(TOKEN_KEY, token)
  storage.setItem(USER_KEY, JSON.stringify(user))
}

/** Actualiza solo el usuario en el storage donde ya está la sesión. */
export function setStoredUser(user: unknown): void {
  const storage = getAuthStorage()
  if (storage) storage.setItem(USER_KEY, JSON.stringify(user))
}

/** Elimina la sesión de ambos storages. */
export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}
