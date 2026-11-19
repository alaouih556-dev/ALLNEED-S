import { useCallback, useEffect, useState } from 'react'

/* Thèmes des espaces de travail (admin, concierge, client).
   Le choix est mémorisé dans ce navigateur uniquement. */

export interface ThemePalette {
  id: string
  label: string
  accent: string
  accent2: string
}

export const THEMES: ThemePalette[] = [
  { id: 'indigo', label: 'Indigo', accent: '#6366f1', accent2: '#0ea5e9' },
  { id: 'allneeds', label: 'ALLNEEDS', accent: '#0878f9', accent2: '#13c4e8' },
  { id: 'emeraude', label: 'Émeraude', accent: '#059669', accent2: '#84cc16' },
  { id: 'violet', label: 'Violet', accent: '#8b5cf6', accent2: '#ec4899' },
  { id: 'corail', label: 'Corail', accent: '#f43f5e', accent2: '#f59e0b' },
  { id: 'ocean', label: 'Océan', accent: '#0d9488', accent2: '#3b82f6' },
]

export type ThemeMode = 'light' | 'dark' | 'auto'

const KEY = 'an-theme'

function read(): { palette: string | null; mode: ThemeMode } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || '{}') as { palette?: string; mode?: ThemeMode }
    return { palette: raw.palette ?? null, mode: raw.mode === 'dark' || raw.mode === 'auto' ? raw.mode : 'light' }
  } catch {
    return { palette: null, mode: 'light' }
  }
}

function systemDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** Thème courant + réglages. `fallbackPalette` = couleur par défaut de l’espace. */
export function useWorkspaceTheme(fallbackPalette: string) {
  const [state, setState] = useState(read)
  const [prefersDark, setPrefersDark] = useState(systemDark)

  useEffect(() => {
    let media: MediaQueryList | null = null
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)')
    } catch {
      return
    }
    const onChange = () => setPrefersDark(media!.matches)
    media.addEventListener?.('change', onChange)
    return () => media?.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* stockage indisponible : le thème reste valable pour cette session */
    }
  }, [state])

  const palette = THEMES.find((t) => t.id === (state.palette ?? fallbackPalette)) ?? THEMES[0]
  const dark = state.mode === 'dark' || (state.mode === 'auto' && prefersDark)

  const setPalette = useCallback((id: string) => setState((s) => ({ ...s, palette: id })), [])
  const setMode = useCallback((mode: ThemeMode) => setState((s) => ({ ...s, mode })), [])

  return { palette, mode: state.mode, dark, setPalette, setMode }
}
