'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { THEME_KEY } from '@/utils/theme'

const THEMES = ['light', 'dark', 'system']

const ThemeContext = createContext(null)

// Pilihan user: 'light' | 'dark' | 'system' (ikuti pengaturan HP/komputer).
function readStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return THEMES.includes(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }) {
  // Nilai awal sama di server dan browser; nilai sebenarnya dibaca setelah mount.
  // Class "dark" sudah dipasang skrip di <head> (app/layout.jsx), jadi tidak berkedip.
  const [theme, setThemeState] = useState('system')
  const [systemDark, setSystemDark] = useState(false)
  const [ready, setReady] = useState(false)

  // Ikuti perubahan tema sistem (mis. HP otomatis gelap saat malam)
  useEffect(() => {
    setThemeState(readStoredTheme())
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(query.matches)
    setReady(true)
    const handleChange = (e) => setSystemDark(e.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  // Pasang / lepas class "dark" di <html>
  // (menunggu ready, supaya nilai awal 'system' tidak menghapus class dari skrip <head>)
  useEffect(() => {
    if (!ready) return
    document.documentElement.classList.toggle('dark', isDark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0b1120' : '#0d9488')
  }, [isDark, ready])

  function setTheme(value) {
    setThemeState(value)
    try {
      localStorage.setItem(THEME_KEY, value)
    } catch {
      // localStorage bisa diblokir; tema tetap berubah sampai halaman ditutup
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme, isDark }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
