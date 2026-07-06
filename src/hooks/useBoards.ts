'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Board } from '@/types/database'

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBoards = useCallback(async () => {
    const res = await fetch('/api/boards')
    if (res.ok) setBoards(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchBoards() }, [fetchBoards])

  async function createBoard(data: { name: string; color: string; lists: string[] }) {
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) return { error: 'Błąd tworzenia tablicy', data: null }
    const board = await res.json()
    setBoards(prev => [...prev, board])
    return { error: null, data: board as Board }
  }

  async function updateBoard(id: string, updates: { name?: string; color?: string }) {
    const res = await fetch(`/api/boards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) return
    setBoards(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  async function deleteBoard(id: string) {
    await fetch(`/api/boards/${id}`, { method: 'DELETE' })
    setBoards(prev => prev.filter(b => b.id !== id))
  }

  return { boards, loading, fetchBoards, createBoard, updateBoard, deleteBoard }
}
