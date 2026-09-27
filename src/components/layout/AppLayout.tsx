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
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col transition-all duration-300 ease-in-out z-30',
          'bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]',
          'fixed md:static inset-y-0 left-0',
          sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-16'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[hsl(var(--sidebar-border)/0.5)]">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-lg">
              <Droplets className="h-4 w-4 text-white" />
            </div>
            {(sidebarOpen || window.innerWidth < 768) && (
              <div className="overflow-hidden">
                <p className="text-white font-bold text-sm leading-tight">FluidControl</p>
                <p className="text-[hsl(var(--sidebar-foreground)/0.5)] text-xs">Training System</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
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
                if (window.innerWidth < 768) setSidebarOpen(false)
              }}
              className={({ isActive }) =>
                cn(
                  'sidebar-item',
                  isActive && 'active',
                  !sidebarOpen && 'md:justify-center md:px-2'
                )
              }
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {(sidebarOpen || window.innerWidth < 768) && <span className="truncate">{label}</span>}
              {(sidebarOpen || window.innerWidth < 768) && (
                <ChevronRight className="h-3 w-3 ml-auto opacity-30" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* User & Sign Out */}
        <div className="p-3 border-t border-[hsl(var(--sidebar-border)/0.5)]">
          {sidebarOpen || window.innerWidth < 768 ? (
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
              <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {user?.email?.[0]?.toUpperCase() || 'H'}
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-white text-xs font-medium truncate">HR Admin</p>
                <p className="text-[hsl(var(--sidebar-foreground)/0.5)] text-xs truncate">{user?.email}</p>
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-border shadow-xs">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-slate-700"
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
        <main className="flex-1 overflow-auto bg-background p-4 sm:p-6" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
