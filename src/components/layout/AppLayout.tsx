import React, { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { 
  LayoutDashboard, BookOpen, CalendarDays, Users, ClipboardCheck,
  FileQuestion, FolderOpen, BarChart3, Mail, LogOut, Menu, X,
  Droplets, Bell, ChevronRight
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { UserProfileMenu } from '@/components/layout/UserProfileMenu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/trainings', label: 'Trainings', icon: BookOpen },
  { path: '/schedules', label: 'Schedule / Calendar', icon: CalendarDays },
  { path: '/employees', label: 'Employees & Groups', icon: Users },
  { path: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { path: '/quizzes', label: 'Quizzes', icon: FileQuestion },
  { path: '/materials', label: 'Materials', icon: FolderOpen },
  { path: '/emails', label: 'Emails & Alerts', icon: Mail },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
]

export function AppLayout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024
    }
    return true
  })

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col transition-all duration-300 ease-in-out z-50',
          'bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]',
          'fixed lg:static inset-y-0 left-0 shadow-xl lg:shadow-none',
          sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[hsl(var(--sidebar-border)/0.5)]">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-lg">
              <Droplets className="h-4 w-4 text-white" />
            </div>
            <div className={cn('overflow-hidden', !sidebarOpen && 'lg:hidden')}>
              <p className="text-white font-bold text-sm leading-tight">FluidControl</p>
              <p className="text-[hsl(var(--sidebar-foreground)/0.5)] text-xs">Training System</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto" role="navigation">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => {
                if (window.innerWidth < 1024) setSidebarOpen(false)
              }}
              className={({ isActive }) =>
                cn(
                  'sidebar-item',
                  isActive && 'active',
                  !sidebarOpen && 'lg:justify-center lg:px-2'
                )
              }
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className={cn('truncate', !sidebarOpen && 'lg:hidden')}>{label}</span>
              <ChevronRight className={cn('h-3 w-3 ml-auto opacity-30', !sidebarOpen && 'lg:hidden')} />
            </NavLink>
          ))}
        </nav>

        {/* User & Sign Out */}
        <div className="p-3 border-t border-[hsl(var(--sidebar-border)/0.5)]">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
              <div className="h-7 w-7 rounded-full overflow-hidden gradient-primary flex items-center justify-center flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-white text-xs font-bold">
                    {profile.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'H'}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-white text-xs font-medium truncate">{profile.full_name || 'HR Admin'}</p>
                <p className="text-[hsl(var(--sidebar-foreground)/0.5)] text-[11px] truncate">{user?.email || 'hr@fluidcontrol.com'}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="text-[hsl(var(--sidebar-foreground)/0.5)] hover:text-white transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center w-full py-2 text-[hsl(var(--sidebar-foreground)/0.5)] hover:text-white transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 w-full max-w-full">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-3 sm:px-6 bg-white border-b border-border shadow-2xs z-10 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-slate-700"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationCenter />
            <UserProfileMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-3 sm:p-6 w-full max-w-full" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
