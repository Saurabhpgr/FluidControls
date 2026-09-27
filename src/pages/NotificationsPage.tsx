import React, { useState, useEffect } from 'react'
import { 
  Mail, Send, Copy, ExternalLink, Users, BookOpen, AlertTriangle, 
  CheckCircle2, Clock, Calendar, Check, FileQuestion, FolderOpen,
  Sparkles, MessageSquare, Filter, ShieldAlert, History
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import type { TrainingSchedule, Employee, Training, Quiz, TrainingMaterial } from '@/types'

interface EnrolledEmployeeInfo {
  employee: Employee
  attendanceStatus?: string
  quizStatus?: string
  score?: number
  historyStatus?: string
}

type EmailTemplateType = 'invitation' | 'quiz_link' | 'materials' | 'reminder' | 'escalation'

interface EmailTemplateConfig {
  id: EmailTemplateType
  name: string
  subject: string
  icon: React.ElementType
  badgeColor: string
  generateBody: (ctx: {
    employeeName: string
    trainingName: string
    date: string
    trainer: string
    quiz?: Quiz | null
    materials?: TrainingMaterial[]
  }) => string
}

// Helpers to format real links
const formatMaterialsList = (materials?: TrainingMaterial[]) => {
  if (!materials || materials.length === 0) {
    return '  • (No uploaded study documents yet. Access portal: ' + window.location.origin + '/materials)'
  }
  return materials.map((m, idx) => 
    `  ${idx + 1}. ${m.title} [${m.resource_type.toUpperCase()}]: ${m.file_url}`
  ).join('\n')
}

const formatQuizInfo = (quiz?: Quiz | null, _trainingName?: string) => {
  if (!quiz) {
    return '  • Assessment quiz link will be provided during/after the training session.'
  }
  return `  • Quiz Title: ${quiz.title}
  • Direct Google Form Link: ${quiz.form_link}`
}

const TEMPLATES: EmailTemplateConfig[] = [
  {
    id: 'invitation',
    name: 'Training Session Invitation',
    subject: '[FluidControl] Training Invitation: {Training_Name}',
    icon: Calendar,
    badgeColor: 'bg-blue-100 text-blue-800',
    generateBody: ({ employeeName, trainingName, date, trainer, quiz, materials }) =>
`Dear ${employeeName},

You have been officially enrolled by HR in the upcoming company training program:

📌 Training Program: ${trainingName}
📅 Scheduled Date: ${date}
👨‍🏫 Trainer: ${trainer}
🏢 Organization: FluidControl Training & Safety

📚 Reference Study Materials & Guides:
${formatMaterialsList(materials)}

📝 Assessment Information:
${formatQuizInfo(quiz, trainingName)}

Please mark this date on your calendar and ensure timely attendance.

For any scheduling conflicts, please inform HR immediately.

Best regards,
FluidControl HR & Training Division
hr@fluidcontrol.com`,
  },
  {
    id: 'quiz_link',
    name: 'Mandatory Quiz & Assessment Link',
    subject: '[Action Required] Assessment for {Training_Name}',
    icon: FileQuestion,
    badgeColor: 'bg-amber-100 text-amber-800',
    generateBody: ({ employeeName, trainingName, quiz, materials }) =>
`Dear ${employeeName},

Thank you for participating in "${trainingName}".

To complete your training certification, please submit your mandatory assessment quiz:

${formatQuizInfo(quiz, trainingName)}

📚 Reference Study Materials:
${formatMaterialsList(materials)}

Please complete this assessment within 48 hours to update your training compliance record.

Best regards,
FluidControl Training Division
hr@fluidcontrol.com`,
  },
  {
    id: 'materials',
    name: 'Training Materials & Study Resources',
    subject: '[Study Resources] Reference Materials for {Training_Name}',
    icon: FolderOpen,
    badgeColor: 'bg-emerald-100 text-emerald-800',
    generateBody: ({ employeeName, trainingName, quiz, materials }) =>
`Dear ${employeeName},

The reference study materials and guides for "${trainingName}" are now available for your review:

📚 Available Resources & Direct Links:
${formatMaterialsList(materials)}

📝 Attached Assessment:
${formatQuizInfo(quiz, trainingName)}

Please review these resources before your session and keep them handy for post-training reference.

Best regards,
FluidControl HR & Training Division
hr@fluidcontrol.com`,
  },
  {
    id: 'reminder',
    name: 'Session Reminder & Preparation',
    subject: '[Reminder] Tomorrow: {Training_Name}',
    icon: Clock,
    badgeColor: 'bg-purple-100 text-purple-800',
    generateBody: ({ employeeName, trainingName, date, trainer, materials, quiz }) =>
`Dear ${employeeName},

This is a friendly reminder that your training session is scheduled for tomorrow:

📌 Training: ${trainingName}
📅 Date & Time: ${date}
👨‍🏫 Trainer: ${trainer}

📚 Review Materials Prior to Session:
${formatMaterialsList(materials)}

Please ensure you arrive 5 minutes early and bring any necessary reference materials.

Best regards,
FluidControl HR Team
hr@fluidcontrol.com`,
  },
  {
    id: 'escalation',
    name: 'Overdue Compliance Escalation',
    subject: '[URGENT ESCALATION] Overdue Training: {Training_Name}',
    icon: ShieldAlert,
    badgeColor: 'bg-red-100 text-red-800',
    generateBody: ({ employeeName, trainingName, quiz, materials }) =>
`Dear ${employeeName},

Our records indicate that your compliance requirement for "${trainingName}" is currently OVERDUE or pending mandatory assessment.

⚠️ In accordance with FluidControl safety and compliance standards, this training must be completed without delay.

📝 Mandatory Assessment Link:
${formatQuizInfo(quiz, trainingName)}

📚 Reference Study Materials:
${formatMaterialsList(materials)}

Please complete this requirement immediately to avoid administrative escalation.

Best regards,
FluidControl Compliance & HR Management
hr@fluidcontrol.com`,
  },
]

// RFC 6068 Compliant Mail Dispatch Helper for Native Mail Clients (Outlook, Apple Mail, Windows Mail)
function buildMailtoUrl(to: string, bcc: string, subject: string, body: string): string {
  const params: string[] = []
  if (bcc) {
    params.push(`bcc=${encodeURIComponent(bcc)}`)
  }
  if (subject) {
    params.push(`subject=${encodeURIComponent(subject)}`)
  }
  if (body) {
    params.push(`body=${encodeURIComponent(body)}`)
  }
  
  const cleanTo = to ? to.trim() : ''
  const qs = params.length > 0 ? `?${params.join('&')}` : ''
  return `mailto:${cleanTo}${qs}`
}

function dispatchMailto(to: string, bcc: string, subject: string, body: string) {
  const url = buildMailtoUrl(to, bcc, subject, body)
  try {
    window.location.href = url
  } catch (e) {
    const link = document.createElement('a')
    link.href = url
    link.target = '_self'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}


export default function NotificationsPage() {
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('')
  const [enrolledEmployees, setEnrolledEmployees] = useState<EnrolledEmployeeInfo[]>([])
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [materials, setMaterials] = useState<TrainingMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateType>('invitation')
  const [audienceFilter, setAudienceFilter] = useState<string>('all')

  // Preview Dialog State
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null)
  const [customSubject, setCustomSubject] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadSchedules()
  }, [])

  useEffect(() => {
    if (selectedScheduleId) {
      loadEnrolledData(selectedScheduleId)
    } else {
      setEnrolledEmployees([])
    }
  }, [selectedScheduleId])

  const loadSchedules = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('training_schedules')
      .select('*, trainings(id, name, frequency), departments(name)')
      .order('scheduled_date', { ascending: false })

    const list = (data || []) as unknown as TrainingSchedule[]
    setSchedules(list)
    if (list.length > 0) {
      setSelectedScheduleId(list[0].id)
    }
    setLoading(false)
  }

  const loadEnrolledData = async (scheduleId: string) => {
    setLoading(true)
    const sched = schedules.find(s => s.id === scheduleId)
    if (!sched) {
      setLoading(false)
      return
    }

    try {
      // 1. Fetch Schedule Employees or resolve based on group type
      const [{ data: seRows }, { data: allEmps }, { data: attRows }, { data: quizData }, { data: matData }, { data: histRows }] = await Promise.all([
        supabase.from('schedule_employees').select('employee_id').eq('schedule_id', scheduleId),
        supabase.from('employees').select('*, departments(name)').eq('is_active', true),
        supabase.from('attendance').select('*').eq('schedule_id', scheduleId),
        supabase.from('quizzes').select('*').eq('schedule_id', scheduleId).maybeSingle(),
        supabase.from('training_materials').select('*').eq('training_id', sched.training_id),
        supabase.from('employee_training_history').select('*').eq('schedule_id', scheduleId),
      ])

      setQuiz((quizData || null) as Quiz | null)
      setMaterials((matData || []) as TrainingMaterial[])

      let targetEmps: Employee[] = []
      const empsList = (allEmps || []) as unknown as Employee[]

      if (seRows && seRows.length > 0) {
        const empIds = new Set(seRows.map(r => r.employee_id))
        targetEmps = empsList.filter(e => empIds.has(e.id))
      } else if (sched.group_type === 'all') {
        targetEmps = empsList
      } else if (sched.group_type === 'department' && sched.department_id) {
        targetEmps = empsList.filter(e => e.department_id === sched.department_id)
      }

      // Combine with attendance and history info
      const mapped: EnrolledEmployeeInfo[] = targetEmps.map(emp => {
        const att = attRows?.find(a => a.employee_id === emp.id)
        const hist = histRows?.find(h => h.employee_id === emp.id)
        return {
          employee: emp,
          attendanceStatus: att?.attendance_status || 'not_marked',
          quizStatus: 'pending',
          historyStatus: hist?.status || 'pending',
        }
      })

      setEnrolledEmployees(mapped)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load enrolled employee data')
    } finally {
      setLoading(false)
    }
  }

  const currentSchedule = schedules.find(s => s.id === selectedScheduleId)
  const currentTrainingName = (currentSchedule as unknown as { trainings: { name: string } })?.trainings?.name || 'Training'
  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[0]

  // Filter enrolled employees based on audience selector
  const filteredEmployees = enrolledEmployees.filter(item => {
    if (audienceFilter === 'all') return true
    if (audienceFilter === 'pending_attendance') return item.attendanceStatus === 'not_marked' || item.attendanceStatus === 'absent'
    if (audienceFilter === 'present_only') return item.attendanceStatus === 'present'
    if (audienceFilter === 'overdue') return item.historyStatus === 'pending' || item.historyStatus === 'overdue'
    return true
  })

  // Format message for a specific employee with real links
  const renderMessageForEmployee = (emp: Employee) => {
    const subject = currentTemplate.subject.replace('{Training_Name}', currentTrainingName)
    const body = currentTemplate.generateBody({
      employeeName: emp.name,
      trainingName: currentTrainingName,
      date: currentSchedule ? formatDate(currentSchedule.scheduled_date) : '',
      trainer: currentSchedule?.trainer_name || 'HR Team',
      quiz,
      materials,
    })
    return { subject, body }
  }

  // Mass BCC: Copy all emails to clipboard
  const handleCopyAllEmails = () => {
    const emails = filteredEmployees.map(e => e.employee.email).filter(Boolean)
    if (emails.length === 0) {
      toast.error('No employee emails to copy')
      return
    }
    navigator.clipboard.writeText(emails.join(', '))
    toast.success(`Copied ${emails.length} recipient email(s) for Mass BCC!`)
  }

  // Open default mail client with mass BCC
  const handleOpenMassBcc = () => {
    const emails = filteredEmployees.map(e => e.employee.email).filter(Boolean)
    if (emails.length === 0) {
      toast.error('No employee emails selected')
      return
    }
    const sampleMsg = renderMessageForEmployee(filteredEmployees[0]?.employee || ({ name: 'Team Member' } as Employee))
    dispatchMailto('', emails.join(','), sampleMsg.subject, sampleMsg.body)
    toast.success(`Redirecting to Mail client with ${emails.length} BCC recipient(s)...`)
  }

  // Individual dispatch to native Mail App
  const handleSendIndividual = (emp: Employee) => {
    const { subject, body } = renderMessageForEmployee(emp)
    
    // Synchronously trigger mailto so browser does not block external protocol prompt
    dispatchMailto(emp.email, '', subject, body)

    // Log to notifications table
    supabase.from('notifications').insert({
      type: selectedTemplate === 'escalation' ? 'overdue' : selectedTemplate === 'invitation' ? 'new_training_assigned' : 'reminder',
      schedule_id: selectedScheduleId,
      employee_id: emp.id,
      message: `${currentTemplate.name} dispatched to ${emp.name} (${emp.email})`,
      sent_at: new Date().toISOString(),
      status: 'sent',
    }).then(() => {}).catch(err => {
      console.warn('Failed to log notification', err)
    })

    toast.success(`Redirecting to Mail app for ${emp.name}`)
  }

  // Open Preview Modal
  const openPreview = (emp?: Employee) => {
    const targetEmp = emp || filteredEmployees[0]?.employee || { name: '[Employee Name]', email: 'employee@fluidcontrol.com' } as Employee
    setPreviewEmployee(targetEmp)
    const { subject, body } = renderMessageForEmployee(targetEmp)
    setCustomSubject(subject)
    setCustomBody(body)
    setCopied(false)
    setPreviewOpen(true)
  }

  const handleCopyPreview = () => {
    const textToCopy = `Subject: ${customSubject}\n\n${customBody}`
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    toast.success('Message copied to clipboard!')
    setTimeout(() => setCopied(false), 3000)
  }

  const handleSendFromPreview = () => {
    if (!previewEmployee) return
    setPreviewOpen(false)
    dispatchMailto(previewEmployee.email, '', customSubject, customBody)

    supabase.from('notifications').insert({
      type: selectedTemplate === 'escalation' ? 'overdue' : selectedTemplate === 'invitation' ? 'new_training_assigned' : 'reminder',
      schedule_id: selectedScheduleId,
      employee_id: previewEmployee.id,
      message: `${currentTemplate.name} preview dispatched to ${previewEmployee.name} (${previewEmployee.email})`,
      sent_at: new Date().toISOString(),
      status: 'sent',
    }).then(() => {}).catch(() => {})

    toast.success(`Redirecting to Mail app for ${previewEmployee.name}`)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Emails & Alerts
          </h1>
          <p className="page-subtitle">
            Targeted notifications, schedule invitations, assessment links, and escalations for enrolled training participants
          </p>
        </div>
      </div>

      {/* Training Session Selector & Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Select Targeted Training Session
            </CardTitle>
            <CardDescription className="text-xs">
              Only employees enrolled in this specific training session will be targeted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Training Schedule</Label>
                <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a training schedule…" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.map(s => {
                      const trName = (s as unknown as { trainings: { name: string } })?.trainings?.name || 'Training'
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {trName} — {formatDate(s.scheduled_date)} ({s.status})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Audience Filter</Label>
                <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Enrolled Employees ({enrolledEmployees.length})</SelectItem>
                    <SelectItem value="pending_attendance">Pending Attendance / Absent</SelectItem>
                    <SelectItem value="present_only">Present Attendees Only</SelectItem>
                    <SelectItem value="overdue">Pending / Overdue Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick Session Details Pill with actual links summary */}
            {currentSchedule && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">TRAINER</span>
                    <span className="font-semibold text-slate-800">{currentSchedule.trainer_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">SCHEDULED DATE</span>
                    <span className="font-semibold text-slate-800">{formatDate(currentSchedule.scheduled_date)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">TARGET AUDIENCE</span>
                    <span className="font-semibold text-slate-800 capitalize">{currentSchedule.group_type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-white">
                    <Users className="h-3 w-3 mr-1 text-primary" /> {enrolledEmployees.length} Enrolled
                  </Badge>
                  {quiz ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200" title={quiz.form_link}>
                      <FileQuestion className="h-3 w-3 mr-1" /> Quiz: {quiz.title} ({quiz.pass_score || 70}%)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      No Quiz Attached
                    </Badge>
                  )}
                  {materials.length > 0 ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <FolderOpen className="h-3 w-3 mr-1" /> {materials.length} Material(s) Attached
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      No Materials
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it Works / HR Escalations Guidelines Card */}
        <Card className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-md border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-200">
              <Sparkles className="h-4 w-4 text-indigo-400" /> How HR Alerts & Escalations Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-300">
            <div className="flex items-start gap-2">
              <Send className="h-3.5 w-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Instant Dispatch:</strong> Click <em>Send Alert</em> on any employee to open a pre-filled email in your Mail app (Outlook, Windows Mail, Apple Mail) with their actual quiz & study links.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Copy className="h-3.5 w-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Template Preview:</strong> Click <em>Preview / Copy</em> to inspect or customize the exact formatted message before sending.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="h-3.5 w-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Mass BCC:</strong> Click <em>Open Mass BCC in Mail Client</em> or <em>Copy All Emails</em> to dispatch to all enrolled recipients at once.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Template Selector Bar */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Email Template Library</CardTitle>
              <CardDescription className="text-xs">
                Select an alert template to configure the subject and automated placeholders.
              </CardDescription>
            </div>
            {/* Mass Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-slate-300 hover:bg-slate-100"
                onClick={handleCopyAllEmails}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5 text-slate-600" /> Copy All Emails ({filteredEmployees.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-blue-300 bg-blue-50/50 text-blue-700 hover:bg-blue-100"
                onClick={handleOpenMassBcc}
                title="Opens your system default Mail App (Outlook, Apple Mail, Windows Mail)"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5 text-blue-600" /> Open Mass BCC in Mail Client
              </Button>
              <Button
                size="sm"
                className="text-xs"
                onClick={() => openPreview()}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Preview Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {TEMPLATES.map(tmpl => {
              const IconComp = tmpl.icon
              const isSelected = selectedTemplate === tmpl.id
              return (
                <div
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/60 hover:border-border hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-1.5 rounded-lg ${tmpl.badgeColor}`}>
                      <IconComp className="h-4 w-4" />
                    </div>
                    {isSelected && (
                      <Badge className="bg-primary text-white text-[10px] py-0 px-1.5">
                        Selected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-foreground line-clamp-1">{tmpl.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{tmpl.subject}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Enrolled Employees Recipient Table */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Enrolled Participants ({filteredEmployees.length} targeted)
              </CardTitle>
              <CardDescription className="text-xs">
                Employees enrolled in "{currentTrainingName}" who will receive this notification with real resource & quiz links.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-sm">No employees found for this training session & filter.</p>
              <p className="text-xs text-muted-foreground mt-1">Try changing the schedule or audience filter above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Employee Name</th>
                    <th>Email Address</th>
                    <th>Department</th>
                    <th>Attendance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(item => (
                    <tr key={item.employee.id}>
                      <td><Badge variant="outline">{item.employee.employee_code}</Badge></td>
                      <td className="font-medium text-slate-900 whitespace-nowrap">{item.employee.name}</td>
                      <td className="text-muted-foreground whitespace-nowrap">{item.employee.email}</td>
                      <td className="whitespace-nowrap">{item.employee.departments?.name || '—'}</td>
                      <td>
                        <Badge
                          variant={
                            item.attendanceStatus === 'present'
                              ? 'success'
                              : item.attendanceStatus === 'absent'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="capitalize text-[11px]"
                        >
                          {item.attendanceStatus?.replace('_', ' ') || 'Pending'}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/10"
                            onClick={() => handleSendIndividual(item.employee)}
                            title="Redirects to your Mail App with pre-filled subject, body, and actual links"
                          >
                            <Send className="h-3 w-3 mr-1" /> Send Alert
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-slate-600 hover:text-slate-900"
                            onClick={() => openPreview(item.employee)}
                            title="Preview formatted message"
                          >
                            <Copy className="h-3 w-3 mr-1" /> Preview
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

      {/* Message Preview & Customization Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5 text-primary" />
              Preview & Copy Template
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {previewEmployee && (
              <div className="bg-slate-50 border rounded-lg p-2.5 text-xs flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Recipient: </span>
                  <span className="font-semibold text-slate-800">{previewEmployee.name}</span>{' '}
                  <span className="text-muted-foreground">({previewEmployee.email})</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Template: {currentTemplate.name}
                </Badge>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="preview-subject" className="text-xs font-semibold">Subject Line</Label>
              <Input
                id="preview-subject"
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="preview-body" className="text-xs font-semibold">Message Body (Contains actual resource & quiz links)</Label>
              <Textarea
                id="preview-body"
                rows={13}
                value={customBody}
                onChange={e => setCustomBody(e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={handleCopyPreview}
              className="text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Message
                </>
              )}
            </Button>
            {previewEmployee && (
              <Button
                onClick={handleSendFromPreview}
                className="text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open in Mail App
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
