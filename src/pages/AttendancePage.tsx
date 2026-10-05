import React, { useState, useEffect } from 'react'
import { Search, ClipboardCheck, Save, Download, CheckCircle, XCircle, AlertTriangle, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { exportToExcel } from '@/lib/excel'
import { exportAttendanceSheetPdf } from '@/lib/pdf'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { formatDate, getStatusColor } from '@/lib/utils'
import { toast } from 'sonner'
import type { TrainingSchedule, AttendanceEntry } from '@/types'

export default function AttendancePage() {
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<TrainingSchedule | null>(null)

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    const { data } = await supabase
      .from('training_schedules')
      .select('*, trainings(name)')
      .order('scheduled_date', { ascending: false })
    setSchedules((data || []) as unknown as TrainingSchedule[])
  }

  const loadAttendance = async (scheduleId: string) => {
    setLoading(true)
    try {
      const schedule = schedules.find(s => s.id === scheduleId)
      setSelectedSchedule(schedule || null)

      // Get schedule employees with their current attendance status
      const { data: seData } = await supabase
        .from('schedule_employees')
        .select('employee_id, employees(id, name, employee_code)')
        .eq('schedule_id', scheduleId)

      const { data: attData } = await supabase
        .from('attendance')
        .select('employee_id, attendance_status')
        .eq('schedule_id', scheduleId)

      const attMap = new Map(attData?.map(a => [a.employee_id, a.attendance_status]) || [])

      const entries: AttendanceEntry[] = (seData || []).map(se => {
        const emp = se.employees as unknown as { id: string; name: string; employee_code: string }
        return {
          employee_id: emp.id,
          employee_name: emp.name,
          employee_code: emp.employee_code,
          attendance_status: (attMap.get(emp.id) as AttendanceEntry['attendance_status']) || 'not_marked',
        }
      })

      setAttendance(entries)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedScheduleId) loadAttendance(selectedScheduleId)
    else { setAttendance([]); setSelectedSchedule(null) }
  }, [selectedScheduleId])

  const todayStr = new Date().toISOString().split('T')[0]
  const isFutureSchedule = Boolean(selectedSchedule && selectedSchedule.scheduled_date > todayStr)

  const markAll = (status: 'present' | 'absent') => {
    if (isFutureSchedule && selectedSchedule) {
      toast.warning(`Cannot mark attendance before scheduled date (${formatDate(selectedSchedule.scheduled_date)}).`)
      return
    }
    setAttendance(att => att.map(a => ({ ...a, attendance_status: status })))
  }

  const toggleStatus = (employeeId: string) => {
    if (isFutureSchedule && selectedSchedule) {
      toast.warning(`Cannot mark attendance before scheduled date (${formatDate(selectedSchedule.scheduled_date)}).`)
      return
    }
    setAttendance(att => att.map(a => {
      if (a.employee_id === employeeId) {
        // Toggle between present and absent directly
        const nextStatus = a.attendance_status === 'present' ? 'absent' : 'present'
        return { ...a, attendance_status: nextStatus }
      }
      return a
    }))
  }

  const handleSave = async () => {
    if (!selectedScheduleId) return

    if (isFutureSchedule && selectedSchedule) {
      toast.error(`Cannot record attendance before scheduled date (${formatDate(selectedSchedule.scheduled_date)}). Attendance opens on or after session date.`)
      return
    }

    setSaving(true)
    try {
      const payload = attendance.map(a => ({
        employee_id: a.employee_id,
        attendance_status: a.attendance_status,
      }))

      // Try the transactional RPC first
      const { error: rpcError } = await supabase.rpc('mark_attendance_and_update_history', {
        p_schedule_id: selectedScheduleId,
        p_attendance_data: payload,
      })

      if (rpcError) {
        console.warn('RPC mark_attendance_and_update_history failed, using direct client fallback:', rpcError)
        
        // 1. Upsert attendance records
        const attRows = attendance.map(a => ({
          schedule_id: selectedScheduleId,
          employee_id: a.employee_id,
          attendance_status: a.attendance_status,
          marked_at: new Date().toISOString(),
        }))
        const { error: attErr } = await supabase.from('attendance').upsert(attRows, { onConflict: 'schedule_id,employee_id' })
        if (attErr) throw attErr

        // 2. Update employee training history
        if (selectedSchedule) {
          for (const a of attendance) {
            const histPayload: Record<string, unknown> = {
              employee_id: a.employee_id,
              training_id: selectedSchedule.training_id,
              schedule_id: selectedScheduleId,
              status: a.attendance_status === 'present' ? 'completed' : 'pending',
            }
            if (a.attendance_status === 'present') {
              histPayload.completed_on = selectedSchedule.scheduled_date
            }
            await supabase.from('employee_training_history').upsert(histPayload, { onConflict: 'employee_id,schedule_id' })
          }

          // 3. Mark schedule as completed if all marked
          const hasUnmarked = attendance.some(a => a.attendance_status === 'not_marked')
          if (!hasUnmarked) {
            await supabase.from('training_schedules').update({ status: 'completed' }).eq('id', selectedScheduleId)
          }
        }
      }

      await logAudit({
        action: 'attendance_marked',
        entity_type: 'training_schedule',
        entity_id: selectedScheduleId,
        details: {
          present: attendance.filter(a => a.attendance_status === 'present').length,
          absent: attendance.filter(a => a.attendance_status === 'absent').length,
          not_marked: attendance.filter(a => a.attendance_status === 'not_marked').length,
        }
      })

      toast.success('Attendance saved and training history updated!')
      loadSchedules()
      loadAttendance(selectedScheduleId)
    } catch (e: unknown) {
      console.error('Attendance save error:', e)
      const err = e as { message?: string }
      toast.error(err?.message || 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const handleExportExcel = () => {
    if (!selectedSchedule) return
    exportToExcel(
      attendance as unknown as Record<string, unknown>[],
      [
        { key: 'employee_code', label: 'Employee Code' },
        { key: 'employee_name', label: 'Name' },
        { key: 'department', label: 'Department' },
        { key: 'designation', label: 'Designation' },
        { key: 'attendance_status', label: 'Status' },
      ],
      `attendance_${formatDate(selectedSchedule.scheduled_date).replace(/\s/g, '_')}`
    )
    toast.success('Exported to Excel')
  }

  const handleExportPdf = () => {
    if (!selectedSchedule) return
    const trName = (selectedSchedule as unknown as { trainings: { name: string } })?.trainings?.name || 'Training Session'
    exportAttendanceSheetPdf({
      trainingName: trName,
      trainerName: selectedSchedule.trainer_name,
      scheduledDate: selectedSchedule.scheduled_date,
      groupType: selectedSchedule.group_type,
      employees: attendance.map(a => ({
        code: a.employee_code || '',
        name: a.employee_name || '',
        department: a.department || '',
        designation: a.designation || '',
        status: a.attendance_status,
      })),
    })
    toast.success('Printable Attendance PDF downloaded')
  }

  const presentCount = attendance.filter(a => a.attendance_status === 'present').length
  const absentCount = attendance.filter(a => a.attendance_status === 'absent').length
  const notMarkedCount = attendance.filter(a => a.attendance_status === 'not_marked').length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Marking</h1>
          <p className="page-subtitle">Mark attendance for training sessions</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-md space-y-1.5">
            <Label>Select Training Session</Label>
            <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a training session to mark attendance…" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {(s as unknown as { trainings: { name: string } }).trainings?.name} — {formatDate(s.scheduled_date)} ({s.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedSchedule && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg truncate">
                  {(selectedSchedule as unknown as { trainings: { name: string } }).trainings?.name}
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {formatDate(selectedSchedule.scheduled_date)} · Trainer: {selectedSchedule.trainer_name}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={attendance.length === 0} className="text-xs">
                  <Download className="h-3.5 w-3.5 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={attendance.length === 0} className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Download className="h-3.5 w-3.5 mr-1 text-blue-600" /> Printable PDF
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave} 
                  disabled={saving || attendance.length === 0 || isFutureSchedule} 
                  className="text-xs"
                >
                  <Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'Saving…' : 'Save Attendance'}
                </Button>
              </div>
            </div>

            {/* Date Lock Banner if session is in the future */}
            {isFutureSchedule && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-medium">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Attendance Marking Locked:</span> This session is scheduled for <strong>{formatDate(selectedSchedule.scheduled_date)}</strong>. Attendance can only be marked on or after this date.
                </div>
              </div>
            )}

            {attendance.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t">
                <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>{presentCount} Present</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-red-700">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span>{absentCount} Absent</span>
                  </div>
                  {notMarkedCount > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                      <span>{notMarkedCount} Not Marked</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAll('present')}
                    disabled={isFutureSchedule}
                    className="flex-1 sm:flex-none text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8"
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark All Present
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAll('absent')}
                    disabled={isFutureSchedule}
                    className="flex-1 sm:flex-none text-xs text-red-700 border-red-300 hover:bg-red-50 h-8"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Mark All Absent
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
              </div>
            ) : attendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="font-medium text-muted-foreground">No employees enrolled in this session</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendance.map(a => (
                  <div
                    key={a.employee_id}
                    onClick={() => toggleStatus(a.employee_id)}
                    className={`flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 min-w-0 ${
                      isFutureSchedule ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                    } ${
                      a.attendance_status === 'present'
                        ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                        : a.attendance_status === 'absent'
                        ? 'bg-red-50 border-red-300 hover:bg-red-100'
                        : 'bg-muted/30 border-muted hover:bg-muted/60 border-dashed'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-xs sm:text-sm font-bold text-muted-foreground">
                          {a.employee_name[0]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs sm:text-sm truncate">{a.employee_name}</p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{a.employee_code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <span className={`status-badge text-[10px] sm:text-xs px-2 py-0.5 ${getStatusColor(a.attendance_status)}`}>
                        {a.attendance_status === 'not_marked' ? 'Not Marked' : a.attendance_status}
                      </span>
                      {a.attendance_status === 'present' ? (
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 flex-shrink-0" />
                      ) : a.attendance_status === 'absent' ? (
                        <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full border-2 border-dashed border-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
