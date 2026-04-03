'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import type { Property } from '@/types/database'

/**
 * @param visibleUserIds - array of user IDs whose properties to show (null = show all, e.g. for admin)
 */
export function useProperties(visibleUserIds?: string[] | null) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProperties = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('properties')
      .select(`
        *,
        creator:created_by(id, full_name, avatar_url),
        assignee:assigned_to(id, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })

    // Apply visibility filter
    if (visibleUserIds && visibleUserIds.length > 0) {
      query = query.or(
        `assigned_to.in.(${visibleUserIds.join(',')}),created_by.in.(${visibleUserIds.join(',')})`
      )
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
    } else {
      setProperties((data as Property[]) || [])
    }
    setLoading(false)
  }, [visibleUserIds])

  const debouncedFetchProperties = useDebouncedCallback(fetchProperties, 500)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    fetchProperties()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`properties-changes-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'properties',
      }, debouncedFetchProperties)
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [fetchProperties])

  const createProperty = async (data: Partial<Property>, userId: string): Promise<{ data: Property | null; error: string | null }> => {
    const { data: newProp, error } = await supabase
      .from('properties')
      .insert({ ...data, created_by: userId })
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    await supabase.from('activity_log').insert({
      property_id: (newProp as Property).id,
      user_id: userId,
      action: 'created',
      details: { location: (newProp as Property).location },
    })
    return { data: newProp as Property, error: null }
  }

  const updateProperty = async (id: string, updates: Partial<Property>, userId: string) => {
    const { data, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    await supabase.from('activity_log').insert({
      property_id: id,
      user_id: userId,
      action: 'updated',
      details: updates,
    })
    return { data, error: null }
  }

  const deleteProperty = async (id: string) => {
    const { error } = await supabase.from('properties').delete().eq('id', id)
    return { error: error?.message ?? null }
  }

  return { properties, loading, error, fetchProperties, createProperty, updateProperty, deleteProperty }
}
