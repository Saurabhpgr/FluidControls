import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  User, Shield, Mail, Building2, KeyRound, LogOut, CheckCircle, 
  Clock, Camera, Phone, Pencil, Trash2, Image, Video, RefreshCw, X 
} from 'lucide-react'
import { useAuth, UserProfile } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

export function UserProfileMenu() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const navigate = useNavigate()
  
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  
  // Profile Form State
  const [editForm, setEditForm] = useState<UserProfile>(profile)
  const [savingProfile, setSavingProfile] = useState(false)
  
  // File inputs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mobileCameraInputRef = useRef<HTMLInputElement>(null)
  
  // Webcam capture state
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Password Form State
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const handleOpenProfileDialog = () => {
    setEditForm(profile)
    setPopoverOpen(false)
    setProfileDialogOpen(true)
  }

  const handleSignOut = async () => {
    setPopoverOpen(false)
    await signOut()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  // Handle image upload from library / file picker
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, WEBP)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setEditForm(prev => ({ ...prev, avatar_url: base64 }))
      toast.success('Photo selected! Click "Save Changes" to apply.')
    }
    reader.readAsDataURL(file)
    // Reset file input value so user can pick same file again if needed
    e.target.value = ''
  }

  // Handle delete / remove photo
  const handleDeletePhoto = () => {
    setEditForm(prev => ({ ...prev, avatar_url: '' }))
    toast.info('Photo removed. Click "Save Changes" to apply.')
  }

  // Start live webcam camera
  const handleStartCamera = async () => {
    setCameraError(null)
    setCameraModalOpen(true)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallback for browsers without WebRTC getUserMedia support
        mobileCameraInputRef.current?.click()
        setCameraModalOpen(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      })

      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err: unknown) {
      console.warn('Webcam access error:', err)
      setCameraError('Camera access unavailable. Falling back to native device camera.')
      // Fallback to native camera input
      setTimeout(() => {
        mobileCameraInputRef.current?.click()
        handleCloseCamera()
      }, 800)
    }
  }

  const handleCloseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setCameraModalOpen(false)
  }

  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 640
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Mirror image for natural selfie appearance
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      setEditForm(prev => ({ ...prev, avatar_url: dataUrl }))
      toast.success('Photo captured! Click "Save Changes" to apply.')
    }
    handleCloseCamera()
  }

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraStream])

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!editForm.full_name.trim()) {
      toast.error('Full name is required')
      return
    }

    setSavingProfile(true)
    try {
      const { error } = await updateProfile(editForm)
      if (error) throw error
      toast.success('Profile and photo updated successfully!')
      setProfileDialogOpen(false)
    } catch (err: unknown) {
      console.error(err)
      const error = err as { message?: string }
      toast.error(error?.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  // Change password
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

  const userInitial = profile.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'H'
  const email = user?.email || 'hr@fluidcontrol.com'
  const lastSignIn = user?.last_sign_in_at 
    ? new Date(user.last_sign_in_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Active now'

  return (
    <>
      {/* Hidden inputs for File and Camera fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleImageUpload}
      />

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className="group relative flex items-center justify-center h-9 w-9 rounded-full overflow-hidden shadow-sm hover:ring-2 hover:ring-primary/50 transition-all focus:outline-none cursor-pointer bg-slate-100"
            title={`${profile.full_name} — View Profile`}
            aria-label="User Profile"
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full gradient-primary flex items-center justify-center">
                <span className="text-white text-sm font-bold tracking-tight">
                  {userInitial}
                </span>
              </div>
            )}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-80 sm:w-88 p-0 shadow-2xl border rounded-2xl bg-white overflow-hidden z-50 animate-in fade-in-50 zoom-in-95"
          align="end"
          sideOffset={8}
        >
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-5 text-white relative">
            <button
              onClick={handleOpenProfileDialog}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Edit Profile & Picture"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-3.5">
              <div className="relative group cursor-pointer" onClick={handleOpenProfileDialog} title="Click to change photo">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30 shadow-lg"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center text-white text-lg font-bold shadow-lg ring-2 ring-white/20">
                    {userInitial}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm truncate text-white">{profile.full_name}</h3>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] py-0 px-1.5 font-normal">
                    Online
                  </Badge>
                </div>
                <p className="text-xs text-slate-300 truncate mt-0.5">{email}</p>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-indigo-200">
                  <Shield className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                  <span className="truncate">{profile.title}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Metadata */}
          <div className="p-3.5 sm:p-4 space-y-2.5 text-xs bg-slate-50/50">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Department
              </span>
              <span className="font-semibold text-slate-800">{profile.department}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> Phone / Contact
              </span>
              <span className="font-medium text-slate-700">{profile.phone}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> Account Status
              </span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Active HR Admin
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Last Active
              </span>
              <span className="font-medium text-slate-700">{lastSignIn}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-2.5 sm:p-3 border-t bg-white space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-medium h-8.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
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
              className="w-full justify-start text-xs font-medium h-8.5 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut className="h-3.5 w-3.5 mr-2 text-red-500" />
              Sign Out
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Edit Profile & Photo Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="h-5 w-5 text-primary" /> Edit HR Admin Profile
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Avatar Section with Take Photo, Choose Library & Delete Photo */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="relative group flex-shrink-0">
                {editForm.avatar_url ? (
                  <img
                    src={editForm.avatar_url}
                    alt="Profile preview"
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-primary/20 shadow-md"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center text-white text-2xl font-bold shadow-md ring-4 ring-primary/20">
                    {editForm.full_name?.[0]?.toUpperCase() || 'H'}
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Profile Photo</h4>
                  <p className="text-xs text-muted-foreground">
                    Take a live photo or choose from library. Max 5MB.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  {/* Take Photo Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-white hover:bg-slate-50 border-slate-300"
                    onClick={handleStartCamera}
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5 text-blue-600" /> Take Photo
                  </Button>

                  {/* Choose from Library Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-white hover:bg-slate-50 border-slate-300"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Image className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Choose from Library
                  </Button>

                  {/* Delete Photo Button */}
                  {editForm.avatar_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 bg-white"
                      onClick={handleDeletePhoto}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5 text-red-500" /> Delete Photo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prof-name">Full Name *</Label>
                <Input
                  id="prof-name"
                  value={editForm.full_name}
                  onChange={e => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="e.g. Saurabh Pagar"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-title">Job Title / Designation</Label>
                <Input
                  id="prof-title"
                  value={editForm.title}
                  onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Head of HR & Training"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-dept">Department</Label>
                <Input
                  id="prof-dept"
                  value={editForm.department}
                  onChange={e => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="e.g. Human Resources"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-phone">Phone / Contact</Label>
                <Input
                  id="prof-phone"
                  value={editForm.phone}
                  onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. +91 98765 43210"
                  className="h-9"
                />
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary flex-shrink-0" />
              <span>Email: <strong>{email}</strong> (Managed through Supabase Auth)</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProfileDialogOpen(false)}
              disabled={savingProfile}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving Changes…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live Camera Viewfinder Modal */}
      <Dialog open={cameraModalOpen} onOpenChange={(open) => !open && handleCloseCamera()}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="h-5 w-5 text-blue-600" /> Take Profile Photo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {cameraError ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs text-center">
                <p className="font-semibold mb-1">Camera Notice</p>
                <p>{cameraError}</p>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center border-2 border-slate-700 shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                {/* Circular face guide overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-52 h-52 rounded-full border-2 border-white/60 border-dashed shadow-2xl" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseCamera}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCaptureSnapshot}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Camera className="h-4 w-4 mr-1.5" /> Capture Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
