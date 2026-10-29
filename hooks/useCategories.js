'use client'

import { getCategories } from '@/lib/api/categories'
import { useApi } from '@/hooks/useApi'

// Daftar kategori + fungsi bantu untuk mencari kategori berdasarkan id.
export function useCategories() {
  const { data, loading, error, refetch } = useApi(() => getCategories(), [])
  const categories = data || []

  function findCategory(id) {
    return categories.find((c) => c.id === id)
  }

  return { categories, findCategory, loading, error, refetch }
}
