'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Property } from '@/types/database'

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProperties = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        creator:created_by(id, full_name, avatar_url),
        assignee:assigned_to(id, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setProperties((data as Property[]) || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProperties()

    // Realtime subscription
    const channel = supabase
      .channel('properties-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'properties',
      }, () => {
        fetchProperties()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
