import React, { useState, useEffect } from 'react'
import { Bell, Calendar, AlertTriangle, CheckCircle2, Info, CheckCheck, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface NotificationItem {
  id: string
  title: string
  message: string
  type: 'reminder' | 'overdue' | 'new_training_assigned' | 'system'
  time: string
  link?: string
  read: boolean
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchNotifications()
    // Poll every 60s for new alerts
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const items: NotificationItem[] = []

      // 1. Fetch from notifications table
      const { data: dbNotifs } = await supabase
        .from('notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(10)

      if (dbNotifs && dbNotifs.length > 0) {
        dbNotifs.forEach(n => {
          items.push({
            id: n.id,
            title: n.type === 'overdue' ? 'Overdue Training Alert' : n.type === 'reminder' ? 'Training Reminder' : 'Training Assigned',
            message: n.message,
            type: n.type,
            time: n.sent_at ? new Date(n.sent_at).toLocaleDateString() : 'Recent',
            link: '/schedules',
            read: n.status === 'sent',
          })
        })
      }

      // 2. Derive dynamic alerts: Upcoming schedules
      const { data: upcomingSchedules } = await supabase
        .from('training_schedules')
        .select('*, trainings(name)')
        .in('status', ['planned', 'ongoing'])
        .order('scheduled_date', { ascending: true })
        .limit(5)

      if (upcomingSchedules && upcomingSchedules.length > 0) {
        upcomingSchedules.forEach(s => {
          const trainingName = (s as unknown as { trainings: { name: string } })?.trainings?.name || 'Training'
          const date = new Date(s.scheduled_date).toLocaleDateString()
          items.push({
            id: `sched-${s.id}`,
            title: `Upcoming: ${trainingName}`,
            message: `Scheduled for ${date} with trainer ${s.trainer_name}`,
            type: 'reminder',
            time: date,
            link: '/schedules',
            read: false,
          })
        })
      }

      // 3. Derive dynamic alerts: Pending or Overdue training history
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: overdueHistory } = await supabase
        .from('employee_training_history')
        .select('id, due_date, employees(name), trainings(name)')
        .eq('status', 'pending')
        .lt('due_date', todayStr)
        .limit(3)

      if (overdueHistory && overdueHistory.length > 0) {
        overdueHistory.forEach(h => {
          const empName = (h as unknown as { employees: { name: string } })?.employees?.name || 'Employee'
          const trName = (h as unknown as { trainings: { name: string } })?.trainings?.name || 'Training'
          items.push({
            id: `overdue-${h.id}`,
            title: 'Training Overdue',
            message: `${empName} is overdue for "${trName}"`,
            type: 'overdue',
            time: h.due_date ? new Date(h.due_date).toLocaleDateString() : 'Overdue',
            link: '/employees',
            read: false,
          })
        })
      }

      // Remove duplicate IDs
      const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values())
      setNotifications(uniqueItems)
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleItemClick = (item: NotificationItem) => {
    setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)))
    setOpen(false)
    if (item.link) {
      navigate(item.link)
    }
  }

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'reminder':
        return <Calendar className="h-4 w-4 text-blue-500" />
      case 'new_training_assigned':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      default:
        return <Info className="h-4 w-4 text-amber-500" />
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground focus:outline-none"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-88 sm:w-96 p-0 shadow-xl border rounded-2xl bg-white overflow-hidden" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary hover:bg-primary/20">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={fetchNotifications}
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-primary hover:text-primary/80"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark read
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium">No new notifications</p>
              <p className="text-[11px] text-muted-foreground/70">You're all caught up!</p>
            </div>
          ) : (
            notifications.map(item => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`flex items-start gap-3 p-3.5 hover:bg-muted/50 cursor-pointer transition-colors ${
                  !item.read ? 'bg-primary/[0.03]' : ''
                }`}
              >
                <div className="mt-0.5 p-1.5 rounded-lg bg-muted/60 flex-shrink-0">
                  {getIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-semibold truncate ${!item.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {item.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{item.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.message}</p>
                </div>
                {!item.read && (
                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t bg-muted/10 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-7"
            onClick={() => {
              setOpen(false)
              navigate('/schedules')
            }}
          >
            View all schedules & alerts →
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
