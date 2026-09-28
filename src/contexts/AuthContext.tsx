import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface UserProfile {
  full_name: string
  avatar_url: string
  title: string
  department: string
  phone: string
}

const DEFAULT_PROFILE: UserProfile = {
  full_name: 'HR Administrator',
  avatar_url: '',
  title: 'Super Admin & HR Lead',
  department: 'Human Resources & Training',
  phone: '+91 98765 43210',
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: DEFAULT_PROFILE,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  updateProfile: async () => ({ error: null }),
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('fluidcontrol_hr_profile')
      if (saved) return { ...DEFAULT_PROFILE, ...JSON.parse(saved) }
    } catch (e) {
      console.error(e)
    }
    return DEFAULT_PROFILE
  })
  const [loading, setLoading] = useState(true)

  const syncProfileFromUser = (u: User | null) => {
    if (u?.user_metadata) {
      const meta = u.user_metadata
      const merged: UserProfile = {
        full_name: meta.full_name || profile.full_name || DEFAULT_PROFILE.full_name,
        avatar_url: meta.avatar_url || profile.avatar_url || '',
        title: meta.title || profile.title || DEFAULT_PROFILE.title,
        department: meta.department || profile.department || DEFAULT_PROFILE.department,
        phone: meta.phone || profile.phone || DEFAULT_PROFILE.phone,
      }
      setProfile(merged)
      try {
        localStorage.setItem('fluidcontrol_hr_profile', JSON.stringify(merged))
      } catch (e) {
        console.error(e)
      }
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      syncProfileFromUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      syncProfileFromUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (data?.user) {
      syncProfileFromUser(data.user)
    }
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const updated = { ...profile, ...updates }
      setProfile(updated)
      try {
        localStorage.setItem('fluidcontrol_hr_profile', JSON.stringify(updated))
      } catch (e) {
        console.error(e)
      }

      // Sync with Supabase Auth metadata if user is logged in
      if (user) {
        const { error } = await supabase.auth.updateUser({
          data: updated,
        })
        if (error) {
          console.warn('Supabase auth metadata update notice:', error.message)
        }
      }
      return { error: null }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to update profile')
      return { error }
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
