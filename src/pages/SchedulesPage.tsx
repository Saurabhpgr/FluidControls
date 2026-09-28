import React, { useState, useEffect } from 'react'
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
  Sparkles
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
import { formatDate, getStatusColor, addDaysToFrequency, getCalendarEventColor } from '@/lib/utils'
import { toast } from 'sonner'
import type { Training, Department, Employee, TrainingSchedule, GroupType, ScheduleStatus } from '@/types'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

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

export default function SchedulesPage() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingSchedule | null>(null)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('calendar') // Default to calendar view as requested

  // Google Calendar Quick Event Popover / Detail Dialog
  const [selectedEventSchedule, setSelectedEventSchedule] = useState<TrainingSchedule | null>(null)
  const [eventDetailOpen, setEventDetailOpen] = useState(false)
  const [enrolledList, setEnrolledList] = useState<EnrolledEmployeeInfo[]>([])
  const [loadingEnrolled, setLoadingEnrolled] = useState(false)

  // Calendar Responsive State
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false))

  useEffect(() => {
    loadAll()
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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
      scheduled_date: prefilledDate || '',
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
      // Fetch enrolled employees for this schedule
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
        // Fallback: calculate from group_type if attendance rows not yet generated
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

  // Resolve employees for a given group configuration
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

        // Resolve and persist employee roster
        const resolved = resolveEmployees()
        if (resolved.length > 0) {
          const seRows = resolved.map(e => ({ schedule_id: scheduleId, employee_id: e.id }))
          await supabase.from('schedule_employees').insert(seRows)

          // Initialize attendance rows as not_marked
          const attRows = resolved.map(e => ({
            schedule_id: scheduleId,
            employee_id: e.id,
            attendance_status: 'not_marked',
          }))
          await supabase.from('attendance').insert(attRows)

          // Initialize training history as pending
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

  const getSuggestedDate = (trainingId: string): string => {
    const training = trainings.find(t => t.id === trainingId)
    if (!training || training.frequency === 'one_time' || training.frequency === 'as_required') return ''
    const lastSchedule = schedules
      .filter(s => s.training_id === trainingId && s.status === 'completed')
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())[0]
    if (!lastSchedule) return ''
    const nextDate = addDaysToFrequency(new Date(lastSchedule.scheduled_date), training.frequency)
    return nextDate.toISOString().split('T')[0]
  }

  const filtered = schedules.filter(s => {
    const matchSearch =
      (s as unknown as { trainings: { name: string } }).trainings?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.trainer_name.toLowerCase().includes(search.toLowerCase()) ||
      ((s as unknown as { departments: { name: string } }).departments?.name?.toLowerCase().includes(search.toLowerCase()) || '')
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  // Calendar Event Mappings with Google Calendar styling colors
  const calendarEvents = schedules.map(s => {
    const trainingName = (s as unknown as { trainings: { name: string } }).trainings?.name || 'Training'
    const color = getCalendarEventColor(s.status)
    return {
      id: s.id,
      title: trainingName,
      date: s.scheduled_date,
      backgroundColor: color,
      borderColor: color,
      textColor: '#ffffff',
      extendedProps: {
        status: s.status,
        trainer: s.trainer_name,
        groupType: s.group_type,
        department: (s as unknown as { departments: { name: string } })?.departments?.name || 'All',
        scheduleObj: s,
      },
    }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Training Schedule</h1>
          <p className="page-subtitle">
            {schedules.filter(s => s.status === 'planned').length} upcoming sessions | Google Calendar interactive scheduling
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/emails')} className="border-slate-300 hover:bg-slate-100 h-9">
            <Mail className="h-4 w-4 mr-1.5 text-blue-600" /> Send Alerts
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="border-slate-300 hover:bg-slate-100 h-9">
            <Download className="h-4 w-4 mr-1.5 text-slate-700" /> Export
          </Button>
          <Button size="sm" onClick={() => openCreate()} className="h-9">
            <Plus className="h-4 w-4 mr-1.5" /> Schedule Training
          </Button>
        </div>
      </div>

      {/* Tabs for List View and Calendar View (Position Preserved) */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>

          {tab === 'calendar' && (
            <p className="hidden md:flex items-center gap-1 text-xs text-muted-foreground font-medium">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Click any date cell to schedule | Click an event card for quick actions
            </p>
          )}
        </div>

        {/* --- LIST VIEW --- */}
        <TabsContent value="list">
          <Card>
            <CardContent className="p-3.5 sm:p-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 sm:mb-6">
                <div className="relative flex-1 w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by training, trainer, dept…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-44 h-9">
                    <SelectValue placeholder="Filter Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CalendarDays className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-slate-700">No scheduled sessions found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Create a new session or click any date on the calendar tab.
                  </p>
                  <Button className="mt-4" size="sm" onClick={() => openCreate()}>
                    <Plus className="h-4 w-4 mr-1.5" /> Schedule Training
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto w-full -mx-3.5 sm:mx-0 px-3.5 sm:px-0">
                  <table className="data-table min-w-[700px]">
                    <thead>
                      <tr>
                        <th>Training Course</th>
                        <th>Scheduled Date</th>
                        <th>Trainer Name</th>
                        <th>Target Group</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(s => (
                        <tr key={s.id}>
                          <td className="font-semibold text-slate-900 whitespace-nowrap">
                            {(s as unknown as { trainings: { name: string } }).trainings?.name}
                          </td>
                          <td className="whitespace-nowrap font-medium text-slate-700">{formatDate(s.scheduled_date)}</td>
                          <td className="whitespace-nowrap text-slate-600">{s.trainer_name}</td>
                          <td className="capitalize whitespace-nowrap text-xs text-muted-foreground">
                            {s.group_type === 'department'
                              ? `Dept: ${(s as unknown as { departments: { name: string } }).departments?.name || '—'}`
                              : s.group_type === 'all'
                              ? 'All Employees'
                              : 'Selected Staff'}
                          </td>
                          <td>
                            <span className={`status-badge ${getStatusColor(s.status)}`}>{s.status}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-primary hover:bg-primary/10"
                                onClick={() => openEventDetails(s)}
                              >
                                View Details
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => openEdit(s)} title="Edit Schedule">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- GOOGLE CALENDAR VIEW --- */}
        <TabsContent value="calendar">
          <Card className="border-border/80 shadow-sm overflow-hidden">
            <CardContent className="p-3 sm:p-6">
              <div className="google-calendar-container">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView={isMobile ? 'dayGridMonth' : 'dayGridMonth'}
                  events={calendarEvents}
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: isMobile ? 'dayGridMonth,timeGridDay' : 'dayGridMonth,timeGridWeek,timeGridDay',
                  }}
                  buttonText={{
                    today: 'Today',
                    month: 'Month',
                    week: 'Week',
                    day: 'Day',
                  }}
                  editable={true}
                  selectable={true}
                  selectMirror={true}
                  dayMaxEvents={isMobile ? 2 : 3}
                  aspectRatio={isMobile ? 0.85 : 1.65}
                  height="auto"
                  dateClick={info => {
                    openCreate(info.dateStr)
                    toast.info(`Scheduling training for ${formatDate(info.dateStr)}`)
                  }}
                  eventClick={info => {
                    const s = schedules.find(sched => sched.id === info.event.id)
                    if (s) {
                      openEventDetails(s)
                    }
                  }}
                  eventContent={eventInfo => {
                    const status = eventInfo.event.extendedProps.status || 'planned'
                    return (
                      <div className="flex items-center gap-1.5 px-1.5 py-0.5 w-full overflow-hidden text-left">
                        <span
                          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getCalendarEventColor(status) }}
                        />
                        <span className="truncate text-xs font-semibold">{eventInfo.event.title}</span>
                      </div>
                    )
                  }}
                />
              </div>

              {/* Status Color Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  {[
                    ['planned', '#3B82F6', 'Planned'],
                    ['ongoing', '#F59E0B', 'Ongoing'],
                    ['completed', '#10B981', 'Completed'],
                    ['cancelled', '#EF4444', 'Cancelled'],
                  ].map(([status, color, label]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full shadow-2xs" style={{ backgroundColor: color }} />
                      <span className="font-medium text-slate-700">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Showing {calendarEvents.length} scheduled event(s) on calendar
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- GOOGLE CALENDAR EVENT DETAIL MODAL --- */}
      <Dialog open={eventDetailOpen} onOpenChange={setEventDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 rounded-2xl shadow-2xl">
          {selectedEventSchedule && (
            <div>
              {/* Header Banner */}
              <div
                className="p-5 text-white relative rounded-t-2xl"
                style={{
                  background:
                    selectedEventSchedule.status === 'completed'
                      ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
                      : selectedEventSchedule.status === 'ongoing'
                      ? 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)'
                      : selectedEventSchedule.status === 'cancelled'
                      ? 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)'
                      : 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
                }}
              >
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-xs mb-2">
                      {selectedEventSchedule.status}
                    </span>
                    <h2 className="text-xl font-bold leading-tight">
                      {(selectedEventSchedule as unknown as { trainings: { name: string } }).trainings?.name || 'Training Course'}
                    </h2>
                    {(selectedEventSchedule as unknown as { trainings: { frequency?: string } }).trainings?.frequency && (
                      <p className="text-xs text-white/80 mt-0.5 capitalize">
                        Recurrence: {(selectedEventSchedule as unknown as { trainings: { frequency: string } }).trainings.frequency.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Event Body */}
              <div className="p-5 space-y-4 text-sm bg-white">
                {/* Time & Trainer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium">Scheduled Date</p>
                      <p className="font-semibold text-slate-800">{formatDate(selectedEventSchedule.scheduled_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <User className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium">Trainer</p>
                      <p className="font-semibold text-slate-800">{selectedEventSchedule.trainer_name}</p>
                    </div>
                  </div>
                </div>

                {/* Target Audience */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <Users className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium">Target Audience</p>
                      <p className="font-semibold text-slate-800 capitalize">
                        {selectedEventSchedule.group_type === 'department'
                          ? `Department: ${(selectedEventSchedule as unknown as { departments: { name: string } }).departments?.name || 'Assigned'}`
                          : selectedEventSchedule.group_type === 'all'
                          ? 'All Company Employees'
                          : 'Custom Selected Employees'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {loadingEnrolled ? '...' : `${enrolledList.length} Enrolled`}
                  </Badge>
                </div>

                {/* Notes */}
                {selectedEventSchedule.notes && (
                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Notes & Agenda</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{selectedEventSchedule.notes}</p>
                  </div>
                )}

                {/* Enrolled Employees Roster */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700">Enrolled Trainee Roster</p>
                    <span className="text-[11px] text-muted-foreground">
                      {enrolledList.filter(e => e.status === 'present').length} Present,{' '}
                      {enrolledList.filter(e => e.status === 'absent').length} Absent
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {loadingEnrolled ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">Loading trainee roster…</div>
                    ) : enrolledList.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">No employees enrolled</div>
                    ) : (
                      enrolledList.map(emp => (
                        <div key={emp.id} className="flex items-center justify-between px-3 py-2 text-xs">
                          <div>
                            <span className="font-semibold text-slate-800">{emp.name}</span>
                            <span className="text-muted-foreground text-[11px] ml-1.5 font-mono">({emp.code})</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              emp.status === 'present'
                                ? 'bg-emerald-100 text-emerald-700'
                                : emp.status === 'absent'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {emp.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quick Actions Footer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={handleDownloadPdfSheet}
                    title="Download Printable PDF Sheet with Signatures"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5 text-rose-600" /> PDF Sheet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => openEdit(selectedEventSchedule)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5 text-slate-700" /> Edit Session
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 text-xs font-semibold"
                    onClick={() => {
                      setEventDetailOpen(false)
                      navigate('/attendance')
                    }}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> Mark Attendance
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- CREATE / EDIT SCHEDULE DIALOG --- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Training Session' : 'Schedule New Training'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Training Course <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.training_id}
                onValueChange={v => {
                  const suggested = getSuggestedDate(v)
                  setForm(f => ({ ...f, training_id: v, scheduled_date: f.scheduled_date || suggested }))
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select training course" />
                </SelectTrigger>
                <SelectContent>
                  {trainings.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.training_id && getSuggestedDate(form.training_id) && (
                <p className="text-xs text-primary font-medium flex items-center gap-1">
                  💡 Suggested Next Occurrence: {formatDate(getSuggestedDate(form.training_id))}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label>
                  Scheduled Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Trainer Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={form.trainer_name}
                  onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Target Employee Group <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.group_type}
                onValueChange={v =>
                  setForm(f => ({
                    ...f,
                    group_type: v as GroupType,
                    department_id: '',
                    selected_employees: [],
                  }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Company Employees ({employees.length})</SelectItem>
                  <SelectItem value="department">By Department</SelectItem>
                  <SelectItem value="selected">Custom Selected Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.group_type === 'department' && (
              <div className="space-y-1.5">
                <Label>
                  Select Department <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.department_id}
                  onValueChange={v => setForm(f => ({ ...f, department_id: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({employees.filter(e => e.department_id === d.id).length} staff)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.group_type === 'selected' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Select Staff Members <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-xs text-primary font-medium">
                    {form.selected_employees.length} of {employees.length} selected
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 bg-slate-50/50">
                  {employees.map(e => (
                    <div key={e.id} className="flex items-center gap-2.5 p-1 rounded hover:bg-white transition-colors">
                      <Checkbox
                        id={`emp-${e.id}`}
                        checked={form.selected_employees.includes(e.id)}
                        onCheckedChange={checked => {
                          setForm(f => ({
                            ...f,
                            selected_employees: checked
                              ? [...f.selected_employees, e.id]
                              : f.selected_employees.filter(id => id !== e.id),
                          }))
                        }}
                      />
                      <label htmlFor={`emp-${e.id}`} className="text-xs cursor-pointer flex-1 font-medium text-slate-700">
                        {e.name} <span className="text-muted-foreground font-mono font-normal">({e.employee_code})</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editing && (
              <div className="space-y-1.5">
                <Label>Schedule Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ScheduleStatus }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes & Location</Label>
              <Textarea
                placeholder="Meeting room, Zoom link, preparation notes..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {!editing && form.training_id && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Total Enrolled Trainees:</span>
                <Badge variant="default" className="font-bold">
                  {resolveEmployees().length} Employees
                </Badge>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 mt-4 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
