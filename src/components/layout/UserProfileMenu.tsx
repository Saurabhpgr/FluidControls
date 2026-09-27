import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Shield, Mail, Building2, KeyRound, LogOut, CheckCircle, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

export function UserProfileMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const handleSignOut = async () => {
    setPopoverOpen(false)
    await signOut()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Password updated successfully!')
      setPasswordDialogOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      console.error(err)
      const error = err as { message?: string }
      toast.error(error?.message || 'Failed to update password')
    } finally {
      setChangingPassword(false)
    }
  }

  const userInitial = user?.email?.[0]?.toUpperCase() || 'H'
  const email = user?.email || 'hr@fluidcontrol.com'
  const lastSignIn = user?.last_sign_in_at 
    ? new Date(user.last_sign_in_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Active now'

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className="group relative flex items-center justify-center h-9 w-9 rounded-full gradient-primary shadow-sm hover:ring-2 hover:ring-primary/40 transition-all focus:outline-none cursor-pointer"
            title="View User Profile"
            aria-label="User Profile"
          >
            <span className="text-white text-sm font-bold tracking-tight">
              {userInitial}
            </span>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-80 sm:w-88 p-0 shadow-2xl border rounded-2xl bg-white overflow-hidden z-50 animate-in fade-in-50 zoom-in-95"
          align="end"
          sideOffset={8}
        >
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center text-white text-lg font-bold shadow-lg ring-2 ring-white/20">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm truncate text-white">HR Administrator</h3>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] py-0 px-1.5 font-normal">
                    Online
                  </Badge>
                </div>
                <p className="text-xs text-slate-300 truncate mt-0.5">{email}</p>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-indigo-200">
                  <Shield className="h-3 w-3 text-indigo-400" />
                  <span>Super Admin & HR Lead</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Metadata */}
          <div className="p-4 space-y-3 text-xs bg-slate-50/50">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Organization
              </span>
              <span className="font-semibold text-slate-800">FluidControl Pvt Ltd</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Role
              </span>
              <span className="font-semibold text-slate-800">HR & Training Admin</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Account Status
              </span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Verified
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Last Login
              </span>
              <span className="font-medium text-slate-700">{lastSignIn}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-3 border-t bg-white space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-medium h-9 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              onClick={() => {
                setPopoverOpen(false)
                setPasswordDialogOpen(true)
              }}
            >
              <KeyRound className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              Change Password
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs font-medium h-9 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut className="h-3.5 w-3.5 mr-2 text-red-500" />
              Sign Out
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Change Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pass">New Password</Label>
              <Input
                id="new-pass"
                type="password"
                placeholder="Enter new password (min. 6 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pass">Confirm New Password</Label>
              <Input
                id="confirm-pass"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
              disabled={changingPassword}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? 'Updating…' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
