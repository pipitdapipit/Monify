'use client'

import { useCallback, useEffect, useState } from 'react'

// Ambil data dari API dan kelola loading / error.
//
// Contoh:
//   const { data, loading, error, refetch } = useApi(() => getWallets(), [])
//
// deps sama seperti useEffect: kalau nilainya berubah, data diambil ulang.
export function useApi(fetchFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // Abaikan respons lama kalau komponen sudah pindah / deps berubah
    let ignore = false
    setLoading(true)
    setError(null)

    fetchFn()
      .then((result) => {
        if (!ignore) setData(result)
      })
      .catch((err) => {
        if (!ignore) setError(err)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey])

  const refetch = useCallback(() => setReloadKey((key) => key + 1), [])

  return { data, loading, error, refetch }
}
