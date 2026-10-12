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

/**
 * Production Security Gatekeeper:
 * Fluid Control ETMS has a single HR/Admin role.
 * Social login and password accounts are strictly restricted to the HR allow-list.
 * Arbitrary Google accounts or unauthorized email domains are rejected and auto-logged out.
 */
const HR_ALLOWED_EMAILS = [
  'hr@fluidcontrol.com',
  'admin@fluidcontrol.com',
  'hr@fluidcontrols.com',
  'admin@fluidcontrols.com',
  'saurabh@fluidcontrols.com',
  'saurabh.pagar@fluidcontrols.com',
]

const HR_ALLOWED_DOMAINS = ['fluidcontrols.com', 'fluidcontrol.com']

export function isAuthorizedHREmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.toLowerCase().trim()
  if (HR_ALLOWED_EMAILS.includes(normalized)) return true
  const domain = normalized.split('@')[1]
  if (domain && HR_ALLOWED_DOMAINS.includes(domain)) return true
  return false
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile
  loading: boolean
  authError: string | null
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: DEFAULT_PROFILE,
  loading: true,
  authError: null,
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
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
  const [authError, setAuthError] = useState<string | null>(null)
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
        full_name: meta.full_name || meta.name || profile.full_name || DEFAULT_PROFILE.full_name,
        avatar_url: meta.avatar_url || meta.picture || profile.avatar_url || '',
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

  // Security Verification: validate that session user email is on the HR allow-list
  const validateSessionUser = async (currentSession: Session | null): Promise<boolean> => {
    if (!currentSession?.user) return false
    const email = currentSession.user.email
    if (!isAuthorizedHREmail(email)) {
      console.warn(`[Security Alert] Rejected unauthorized login attempt from: ${email}`)
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setAuthError(`Access Denied: The account "${email}" is not on the authorized Fluid Controls HR allow-list. Only authorized HR personnel may access this system.`)
      return false
    }
    setAuthError(null)
    return true
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const authorized = await validateSessionUser(session)
        if (authorized) {
          setSession(session)
          setUser(session.user)
          syncProfileFromUser(session.user)
        }
      } else {
        setSession(null)
        setUser(null)
      }
      setLoading(false)
    })

    // Listen for auth changes (including OAuth redirects)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) {
        const authorized = await validateSessionUser(newSession)
        if (authorized) {
          setSession(newSession)
          setUser(newSession.user)
          syncProfileFromUser(newSession.user)
        }
      } else {
        setSession(null)
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    setAuthError(null)
    if (!isAuthorizedHREmail(email)) {
      const err = new Error(`Access Denied: "${email}" is not authorized for Fluid Controls HR Admin access.`)
      setAuthError(err.message)
      return { error: err }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error }
    }
    if (data?.user) {
      syncProfileFromUser(data.user)
    }
    return { error: null }
  }

  const signInWithGoogle = async () => {
    setAuthError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })
      return { error: error ? new Error(error.message) : null }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Google Sign-In failed')
      return { error }
    }
  }

  const signOut = async () => {
    setAuthError(null)
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
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
    <AuthContext.Provider value={{ user, session, profile, loading, authError, signIn, signInWithGoogle, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
