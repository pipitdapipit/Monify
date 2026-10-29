'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as authApi from '@/lib/api/auth'
import { USE_MOCK, clearToken, getToken, setToken, setUnauthorizedHandler } from '@/lib/api/client'
import { supabase } from '@/lib/api/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // true selama kita mengecek sesi yang tersimpan saat aplikasi dibuka
  const [checking, setChecking] = useState(true)

  const logout = useCallback(() => {
    authApi.logout().catch(() => {})
    clearToken()
    setUser(null)
  }, [])

  useEffect(() => {
    // Kalau backend AI membalas 401, user dikeluarkan otomatis
    setUnauthorizedHandler(logout)

    // Mode mock: tanpa token berarti belum login
    if (USE_MOCK && !getToken()) {
      setChecking(false)
      return
    }
    authApi
      .getMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setChecking(false))

    // Supabase mengabari kalau sesi berakhir (mis. logout dari tab lain)
    if (USE_MOCK || !supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null)
    })
    return () => data.subscription.unsubscribe()
  }, [logout])

  async function login(email, password) {
    const data = await authApi.login({ email, password })
    if (USE_MOCK) setToken(data.token)
    setUser(data.user)
  }

  // Mengembalikan { needsConfirmation: true } kalau email perlu dikonfirmasi dulu
  async function register(name, email, password) {
    const data = await authApi.register({ name, email, password })
    if (data.needsConfirmation) return data
    if (USE_MOCK) setToken(data.token)
    setUser(data.user)
    return data
  }

  const value = { user, checking, login, register, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
