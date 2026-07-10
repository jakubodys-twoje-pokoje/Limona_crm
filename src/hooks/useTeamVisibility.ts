'use client'

import { useEffect, useState } from 'react'

export function useVisibleUserIds(userId: string | undefined, role: string | undefined) {
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    fetch('/api/team/visible-ids')
      .then(res => res.json())
      .then(data => {
        setVisibleIds(data.visibleIds)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userId, role])

  return { visibleIds, loading }
}
