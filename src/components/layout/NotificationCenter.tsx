import React, { useState, useEffect, useMemo } from 'react'
import { 
  Bell, Calendar, AlertTriangle, CheckCircle2, Info, CheckCheck, 
  RefreshCw, ClipboardCheck, FileQuestion, Mail, ChevronRight,
  Filter, Sparkles, Trash2, ExternalLink, X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export interface NotificationItem {
  id: string
  title: string
  message: string
  type: 'overdue' | 'reminder' | 'attendance' | 'quiz' | 'system'
  timestamp: string
  link?: string
  priority: 'high' | 'medium' | 'low'
  read: boolean
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'upcoming' | 'attendance'>('all')
  const navigate = useNavigate()

  // Load persistent read IDs from localStorage
  const getReadIds = (): Set<string> => {
    try {
      const saved = localStorage.getItem('fluidcontrol_read_notif_ids')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  }

  const saveReadIds = (ids: Set<string>) => {
    try {
      localStorage.setItem('fluidcontrol_read_notif_ids', JSON.stringify(Array.from(ids)))
    } catch (e) {
      console.error(e)
    }
  }

  // Load persistent dismissed/cleared IDs from localStorage
  const getClearedIds = (): Set<string> => {
    try {
      const saved = localStorage.getItem('fluidcontrol_cleared_notif_ids')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  }

  const saveClearedIds = (ids: Set<string>) => {
    try {
      localStorage.setItem('fluidcontrol_cleared_notif_ids', JSON.stringify(Array.from(ids)))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchNotifications()
    // Periodic background sync every 60s
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const rawItems: NotificationItem[] = []
      const readSet = getReadIds()
      const clearedSet = getClearedIds()
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      const next14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // 1. Fetch Overdue Training History
      const { data: overdueRecords } = await supabase
        .from('employee_training_history')
        .select('id, due_date, status, employees(id, name, employee_code, departments(name)), trainings(id, name)')
        .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${todayStr})`)
        .order('due_date', { ascending: false })
        .limit(15)

      if (overdueRecords && overdueRecords.length > 0) {
        overdueRecords.forEach(h => {
          const emp = (h as unknown as { employees: { name: string; employee_code: string; departments?: { name: string } } })?.employees
          const tr = (h as unknown as { trainings: { name: string } })?.trainings
          const empName = emp?.name || 'Employee'
          const trName = tr?.name || 'Training'
          const dept = emp?.departments?.name ? ` (${emp.departments.name})` : ''
          const notifId = `overdue-${h.id}`

          if (!clearedSet.has(notifId)) {
            rawItems.push({
              id: notifId,
              title: `Overdue Training: ${trName}`,
              message: `${empName}${dept} missed the deadline on ${formatDate(h.due_date)}. Action required.`,
              type: 'overdue',
              timestamp: h.due_date || todayStr,
              link: '/reports',
              priority: 'high',
              read: readSet.has(notifId),
            })
          }
        })
      }

      // 2. Fetch Upcoming Schedules (Planned / Ongoing in next 14 days)
      const { data: upcomingSchedules } = await supabase
        .from('training_schedules')
        .select('id, scheduled_date, trainer_name, group_type, status, trainings(name)')
        .in('status', ['planned', 'ongoing'])
        .gte('scheduled_date', todayStr)
        .lte('scheduled_date', next14Days)
        .order('scheduled_date', { ascending: true })
        .limit(10)

      if (upcomingSchedules && upcomingSchedules.length > 0) {
        upcomingSchedules.forEach(s => {
          const trName = (s as unknown as { trainings: { name: string } })?.trainings?.name || 'Session'
          const formattedDate = formatDate(s.scheduled_date)
          const notifId = `sched-${s.id}`

          if (!clearedSet.has(notifId)) {
            rawItems.push({
              id: notifId,
              title: `Upcoming: ${trName}`,
              message: `Scheduled on ${formattedDate} by ${s.trainer_name} (${s.group_type} group).`,
              type: 'reminder',
              timestamp: s.scheduled_date,
              link: '/schedules',
              priority: 'medium',
              read: readSet.has(notifId),
            })
          }
        })
      }

      // 3. Check for Attendance Pending (Schedules held in past or today that have un-marked attendance)
      const { data: pendingAttendanceSchedules } = await supabase
        .from('training_schedules')
        .select('id, scheduled_date, status, trainings(name), attendance(attendance_status)')
        .lte('scheduled_date', todayStr)
        .in('status', ['planned', 'ongoing', 'completed'])
        .order('scheduled_date', { ascending: false })
        .limit(5)

      if (pendingAttendanceSchedules && pendingAttendanceSchedules.length > 0) {
        pendingAttendanceSchedules.forEach(s => {
          const attendanceList = (s as unknown as { attendance: { attendance_status: string }[] })?.attendance || []
          const unmarkedCount = attendanceList.filter(a => a.attendance_status === 'not_marked').length
          if (unmarkedCount > 0) {
            const trName = (s as unknown as { trainings: { name: string } })?.trainings?.name || 'Training'
            const notifId = `att-pending-${s.id}`
            if (!clearedSet.has(notifId)) {
              rawItems.push({
                id: notifId,
                title: `Attendance Pending (${unmarkedCount} unverified)`,
                message: `${trName} session on ${formatDate(s.scheduled_date)} requires attendance confirmation.`,
                type: 'attendance',
                timestamp: s.scheduled_date,
                link: '/attendance',
                priority: 'high',
                read: readSet.has(notifId),
              })
            }
          }
        })
      }

      // 4. Fetch Quizzes / Assessment records
      const { data: recentQuizzes } = await supabase
        .from('quizzes')
        .select('id, title, form_link, schedule_id, training_schedules(scheduled_date, trainings(name))')
        .order('id', { ascending: false })
        .limit(5)

      if (recentQuizzes && recentQuizzes.length > 0) {
        recentQuizzes.forEach(q => {
          const trInfo = (q as unknown as { training_schedules: { trainings: { name: string }; scheduled_date: string } })?.training_schedules
          const trName = trInfo?.trainings?.name || 'Training'
          const notifId = `quiz-${q.id}`
          if (!clearedSet.has(notifId)) {
            rawItems.push({
              id: notifId,
              title: `Quiz Available: ${q.title}`,
              message: `Assessment attached for ${trName}. Ensure enrolled participants complete it.`,
              type: 'quiz',
              timestamp: trInfo?.scheduled_date || todayStr,
              link: '/quizzes',
              priority: 'low',
              read: readSet.has(notifId),
            })
          }
        })
      }

      // Sort by priority and timestamp
      rawItems.sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1
        if (a.priority === 'high' && b.priority !== 'high') return -1
        if (b.priority === 'high' && a.priority !== 'high') return 1
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })

      setNotifications(rawItems)
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])
  const overdueCount = useMemo(() => notifications.filter(n => n.type === 'overdue' && !n.read).length, [notifications])
  const upcomingCount = useMemo(() => notifications.filter(n => n.type === 'reminder' && !n.read).length, [notifications])
  const attendanceCount = useMemo(() => notifications.filter(n => n.type === 'attendance' && !n.read).length, [notifications])

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'overdue') return notifications.filter(n => n.type === 'overdue')
    if (activeTab === 'upcoming') return notifications.filter(n => n.type === 'reminder')
    if (activeTab === 'attendance') return notifications.filter(n => n.type === 'attendance')
    return notifications
  }, [notifications, activeTab])

  // Mark all as read
  const markAllRead = () => {
    const allIds = new Set(notifications.map(n => n.id))
    saveReadIds(allIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    toast.success('All notifications marked as read')
  }

  // Handle clicking a single notification
  const handleItemClick = (item: NotificationItem) => {
    const readSet = getReadIds()
    readSet.add(item.id)
    saveReadIds(readSet)

    setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)))
    setOpen(false)
    if (item.link) {
      navigate(item.link)
    }
  }

  // Permanently dismiss a single notification
  const handleDismissSingle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const clearedSet = getClearedIds()
    clearedSet.add(id)
    saveClearedIds(clearedSet)

    setNotifications(prev => prev.filter(n => n.id !== id))
    toast.success('Notification permanently dismissed')
  }

  // Permanently clear all read notifications
  const handleClearRead = () => {
    const readNotifications = notifications.filter(n => n.read)
    if (readNotifications.length === 0) {
      toast.info('No read notifications to clear')
      return
    }

    const clearedSet = getClearedIds()
    readNotifications.forEach(n => clearedSet.add(n.id))
    saveClearedIds(clearedSet)

    const unreadOnly = notifications.filter(n => !n.read)
    setNotifications(unreadOnly)
    toast.success(`Permanently cleared ${readNotifications.length} read notification(s)`)
  }

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'reminder':
        return <Calendar className="h-4 w-4 text-blue-600" />
      case 'attendance':
        return <ClipboardCheck className="h-4 w-4 text-amber-600" />
      case 'quiz':
        return <FileQuestion className="h-4 w-4 text-purple-600" />
      default:
        return <Info className="h-4 w-4 text-sky-600" />
    }
  }

  const getTypeBadge = (type: NotificationItem['type']) => {
    switch (type) {
      case 'overdue':
        return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-300 text-[10px] py-0 px-1.5 font-semibold">Overdue</Badge>
      case 'reminder':
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300 text-[10px] py-0 px-1.5 font-semibold">Upcoming</Badge>
      case 'attendance':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 text-[10px] py-0 px-1.5 font-semibold">Attendance</Badge>
      case 'quiz':
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-300 text-[10px] py-0 px-1.5 font-semibold">Quiz</Badge>
      default:
        return null
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 hover:text-slate-900 focus:outline-none cursor-pointer"
          title="Notification Center"
          aria-label="Notification Center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent 
        className="w-[92vw] sm:w-[420px] p-0 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden z-50 animate-in fade-in-50 zoom-in-95" 
        align="end" 
        sideOffset={8}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Bell className="h-4 w-4 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">Notifications</span>
                {unreadCount > 0 && (
                  <Badge className="bg-red-500 text-white border-0 text-[10px] py-0 px-1.5 font-bold">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-300">Live alerts & compliance updates</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
              onClick={fetchNotifications}
              title="Refresh alerts"
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-indigo-200 hover:text-white hover:bg-white/10"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-800 text-primary shadow-xs border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
              activeTab === 'overdue'
                ? 'bg-red-50 text-red-700 shadow-xs border border-red-200 font-semibold'
                : 'text-muted-foreground hover:text-red-600'
            }`}
          >
            Overdue {overdueCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-600" />}
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-blue-50 text-blue-700 shadow-xs border border-blue-200 font-semibold'
                : 'text-muted-foreground hover:text-blue-600'
            }`}
          >
            Upcoming {upcomingCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-amber-50 text-amber-700 shadow-xs border border-amber-200 font-semibold'
                : 'text-muted-foreground hover:text-amber-600'
            }`}
          >
            Attendance {attendanceCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />}
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[340px] sm:max-h-[380px] overflow-y-auto divide-y divide-border/40">
          {loading && notifications.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Checking live alerts...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground px-4">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-80" />
              <p className="text-xs font-semibold text-foreground">No alerts in this category</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Everything is up to date and in compliance!</p>
            </div>
          ) : (
            filteredNotifications.map(item => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`group flex items-start gap-3 p-3 sm:p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-all ${
                  !item.read 
                    ? item.type === 'overdue' 
                      ? 'bg-red-50/40 border-l-3 border-l-red-500' 
                      : 'bg-primary/[0.04] border-l-3 border-l-primary'
                    : 'opacity-85'
                }`}
              >
                <div className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${
                  item.type === 'overdue' 
                    ? 'bg-red-100 dark:bg-red-950/60' 
                    : item.type === 'reminder' 
                    ? 'bg-blue-100 dark:bg-blue-950/60' 
                    : item.type === 'attendance'
                    ? 'bg-amber-100 dark:bg-amber-950/60'
                    : 'bg-purple-100 dark:bg-purple-950/60'
                }`}>
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${!item.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                        {item.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getTypeBadge(item.type)}
                      {/* Individual dismiss button */}
                      <button
                        type="button"
                        onClick={(e) => handleDismissSingle(e, item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-opacity"
                        title="Dismiss notification"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{item.message}</p>
                  
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                    <span className="font-medium text-slate-500">{formatDate(item.timestamp)}</span>
                    <span className="flex items-center text-primary font-medium group-hover:underline">
                      View details <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>

                {!item.read && (
                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2 ring-2 ring-primary/20" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer with Clear Read */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-t flex items-center justify-between text-xs">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleClearRead}
            title="Permanently remove all read notifications"
          >
            <Trash2 className="h-3 w-3 mr-1" /> Clear read
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary font-medium hover:text-primary/90"
            onClick={() => {
              setOpen(false)
              navigate('/reports')
            }}
          >
            Full Analytics <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
