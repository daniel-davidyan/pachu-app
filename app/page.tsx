'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const COLORS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
]

export default function Home() {
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [currentColorName, setCurrentColorName] = useState('White')
  const [recordId, setRecordId] = useState<string | null>(null)

  useEffect(() => {
    // Fetch initial background color
    const fetchBackgroundColor = async () => {
      const { data, error } = await supabase
        .from('background_state')
        .select('id, color')
        .limit(1)
        .single()

      if (data && !error) {
        setRecordId(data.id)
        setBackgroundColor(data.color)
        updateColorName(data.color)
      }
    }

    fetchBackgroundColor()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('background_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'background_state',
        },
        (payload: any) => {
          if (payload.new && payload.new.color) {
            setBackgroundColor(payload.new.color)
            updateColorName(payload.new.color)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const updateColorName = (hex: string) => {
    const color = COLORS.find((c) => c.hex === hex)
    setCurrentColorName(color?.name || 'Unknown')
  }

  const changeBackground = async () => {
    if (!recordId) return

    // Find current color index
    const currentIndex = COLORS.findIndex((c) => c.hex === backgroundColor)
    // Cycle to next color
    const nextIndex = (currentIndex + 1) % COLORS.length
    const nextColor = COLORS[nextIndex]

    // Update local state immediately for responsiveness
    setBackgroundColor(nextColor.hex)
    setCurrentColorName(nextColor.name)

    // Update in Supabase
    await supabase
      .from('background_state')
      .update({ color: nextColor.hex, updated_at: new Date().toISOString() })
      .eq('id', recordId)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center transition-colors duration-700"
      style={{ backgroundColor }}
    >
      <button
        onClick={changeBackground}
        className="px-8 py-4 bg-white text-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 font-semibold text-lg hover:scale-105"
      >
        Change Background
      </button>
      <p
        className="mt-6 text-xl font-medium transition-colors duration-300"
        style={{
          color: backgroundColor === '#ffffff' ? '#374151' : '#ffffff',
        }}
      >
        Current Color: {currentColorName}
      </p>
    </div>
  )
}