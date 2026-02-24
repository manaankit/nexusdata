'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/libs/supabase/client'

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const response = await fetch('/api/auth')
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    // Set up real-time auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkUser()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
