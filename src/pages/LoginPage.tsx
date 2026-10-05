import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Droplets, Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      toast.error('Invalid credentials. Please try again.')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:flex-1 gradient-primary flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-full" />
        
        <div className="relative z-10 text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="h-24 w-24 bg-white rounded-3xl p-3 flex items-center justify-center shadow-2xl">
              <img src="/Fluid-Controls-Logo.png" alt="Fluid Controls" className="h-full w-full object-contain" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Fluid Controls</h1>
          <h2 className="text-xl font-medium text-white/90 mb-6">Employee Training Management System</h2>
          <p className="text-white/75 leading-relaxed">
            Streamline training programs, track compliance, manage attendance, and generate comprehensive reports — all in one place.
          </p>
          
          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Training Types', value: '∞' },
              { label: 'Compliance Tracking', value: '100%' },
              { label: 'Auto Reports', value: '✓' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/15 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-white/80 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 lg:max-w-md flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-white border p-1 flex items-center justify-center shadow-xs">
              <img src="/Fluid-Controls-Logo.png" alt="Fluid Controls" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Fluid Controls ETMS</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-8">Sign in to your HR Admin account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="hr@fluidcontrol.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            FluidControl ETMS — HR Admin Access Only
          </p>
        </div>
      </div>
    </div>
  )
}
