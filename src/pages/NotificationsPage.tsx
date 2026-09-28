import React, { useState, useEffect } from 'react'
import { 
  Mail, Send, Copy, ExternalLink, Users, BookOpen, AlertTriangle, 
  CheckCircle2, Clock, Calendar, Check, FileQuestion, FolderOpen,
  Sparkles, MessageSquare, Filter, ShieldAlert, Search, Eye
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
    name: 'Training Invitation',
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
    name: 'Mandatory Quiz Link',
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
    name: 'Study Materials',
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
    name: 'Session Reminder',
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
    name: 'Overdue Escalation',
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
  } catch {
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
  const [search, setSearch] = useState<string>('')

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

  const filteredEmployees = enrolledEmployees.filter(item => {
    const matchSearch = !search || 
      item.employee.name.toLowerCase().includes(search.toLowerCase()) ||
      item.employee.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      item.employee.email.toLowerCase().includes(search.toLowerCase())
    
    if (!matchSearch) return false

    if (audienceFilter === 'all') return true
    if (audienceFilter === 'pending_attendance') return item.attendanceStatus === 'not_marked' || item.attendanceStatus === 'absent'
    if (audienceFilter === 'present_only') return item.attendanceStatus === 'present'
    if (audienceFilter === 'overdue') return item.historyStatus === 'pending' || item.historyStatus === 'overdue'
    return true
  })

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

  const handleCopyAllEmails = () => {
    const emails = filteredEmployees.map(e => e.employee.email).filter(Boolean)
    if (emails.length === 0) {
      toast.error('No employee emails to copy')
      return
    }
    navigator.clipboard.writeText(emails.join(', '))
    toast.success(`Copied ${emails.length} recipient email(s) for Mass BCC!`)
  }

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

  const handleSendIndividual = (emp: Employee) => {
    const { subject, body } = renderMessageForEmployee(emp)
    dispatchMailto(emp.email, '', subject, body)

    supabase.from('notifications').insert({
      type: selectedTemplate === 'escalation' ? 'overdue' : selectedTemplate === 'invitation' ? 'new_training_assigned' : 'reminder',
      schedule_id: selectedScheduleId,
      employee_id: emp.id,
      message: `${currentTemplate.name} dispatched to ${emp.name} (${emp.email})`,
      sent_at: new Date().toISOString(),
      status: 'sent',
    }).then(() => {}).catch(() => {})

    toast.success(`Redirecting to Mail app for ${emp.name}`)
  }

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
      {/* Clean Page Header matching Employees & Training Master pages */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Emails & Alerts</h1>
          <p className="page-subtitle">Targeted notifications, schedule invitations, assessment links, and escalations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAllEmails}
            title="Copy All Participant Emails"
            className="flex-1 sm:flex-none border-slate-300 hover:bg-slate-100"
          >
            <Copy className="h-4 w-4 text-slate-600 mr-1.5" /> Copy Emails ({filteredEmployees.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenMassBcc}
            title="Open Mass BCC in Default Mail Client"
            className="flex-1 sm:flex-none border-slate-300 hover:bg-slate-100"
          >
            <ExternalLink className="h-4 w-4 text-blue-600 mr-1.5" /> Open Mass BCC
          </Button>
          <Button 
            size="sm" 
            onClick={() => openPreview()} 
            className="w-full sm:w-auto"
          >
            <MessageSquare className="h-4 w-4 mr-1.5" /> Preview Template
          </Button>
        </div>
      </div>

      {/* Main Clean Card Container matching Employees & Trainings */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Top Filters & Controls Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 mb-4 sm:mb-6">
            {/* Search Input */}
            <div className="relative flex-1 w-full lg:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search participants…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Session Selector */}
            <div className="w-full lg:w-72">
              <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Select training session" />
                </SelectTrigger>
                <SelectContent>
                  {schedules.map(s => {
                    const trName = (s as unknown as { trainings: { name: string } })?.trainings?.name || 'Training'
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {trName} — {formatDate(s.scheduled_date)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Template Selector */}
            <div className="w-full lg:w-56">
              <Select value={selectedTemplate} onValueChange={v => setSelectedTemplate(v as EmailTemplateType)}>
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map(tmpl => (
                    <SelectItem key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Audience Filter */}
            <div className="w-full lg:w-48">
              <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Participants ({enrolledEmployees.length})</SelectItem>
                  <SelectItem value="pending_attendance">Pending / Absent</SelectItem>
                  <SelectItem value="present_only">Present Only</SelectItem>
                  <SelectItem value="overdue">Overdue Records</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clean Session Summary Bar */}
          {currentSchedule && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 mb-5 rounded-xl bg-muted/40 border text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div>
                  <span className="font-semibold text-foreground">Program: </span>
                  <span>{currentTrainingName}</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Date: </span>
                  <span>{formatDate(currentSchedule.scheduled_date)}</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Trainer: </span>
                  <span>{currentSchedule.trainer_name}</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Group: </span>
                  <span className="capitalize">{currentSchedule.group_type}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white">
                  <Users className="h-3 w-3 mr-1 text-primary" /> {enrolledEmployees.length} Enrolled
                </Badge>
                {quiz ? (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <FileQuestion className="h-3 w-3 mr-1" /> Quiz: {quiz.title}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground bg-white">
                    No Quiz Attached
                  </Badge>
                )}
                {materials.length > 0 ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <FolderOpen className="h-3 w-3 mr-1" /> {materials.length} Material(s)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground bg-white">
                    No Materials
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Clean Table matching EmployeesPage & TrainingsPage */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Mail className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">No participants found matching current filters</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Try switching the training session or search term</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="data-table min-w-[700px]">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Attendance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(item => (
                    <tr key={item.employee.id}>
                      <td>
                        <Badge variant="outline">{item.employee.employee_code}</Badge>
                      </td>
                      <td className="font-medium whitespace-nowrap text-foreground">
                        {item.employee.name}
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap">
                        {item.employee.email}
                      </td>
                      <td className="whitespace-nowrap">
                        {item.employee.departments?.name || '—'}
                      </td>
                      <td>
                        <Badge
                          variant={
                            item.attendanceStatus === 'present'
                              ? 'success'
                              : item.attendanceStatus === 'absent'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="capitalize text-xs font-normal"
                        >
                          {item.attendanceStatus?.replace('_', ' ') || 'Pending'}
                        </Badge>
                      </td>
                      <td>
                        <Badge 
                          variant={item.employee.is_active ? 'success' : 'secondary'}
                          className="text-xs font-normal"
                        >
                          {item.employee.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-primary border-primary/30 hover:bg-primary/5"
                            onClick={() => handleSendIndividual(item.employee)}
                            title="Send email via default Mail App"
                          >
                            <Send className="h-3.5 w-3.5 mr-1" /> Send Alert
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => openPreview(item.employee)}
                            title="Preview and customize email"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Preview
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
        <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Preview & Customize Email Alert
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {previewEmployee && (
              <div className="p-3 bg-muted/40 rounded-xl text-xs flex items-center justify-between border">
                <div>
                  <span className="text-muted-foreground">Recipient: </span>
                  <span className="font-semibold text-foreground">{previewEmployee.name}</span>{' '}
                  <span className="text-muted-foreground">({previewEmployee.email})</span>
                </div>
                <Badge variant="outline" className="bg-white">
                  {currentTemplate.name}
                </Badge>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subject Line</Label>
              <Input
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                className="text-sm font-medium h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email Body Content</Label>
              <Textarea
                rows={12}
                value={customBody}
                onChange={e => setCustomBody(e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <div className="flex items-center gap-2 w-full justify-between">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleCopyPreview}
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                  Close
                </Button>
                <Button size="sm" onClick={handleSendFromPreview} className="bg-primary text-white">
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Send in Mail App
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
