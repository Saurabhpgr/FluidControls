import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Search, CalendarDays, Download, Eye, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { exportToExcel } from '@/lib/excel'
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
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { getCalendarEventColor } from '@/lib/utils'

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
  training_id: '', scheduled_date: '', trainer_name: '',
  group_type: 'all', department_id: '', status: 'planned',
  notes: '', selected_employees: [],
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
  const [tab, setTab] = useState('list')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: s }, { data: t }, { data: d }, { data: e }] = await Promise.all([
      supabase.from('training_schedules').select('*, trainings(name, frequency), departments(name)').order('scheduled_date', { ascending: false }),
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

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm)
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
    setDialogOpen(true)
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
    if (!form.training_id) { toast.error('Please select a training'); return }
    if (!form.scheduled_date) { toast.error('Please select a date'); return }
    if (!form.trainer_name.trim()) { toast.error('Trainer name is required'); return }
    if (form.group_type === 'department' && !form.department_id) { toast.error('Please select a department'); return }
    if (form.group_type === 'selected' && form.selected_employees.length === 0) { toast.error('Please select at least one employee'); return }

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
        toast.success('Schedule updated successfully')
      } else {
        const { data, error } = await supabase.from('training_schedules').insert(payload).select().single()
        if (error) throw error
        scheduleId = data.id

        // Resolve and persist employee list
        const resolved = resolveEmployees()
        if (resolved.length > 0) {
          const seRows = resolved.map(e => ({ schedule_id: scheduleId, employee_id: e.id }))
          await supabase.from('schedule_employees').insert(seRows)

          // Initialize attendance rows as not_marked
          const attRows = resolved.map(e => ({ schedule_id: scheduleId, employee_id: e.id, attendance_status: 'not_marked' }))
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

        await logAudit({ action: 'schedule_created', entity_type: 'training_schedule', entity_id: scheduleId, details: { ...payload, employee_count: resolved.length } })
        toast.success(`Schedule created with ${resolved.length} employees`)
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

  const handleExport = () => {
    exportToExcel(
      filtered as unknown as Record<string, unknown>[],
      [
        { key: 'trainings', label: 'Training', formatter: v => (v as { name: string })?.name || '' },
        { key: 'scheduled_date', label: 'Date', formatter: v => formatDate(v as string) },
        { key: 'trainer_name', label: 'Trainer' },
        { key: 'group_type', label: 'Group Type' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes', formatter: v => (v as string) || '' },
      ],
      'schedules_export'
    )
  }

  const filtered = schedules.filter(s => {
    const matchSearch = (s as unknown as { trainings: { name: string } }).trainings?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.trainer_name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  const calendarEvents = schedules.map(s => ({
    id: s.id,
    title: (s as unknown as { trainings: { name: string } }).trainings?.name || 'Training',
    date: s.scheduled_date,
    backgroundColor: getCalendarEventColor(s.status),
    borderColor: getCalendarEventColor(s.status),
    extendedProps: { status: s.status, trainer: s.trainer_name },
  }))

  const getSuggestedDate = (trainingId: string): string => {
    const training = trainings.find(t => t.id === trainingId)
    if (!training || training.frequency === 'one_time' || training.frequency === 'as_required') return ''
    const lastSchedule = schedules.filter(s => s.training_id === trainingId && s.status === 'completed')
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())[0]
    if (!lastSchedule) return ''
    const nextDate = addDaysToFrequency(new Date(lastSchedule.scheduled_date), training.frequency)
    return nextDate.toISOString().split('T')[0]
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Training Schedule</h1>
          <p className="page-subtitle">{schedules.filter(s => s.status === 'planned').length} planned sessions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/emails')}>
            <Mail className="h-4 w-4 mr-1 text-primary" /> Send Alerts
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Schedule Training
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search schedules…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
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
                  <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="font-medium text-muted-foreground">No schedules found</p>
                  <Button className="mt-4" size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Schedule Training</Button>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Training</th>
                        <th>Date</th>
                        <th>Trainer</th>
                        <th>Group</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(s => (
                        <tr key={s.id}>
                          <td className="font-medium whitespace-nowrap">{(s as unknown as { trainings: { name: string } }).trainings?.name}</td>
                          <td className="whitespace-nowrap">{formatDate(s.scheduled_date)}</td>
                          <td className="whitespace-nowrap">{s.trainer_name}</td>
                          <td className="capitalize whitespace-nowrap">{s.group_type === 'department' ? `Dept: ${(s as unknown as { departments: { name: string } }).departments?.name}` : s.group_type}</td>
                          <td><span className={`status-badge ${getStatusColor(s.status)}`}>{s.status}</span></td>
                          <td>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Edit"><Pencil className="h-4 w-4" /></Button>
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

        <TabsContent value="calendar">
          <Card>
            <CardContent className="pt-6">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                events={calendarEvents}
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
                eventClick={info => {
                  const s = schedules.find(s => s.id === info.event.id)
                  if (s) openEdit(s)
                }}
                height="auto"
              />
              <div className="flex gap-4 mt-4 text-xs">
                {[['planned', '#3B82F6'], ['ongoing', '#F59E0B'], ['completed', '#10B981'], ['cancelled', '#EF4444']].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="capitalize text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Schedule' : 'Schedule Training'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Training <span className="text-red-500">*</span></Label>
              <Select value={form.training_id} onValueChange={v => {
                const suggested = getSuggestedDate(v)
                setForm(f => ({ ...f, training_id: v, scheduled_date: f.scheduled_date || suggested }))
              }}>
                <SelectTrigger><SelectValue placeholder="Select training" /></SelectTrigger>
                <SelectContent>
                  {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.training_id && getSuggestedDate(form.training_id) && (
                <p className="text-xs text-primary">💡 Suggested next date: {formatDate(getSuggestedDate(form.training_id))}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Trainer Name <span className="text-red-500">*</span></Label>
                <Input placeholder="Trainer name" value={form.trainer_name} onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Employee Group <span className="text-red-500">*</span></Label>
              <Select value={form.group_type} onValueChange={v => setForm(f => ({ ...f, group_type: v as GroupType, department_id: '', selected_employees: [] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  <SelectItem value="department">By Department</SelectItem>
                  <SelectItem value="selected">Selected Employees</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.group_type === 'department' && (
              <div className="space-y-1.5">
                <Label>Department <span className="text-red-500">*</span></Label>
                <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.group_type === 'selected' && (
              <div className="space-y-2">
                <Label>Select Employees <span className="text-red-500">*</span></Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {employees.map(e => (
                    <div key={e.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`emp-${e.id}`}
                        checked={form.selected_employees.includes(e.id)}
                        onCheckedChange={checked => {
                          setForm(f => ({
                            ...f,
                            selected_employees: checked
                              ? [...f.selected_employees, e.id]
                              : f.selected_employees.filter(id => id !== e.id)
                          }))
                        }}
                      />
                      <label htmlFor={`emp-${e.id}`} className="text-sm cursor-pointer flex-1">
                        {e.name} <span className="text-muted-foreground text-xs">({e.employee_code})</span>
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{form.selected_employees.length} employee(s) selected</p>
              </div>
            )}

            {editing && (
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
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Any additional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            {!editing && form.training_id && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Employees to be enrolled: <span className="text-foreground font-semibold">{resolveEmployees().length}</span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
