import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Search,
  CalendarDays,
  Download,
  Mail,
  ClipboardCheck,
  FileText,
  User,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar as CalendarIcon,
  Eye,
  CheckCircle,
  XCircle,
  Clock3
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { exportToExcel } from '@/lib/excel'
import { exportAttendanceSheetPdf } from '@/lib/pdf'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDate, getStatusColor, addDaysToFrequency } from '@/lib/utils'
import { toast } from 'sonner'
import type { Training, Department, Employee, TrainingSchedule, GroupType, ScheduleStatus } from '@/types'

interface FormData {
  training_id: string
  scheduled_date: string
  trainer_name: string
  group_type: GroupType
  department_id: string
  status: ScheduleStatus
  notes: string
  selected_employees: string[]
}

const defaultForm: FormData = {
  training_id: '',
  scheduled_date: '',
  trainer_name: '',
  group_type: 'all',
  department_id: '',
  status: 'planned',
  notes: '',
  selected_employees: [],
}

interface EnrolledEmployeeInfo {
  id: string
  name: string
  code: string
  department: string
  designation: string
  status: string
}

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const WEEKDAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function SchedulesPage() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'ongoing' | 'completed' | 'cancelled'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingSchedule | null>(null)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('calendar') // Default to calendar view

  // Interactive Month Calendar State
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDateStr, setSelectedDateStr] = useState(() => new Date().toISOString().split('T')[0])

  // Quick Event Details Dialog
  const [selectedEventSchedule, setSelectedEventSchedule] = useState<TrainingSchedule | null>(null)
  const [eventDetailOpen, setEventDetailOpen] = useState(false)
  const [enrolledList, setEnrolledList] = useState<EnrolledEmployeeInfo[]>([])
  const [loadingEnrolled, setLoadingEnrolled] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: s }, { data: t }, { data: d }, { data: e }] = await Promise.all([
      supabase
        .from('training_schedules')
        .select('*, trainings(name, frequency, description), departments(name)')
        .order('scheduled_date', { ascending: false }),
      supabase.from('trainings').select('*').eq('is_active', true).order('name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('employees').select('*, departments(name)').eq('is_active', true).order('name'),
    ])
    setSchedules((s || []) as unknown as TrainingSchedule[])
    setTrainings(t || [])
    setDepartments(d || [])
    setEmployees((e || []) as unknown as Employee[])
    setLoading(false)
  }

  const openCreate = (prefilledDate?: string) => {
    setEditing(null)
    setForm({
      ...defaultForm,
      scheduled_date: prefilledDate || selectedDateStr || new Date().toISOString().split('T')[0],
    })
    setDialogOpen(true)
  }

  const openEdit = (s: TrainingSchedule) => {
    setEditing(s)
    setForm({
      training_id: s.training_id,
      scheduled_date: s.scheduled_date,
      trainer_name: s.trainer_name,
      group_type: s.group_type,
      department_id: s.department_id || '',
      status: s.status,
      notes: s.notes || '',
      selected_employees: [],
    })
    setEventDetailOpen(false)
    setDialogOpen(true)
  }

  const openEventDetails = async (schedule: TrainingSchedule) => {
    setSelectedEventSchedule(schedule)
    setEventDetailOpen(true)
    setLoadingEnrolled(true)

    try {
      const { data } = await supabase
        .from('attendance')
        .select('attendance_status, employees(id, name, employee_code, designation, departments(name))')
        .eq('schedule_id', schedule.id)

      if (data && data.length > 0) {
        const mapped: EnrolledEmployeeInfo[] = data.map(item => {
          const emp = item.employees as unknown as Employee & { departments: { name: string } }
          return {
            id: emp?.id || '',
            name: emp?.name || 'Unknown',
            code: emp?.employee_code || '—',
            department: emp?.departments?.name || '—',
            designation: emp?.designation || '—',
            status: item.attendance_status || 'not_marked',
          }
        })
        setEnrolledList(mapped)
      } else {
        let resolved: Employee[] = []
        if (schedule.group_type === 'all') {
          resolved = employees
        } else if (schedule.group_type === 'department' && schedule.department_id) {
          resolved = employees.filter(e => e.department_id === schedule.department_id)
        }
        setEnrolledList(
          resolved.map(e => ({
            id: e.id,
            name: e.name,
            code: e.employee_code,
            department: (e as unknown as { departments: { name: string } })?.departments?.name || '—',
            designation: e.designation,
            status: 'not_marked',
          }))
        )
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingEnrolled(false)
    }
  }

  // Resolve employees for form
  const resolveEmployees = (): Employee[] => {
    if (form.group_type === 'all') return employees
    if (form.group_type === 'department' && form.department_id) {
      return employees.filter(e => e.department_id === form.department_id)
    }
    if (form.group_type === 'selected') {
      return employees.filter(e => form.selected_employees.includes(e.id))
    }
    return []
  }

  const handleSave = async () => {
    if (!form.training_id) {
      toast.error('Please select a training course')
      return
    }
    if (!form.scheduled_date) {
      toast.error('Please select a scheduled date')
      return
    }
    if (!form.trainer_name.trim()) {
      toast.error('Trainer name is required')
      return
    }
    if (form.group_type === 'department' && !form.department_id) {
      toast.error('Please select a target department')
      return
    }
    if (form.group_type === 'selected' && form.selected_employees.length === 0) {
      toast.error('Please select at least one employee')
      return
    }

    setSaving(true)
    try {
      const payload = {
        training_id: form.training_id,
        scheduled_date: form.scheduled_date,
        trainer_name: form.trainer_name,
        group_type: form.group_type,
        department_id: form.group_type === 'department' ? form.department_id : null,
        status: form.status,
        notes: form.notes || null,
      }

      let scheduleId: string

      if (editing) {
        const { error } = await supabase.from('training_schedules').update(payload).eq('id', editing.id)
        if (error) throw error
        scheduleId = editing.id
        await logAudit({ action: 'schedule_updated', entity_type: 'training_schedule', entity_id: editing.id, details: payload })
        toast.success('Training schedule updated')
      } else {
        const { data, error } = await supabase.from('training_schedules').insert(payload).select().single()
        if (error) throw error
        scheduleId = data.id

        const resolved = resolveEmployees()
        if (resolved.length > 0) {
          const seRows = resolved.map(e => ({ schedule_id: scheduleId, employee_id: e.id }))
          await supabase.from('schedule_employees').insert(seRows)

          const attRows = resolved.map(e => ({
            schedule_id: scheduleId,
            employee_id: e.id,
            attendance_status: 'not_marked',
          }))
          await supabase.from('attendance').insert(attRows)

          const histRows = resolved.map(e => ({
            employee_id: e.id,
            training_id: form.training_id,
            schedule_id: scheduleId,
            status: 'pending',
            due_date: new Date(new Date(form.scheduled_date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          }))
          await supabase.from('employee_training_history').insert(histRows)
        }

        await logAudit({
          action: 'schedule_created',
          entity_type: 'training_schedule',
          entity_id: scheduleId,
          details: { ...payload, employee_count: resolved.length },
        })
        toast.success(`Training scheduled with ${resolved.length} enrolled employees!`)
      }

      setDialogOpen(false)
      loadAll()
    } catch (e) {
      console.error(e)
      toast.error('Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPdfSheet = () => {
    if (!selectedEventSchedule) return
    const trainingName = (selectedEventSchedule as unknown as { trainings: { name: string } }).trainings?.name || 'Training'

    exportAttendanceSheetPdf({
      trainingName,
      scheduledDate: selectedEventSchedule.scheduled_date,
      trainerName: selectedEventSchedule.trainer_name,
      employees: enrolledList.map(e => ({
        name: e.name,
        code: e.code,
        department: e.department,
        designation: e.designation,
        status: e.status,
      })),
    })
    toast.success('Printable PDF Attendance Sheet downloaded!')
  }

  const handleExport = () => {
    exportToExcel(
      filtered as unknown as Record<string, unknown>[],
      [
        { key: 'trainings', label: 'Training Course', formatter: (v: unknown) => (v as { name: string })?.name || '' },
        { key: 'scheduled_date', label: 'Scheduled Date', formatter: (v: unknown) => formatDate(v as string) },
        { key: 'trainer_name', label: 'Trainer Name' },
        { key: 'group_type', label: 'Target Group', formatter: (v: unknown) => String(v || '').toUpperCase() },
        { key: 'status', label: 'Status', formatter: (v: unknown) => String(v || '').toUpperCase() },
        { key: 'notes', label: 'Notes', formatter: (v: unknown) => (v as string) || '' },
      ],
      'FluidControl_Training_Schedules'
    )
    toast.success('Exported schedules to Excel')
  }

  const filtered = schedules.filter(s => {
    const matchSearch =
      (s as unknown as { trainings: { name: string } }).trainings?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.trainer_name.toLowerCase().includes(search.toLowerCase()) ||
      ((s as unknown as { departments: { name: string } }).departments?.name?.toLowerCase().includes(search.toLowerCase()) || '')
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  // Calendar Month Navigation
  const prevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDateStr(today.toISOString().split('T')[0])
  }

  // Month stats & Days Matrix calculation
  const { daysMatrix, monthYearLabel, currentMonthStats, selectedDateEvents, selectedDateFormatted } = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const label = `${monthNames[month]} ${year}`

    // Start of month day (0 = Sun, 1 = Mon ... 6 = Sat)
    // Convert to Monday = 0, Sunday = 6
    const firstDayIndex = new Date(year, month, 1).getDay()
    const mondayBasedFirstDay = (firstDayIndex + 6) % 7

    const totalDaysInMonth = new Date(year, month + 1, 0).getDate()

    // Build grid cells
    const cells: {
      dayNumber: number | null
      dateStr: string | null
      isCurrentMonth: boolean
      isToday: boolean
      isSelected: boolean
      events: TrainingSchedule[]
    }[] = []

    // Empty offset cells before 1st of month
    for (let i = 0; i < mondayBasedFirstDay; i++) {
      cells.push({
        dayNumber: null,
        dateStr: null,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        events: []
      })
    }

    const todayStr = new Date().toISOString().split('T')[0]

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayEvents = schedules.filter(s => s.scheduled_date === dayStr)

      cells.push({
        dayNumber: day,
        dateStr: dayStr,
        isCurrentMonth: true,
        isToday: dayStr === todayStr,
        isSelected: dayStr === selectedDateStr,
        events: dayEvents,
      })
    }

    // Fill trailing empty cells to complete the 7-column row
    while (cells.length % 7 !== 0) {
      cells.push({
        dayNumber: null,
        dateStr: null,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        events: []
      })
    }

    // Calculate month stats
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
    const monthSchedules = schedules.filter(s => s.scheduled_date.startsWith(monthPrefix))
    const totalCount = monthSchedules.length
    const upcomingCount = monthSchedules.filter(s => s.status === 'planned').length
    const completedCount = monthSchedules.filter(s => s.status === 'completed').length

    // Selected Date details
    const selectedEvents = schedules.filter(s => s.scheduled_date === selectedDateStr)

    // Formatted selected date
    let selFormatted = 'Selected Date'
    if (selectedDateStr) {
      const [sy, sm, sd] = selectedDateStr.split('-').map(Number)
      const dObj = new Date(sy, sm - 1, sd)
      const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long' })
      const monthName = dObj.toLocaleDateString('en-US', { month: 'long' })
      selFormatted = `${dayName}, ${sd} ${monthName} ${sy}`
    }

    return {
      daysMatrix: cells,
      monthYearLabel: label,
      currentMonthStats: { total: totalCount, upcoming: upcomingCount, completed: completedCount },
      selectedDateEvents: selectedEvents,
      selectedDateFormatted: selFormatted
    }
  }, [currentDate, schedules, selectedDateStr])

  // Filter selected day events by active status filter if applicable
  const displayedDayEvents = useMemo(() => {
    if (statusFilter === 'all') return selectedDateEvents
    return selectedDateEvents.filter(s => s.status === statusFilter)
  }, [selectedDateEvents, statusFilter])

  const getStatusDotColor = (status: ScheduleStatus) => {
    switch (status) {
      case 'planned':
        return 'bg-blue-500'
      case 'ongoing':
        return 'bg-amber-500'
      case 'completed':
        return 'bg-emerald-500'
      case 'cancelled':
        return 'bg-slate-700'
      default:
        return 'bg-indigo-500'
    }
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl mx-auto pb-10">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-serif sm:font-sans">
            Training Calendar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Interactive schedule view of all corporate training programs and sessions
          </p>
        </div>

        {/* Top Right Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navigation Pill (Today, <, Month Year, >) */}
          <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="h-7 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Today
            </Button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
            <button
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 min-w-28 sm:min-w-32 text-center select-none">
              {monthYearLabel}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button size="sm" onClick={() => openCreate()} className="h-9 font-medium shadow-xs">
            <Plus className="h-4 w-4 mr-1.5" /> Schedule Training
          </Button>
        </div>
      </div>

      {/* Filter Pills & Month Statistics Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            All Sessions
          </button>

          <button
            onClick={() => setStatusFilter('planned')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'planned'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Upcoming
          </button>

          <button
            onClick={() => setStatusFilter('ongoing')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'ongoing'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            In Progress
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Completed
          </button>

          <button
            onClick={() => setStatusFilter('cancelled')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'cancelled'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-slate-950 dark:bg-slate-400" />
            Cancelled
          </button>
        </div>

        {/* Month Summary Metrics */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-medium text-slate-600 dark:text-slate-400 self-end lg:self-auto flex-shrink-0">
          <span>This Month: <strong className="text-slate-900 dark:text-slate-100">{currentMonthStats.total}</strong> total</span>
          <span className="text-blue-600 dark:text-blue-400 font-bold">{currentMonthStats.upcoming} Upcoming</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{currentMonthStats.completed} Completed</span>
        </div>
      </div>

      {/* Main Grid View & Detail Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: 7-Column Calendar Grid (7 to 8 Columns on lg) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {/* Weekday Header Row */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-center text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-400 py-3">
            {WEEKDAYS.map((day, i) => (
              <div key={day}>
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span>
              </div>
            ))}
          </div>

          {/* 7-Column Month Days Matrix */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/60 bg-slate-100 dark:bg-slate-800/40">
            {daysMatrix.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="bg-white dark:bg-slate-900 min-h-20 sm:min-h-28 p-1.5 sm:p-2.5 opacity-30 select-none"
                  />
                )
              }

              // Filter cell events by status if active
              const visibleEvents = statusFilter === 'all'
                ? cell.events
                : cell.events.filter(e => e.status === statusFilter)

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => cell.dateStr && setSelectedDateStr(cell.dateStr)}
                  onDoubleClick={() => cell.dateStr && openCreate(cell.dateStr)}
                  className={`bg-white dark:bg-slate-900 min-h-20 sm:min-h-28 p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer transition-all duration-150 relative group select-none ${
                    cell.isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30 ring-2 ring-indigo-500 ring-inset z-10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {/* Top Day Number */}
                  <div className="flex items-center justify-between">
                    {cell.isToday ? (
                      <span className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {cell.dayNumber}
                      </span>
                    ) : (
                      <span
                        className={`text-xs sm:text-sm font-semibold ${
                          cell.isSelected
                            ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                    )}

                    {/* Plus icon on hover for quick add */}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (cell.dateStr) openCreate(cell.dateStr)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-opacity"
                      title="Schedule on this date"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Events Container */}
                  <div className="mt-1 space-y-1 overflow-hidden flex-1">
                    {visibleEvents.slice(0, 2).map(ev => {
                      const trName = (ev as unknown as { trainings: { name: string } })?.trainings?.name || 'Training'
                      const dotColor = getStatusDotColor(ev.status)
                      return (
                        <div
                          key={ev.id}
                          onClick={e => {
                            e.stopPropagation()
                            openEventDetails(ev)
                          }}
                          className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-slate-200/60 dark:border-slate-700/50 text-[10px] sm:text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate flex items-center gap-1 transition-colors"
                          title={`${trName} (${ev.trainer_name})`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                          <span className="truncate">{trName}</span>
                        </div>
                      )
                    })}

                    {visibleEvents.length > 2 && (
                      <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 px-1">
                        +{visibleEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Selected Day Schedule Details Card (Matching Screenshot exactly) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-5 sm:p-6 space-y-5">
          {/* Header */}
          <div>
            <p className="text-indigo-600 dark:text-indigo-400 font-bold text-[11px] sm:text-xs tracking-wider uppercase mb-1">
              TODAY'S SCHEDULE
            </p>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              {selectedDateFormatted}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {displayedDayEvents.length === 0
                ? 'No sessions scheduled'
                : `${displayedDayEvents.length} session${displayedDayEvents.length > 1 ? 's' : ''} scheduled`}
            </p>
          </div>

          {/* Event Content List or Empty State */}
          {displayedDayEvents.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <CalendarIcon className="h-6 w-6 stroke-1" />
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-[220px]">
                No training programs scheduled for this date.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCreate(selectedDateStr)}
                className="mt-2 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Schedule Session
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {displayedDayEvents.map(s => {
                const trName = (s as unknown as { trainings: { name: string } })?.trainings?.name || 'Training'
                const deptName = (s as unknown as { departments: { name: string } })?.departments?.name || 'All Departments'
                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {trName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3 text-indigo-500" /> Trainer: <strong>{s.trainer_name}</strong>
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] capitalize font-semibold ${getStatusColor(s.status)}`}>
                        {s.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> Group: <strong className="capitalize">{s.group_type}</strong>
                      </span>
                      {s.group_type === 'department' && (
                        <span className="truncate">({deptName})</span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openEventDetails(s)}
                        className="h-7 text-xs flex-1"
                      >
                        <Eye className="h-3 w-3 mr-1" /> View Roster
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/attendance')}
                        className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        title="Mark Attendance"
                      >
                        <ClipboardCheck className="h-3 w-3 mr-1 text-emerald-600" /> Attendance
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(s)}
                        className="h-7 w-7 text-slate-500 hover:text-slate-900"
                        title="Edit Schedule"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Roster & Quick Event Detail Dialog */}
      <Dialog open={eventDetailOpen} onOpenChange={setEventDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-lg">
                  {(selectedEventSchedule as unknown as { trainings: { name: string } })?.trainings?.name || 'Training Session Details'}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Scheduled for {selectedEventSchedule && formatDate(selectedEventSchedule.scheduled_date)} · Trainer: {selectedEventSchedule?.trainer_name}
                </p>
              </div>
              {selectedEventSchedule && (
                <Badge variant="outline" className={`capitalize ${getStatusColor(selectedEventSchedule.status)}`}>
                  {selectedEventSchedule.status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-xl text-xs">
              <div>
                <span className="text-muted-foreground">Target Group:</span>
                <p className="font-semibold capitalize mt-0.5">{selectedEventSchedule?.group_type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Enrolled Trainees:</span>
                <p className="font-semibold text-primary mt-0.5">{enrolledList.length} Employees</p>
              </div>
              <div>
                <span className="text-muted-foreground">Department:</span>
                <p className="font-semibold mt-0.5 truncate">
                  {(selectedEventSchedule as unknown as { departments: { name: string } })?.departments?.name || 'All'}
                </p>
              </div>
            </div>

            {selectedEventSchedule?.notes && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-xs space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Session Notes:</span>
                <p className="text-muted-foreground">{selectedEventSchedule.notes}</p>
              </div>
            )}

            {/* Enrolled Employee List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Assigned Employee Roster ({enrolledList.length})
              </h4>
              {loadingEnrolled ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                </div>
              ) : enrolledList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No employees assigned to this schedule.</p>
              ) : (
                <div className="divide-y divide-border border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  {enrolledList.map(emp => (
                    <div key={emp.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/30">
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{emp.code} · {emp.department} ({emp.designation})</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] capitalize ${getStatusColor(emp.status)}`}>
                        {emp.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={handleDownloadPdfSheet} disabled={enrolledList.length === 0}>
              <Download className="h-4 w-4 mr-1.5 text-blue-600" /> Download Attendance Sheet PDF
            </Button>
            <Button size="sm" onClick={() => { setEventDetailOpen(false); navigate('/attendance') }}>
              <ClipboardCheck className="h-4 w-4 mr-1.5" /> Mark Attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Training Schedule' : 'Schedule a Training Session'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div className="space-y-1.5">
              <Label>Training Course *</Label>
              <Select value={form.training_id} onValueChange={v => setForm(f => ({ ...f, training_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select course…" /></SelectTrigger>
                <SelectContent>
                  {trainings.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.frequency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Scheduled Date *</Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Trainer Name *</Label>
                <Input
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={form.trainer_name}
                  onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Target Audience *</Label>
                <Select value={form.group_type} onValueChange={v => setForm(f => ({ ...f, group_type: v as GroupType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees ({employees.length})</SelectItem>
                    <SelectItem value="department">Specific Department</SelectItem>
                    <SelectItem value="selected">Selected Employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.group_type === 'department' && (
                <div className="space-y-1.5">
                  <Label>Department *</Label>
                  <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choose department…" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ScheduleStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Individual Employee Selection Multi-select */}
            {form.group_type === 'selected' && (
              <div className="space-y-2 border rounded-xl p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Select Employees ({form.selected_employees.length} selected)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary"
                    onClick={() => {
                      const allIds = employees.map(e => e.id)
                      setForm(f => ({
                        ...f,
                        selected_employees: f.selected_employees.length === allIds.length ? [] : allIds,
                      }))
                    }}
                  >
                    {form.selected_employees.length === employees.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 divide-y divide-border/50">
                  {employees.map(emp => {
                    const isChecked = form.selected_employees.includes(emp.id)
                    return (
                      <label key={emp.id} className="flex items-center gap-2.5 p-1.5 hover:bg-muted/40 rounded cursor-pointer text-xs">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={checked => {
                            setForm(f => ({
                              ...f,
                              selected_employees: checked
                                ? [...f.selected_employees, emp.id]
                                : f.selected_employees.filter(id => id !== emp.id),
                            }))
                          }}
                        />
                        <span className="font-medium">{emp.name}</span>
                        <span className="text-muted-foreground font-mono text-[11px]">({emp.employee_code})</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Session Notes / Agenda (Optional)</Label>
              <Textarea
                rows={3}
                placeholder="Key learning objectives, location / meeting room, required materials..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Schedule Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
