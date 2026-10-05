import React, { useState, useEffect } from 'react'
import { Download, Search, Filter, User, TrendingUp, AlertTriangle, CheckCircle, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToCsv } from '@/lib/excel'
import { exportComplianceReportPdf, exportEmployeeHistoryPdf } from '@/lib/pdf'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate, getStatusColor } from '@/lib/utils'
import type { Training, Department, Employee, EmployeeTrainingHistory } from '@/types'

type HistoryWithRelations = EmployeeTrainingHistory & {
  employees: Employee & { departments: Department }
  trainings: Training
  training_schedules: { scheduled_date: string; trainer_name: string }
}

export default function ReportsPage() {
  const [history, setHistory] = useState<HistoryWithRelations[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [trainingFilter, setTrainingFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  // Employee drill-down
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [empHistory, setEmpHistory] = useState<HistoryWithRelations[]>([])
  const [empDialog, setEmpDialog] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      await supabase.rpc('refresh_overdue_training_statuses')
    } catch {
      // ignore if RPC not yet created in Supabase
    }
    const [{ data: h }, { data: t }, { data: d }, { data: e }] = await Promise.all([
      supabase.from('employee_training_history')
        .select('*, employees(*, departments(*)), trainings(*), training_schedules(scheduled_date, trainer_name)')
        .order('due_date', { ascending: false }),
      supabase.from('trainings').select('*').eq('is_active', true).order('name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('employees').select('*, departments(name)').eq('is_active', true).order('name'),
    ])
    setHistory((h || []) as unknown as HistoryWithRelations[])
    setTrainings(t || [])
    setDepartments(d || [])
    setEmployees((e || []) as unknown as Employee[])
    setLoading(false)
  }

  const openEmpDrilldown = async (emp: Employee) => {
    setSelectedEmployee(emp)
    const { data } = await supabase.from('employee_training_history')
      .select('*, employees(*, departments(*)), trainings(*), training_schedules(scheduled_date, trainer_name)')
      .eq('employee_id', emp.id)
      .order('training_schedules(scheduled_date)', { ascending: false })
    setEmpHistory((data || []) as unknown as HistoryWithRelations[])
    setEmpDialog(true)
  }

  const todayStr = new Date().toISOString().split('T')[0]

  const filtered = history.filter(h => {
    const isOverdue = h.status === 'overdue' || (h.status === 'pending' && h.due_date && h.due_date < todayStr)
    const isPending = h.status === 'pending' && (!h.due_date || h.due_date >= todayStr)
    const isCompleted = h.status === 'completed'

    let matchStatus = true
    if (statusFilter === 'completed') matchStatus = isCompleted
    else if (statusFilter === 'pending') matchStatus = isPending
    else if (statusFilter === 'overdue') matchStatus = isOverdue

    const matchTraining = trainingFilter === 'all' || h.training_id === trainingFilter
    const matchDept = departmentFilter === 'all' || h.employees?.department_id === departmentFilter
    const matchEmp = employeeFilter === 'all' || h.employee_id === employeeFilter
    
    const searchLower = search.toLowerCase().trim()
    const matchSearch =
      !searchLower ||
      h.employees?.name?.toLowerCase().includes(searchLower) ||
      h.employees?.employee_code?.toLowerCase().includes(searchLower) ||
      h.employees?.email?.toLowerCase().includes(searchLower) ||
      h.employees?.departments?.name?.toLowerCase().includes(searchLower) ||
      h.trainings?.name?.toLowerCase().includes(searchLower) ||
      h.training_schedules?.trainer_name?.toLowerCase().includes(searchLower)

    const matchDateFrom = !dateFrom || (h.training_schedules?.scheduled_date >= dateFrom)
    const matchDateTo = !dateTo || (h.training_schedules?.scheduled_date <= dateTo)
    return matchStatus && matchTraining && matchDept && matchEmp && matchSearch && matchDateFrom && matchDateTo
  })

  const exportColumns = [
    { key: 'employees', label: 'Employee Name', formatter: (v: unknown) => (v as Employee)?.name || '' },
    { key: 'employees', label: 'Employee Code', formatter: (v: unknown) => (v as Employee)?.employee_code || '' },
    { key: 'employees', label: 'Department', formatter: (v: unknown) => (v as Employee & { departments: Department })?.departments?.name || '' },
    { key: 'trainings', label: 'Training Program', formatter: (v: unknown) => (v as Training)?.name || '' },
    { key: 'training_schedules', label: 'Scheduled Date', formatter: (v: unknown) => formatDate((v as { scheduled_date: string })?.scheduled_date) },
    { key: 'status', label: 'Status', formatter: (v: unknown) => String(v || '').toUpperCase() },
    { key: 'completed_on', label: 'Completed On', formatter: (v: unknown) => formatDate(v as string) },
    { key: 'due_date', label: 'Due Date', formatter: (v: unknown) => formatDate(v as string) },
  ]

  const handleExportExcel = (data: HistoryWithRelations[], filename: string) => {
    exportToExcel(data as unknown as Record<string, unknown>[], exportColumns, filename)
  }

  const handleExportCsv = (data: HistoryWithRelations[], filename: string) => {
    exportToCsv(data as unknown as Record<string, unknown>[], exportColumns, filename)
  }

  const handleExportPdf = (data: HistoryWithRelations[]) => {
    const counts = {
      completed: data.filter(h => h.status === 'completed').length,
      pending: data.filter(h => h.status === 'pending' && (!h.due_date || h.due_date >= todayStr)).length,
      overdue: data.filter(h => h.status === 'overdue' || (h.status === 'pending' && h.due_date && h.due_date < todayStr)).length,
    }

    exportComplianceReportPdf({
      records: data.map(h => ({
        employeeName: h.employees?.name || 'N/A',
        employeeCode: h.employees?.employee_code || 'N/A',
        department: h.employees?.departments?.name || 'N/A',
        trainingName: h.trainings?.name || 'N/A',
        scheduledDate: h.training_schedules?.scheduled_date || '',
        status: h.status,
        completedOn: h.completed_on,
        dueDate: h.due_date,
      })),
      filterSummary: `Status: ${statusFilter} | Dept: ${departmentFilter !== 'all' ? departments.find(d => d.id === departmentFilter)?.name : 'All'} | Training: ${trainingFilter !== 'all' ? trainings.find(t => t.id === trainingFilter)?.name : 'All'}`,
      counts,
    })
  }

  const completedCount = filtered.filter(h => h.status === 'completed').length
  const pendingCount = filtered.filter(h => h.status === 'pending' && (!h.due_date || h.due_date >= todayStr)).length
  const overdueCount = filtered.filter(h => h.status === 'overdue' || (h.status === 'pending' && h.due_date && h.due_date < todayStr)).length

  const handlePrint = () => {
    // Generate clean printable HTML document in a dedicated hidden iframe
    const printFrame = document.createElement('iframe')
    printFrame.style.position = 'fixed'
    printFrame.style.right = '0'
    printFrame.style.bottom = '0'
    printFrame.style.width = '0'
    printFrame.style.height = '0'
    printFrame.style.border = '0'
    document.body.appendChild(printFrame)

    const doc = printFrame.contentWindow?.document
    if (!doc) {
      window.print()
      return
    }

    const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const activeDeptName = departmentFilter !== 'all' ? departments.find(d => d.id === departmentFilter)?.name || 'All' : 'All'
    const activeTrainName = trainingFilter !== 'all' ? trainings.find(t => t.id === trainingFilter)?.name || 'All' : 'All'

    const rowsHtml = filtered
      .map(
        (h, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
          <td style="padding: 6px 8px; font-weight: 500; font-family: monospace; font-size: 11px;">${h.employees?.employee_code || '—'}</td>
          <td style="padding: 6px 8px; font-weight: 600; color: #0f172a;">${h.employees?.name || '—'}</td>
          <td style="padding: 6px 8px; color: #475569;">${h.employees?.departments?.name || '—'}</td>
          <td style="padding: 6px 8px; color: #1e293b;">${h.trainings?.name || '—'}</td>
          <td style="padding: 6px 8px; white-space: nowrap;">${formatDate(h.training_schedules?.scheduled_date)}</td>
          <td style="padding: 6px 8px; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; ${
              h.status === 'completed'
                ? 'background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;'
                : h.status === 'overdue' || (h.status === 'pending' && h.due_date && h.due_date < todayStr)
                ? 'background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca;'
                : 'background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a;'
            }">
              ${h.status}
            </span>
          </td>
          <td style="padding: 6px 8px; color: #64748b; white-space: nowrap;">${formatDate(h.completed_on)}</td>
          <td style="padding: 6px 8px; color: #64748b; white-space: nowrap;">${formatDate(h.due_date)}</td>
        </tr>
      `
      )
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>FluidControl — Training Compliance Report</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #0f172a; margin: 0; padding: 15px; }
            .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px; }
            .company { font-size: 18px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; }
            .title { font-size: 13px; font-weight: 600; color: #475569; margin-top: 2px; }
            .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f1f5f9; padding: 10px; border-radius: 6px; margin-top: 10px; font-size: 11px; }
            .meta-item strong { color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
            th { background: #1e3a8a; color: white; text-align: left; padding: 7px 8px; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; page-break-inside: avoid; }
            .sig-box { width: 180px; border-top: 1px dashed #94a3b8; text-align: center; padding-top: 4px; margin-top: 25px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div class="company">FLUIDCONTROL PRIVATE LIMITED</div>
                <div class="title">Employee Training Compliance & Audit Report</div>
              </div>
              <div style="text-align: right; font-size: 11px; color: #64748b;">
                <div><strong>Date:</strong> ${todayFormatted}</div>
                <div><strong>Status:</strong> ${statusFilter.toUpperCase()}</div>
              </div>
            </div>
            <div class="meta-grid">
              <div class="meta-item"><strong>Department:</strong> ${activeDeptName}</div>
              <div class="meta-item"><strong>Training:</strong> ${activeTrainName}</div>
              <div class="meta-item"><strong>Total Records:</strong> ${filtered.length}</div>
              <div class="meta-item">
                <span style="color: #059669; font-weight: bold;">${completedCount} Completed</span> | 
                <span style="color: #d97706; font-weight: bold;">${pendingCount} Pending</span> | 
                <span style="color: #dc2626; font-weight: bold;">${overdueCount} Overdue</span>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Emp Code</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Training Program</th>
                <th>Scheduled Date</th>
                <th style="text-align: center;">Status</th>
                <th>Completed On</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px;">No training records found matching filters.</td></tr>'}
            </tbody>
          </table>

          <div class="footer" style="display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <p>FluidControl ETMS — Official Compliance Document</p>
              <p>Generated automatically by HR Management System</p>
            </div>
            <div style="display: flex; gap: 40px;">
              <div class="sig-box">HR Administrator Signature</div>
              <div class="sig-box">Authorized Trainer Signature</div>
            </div>
          </div>
        </body>
      </html>
    `

    doc.open()
    doc.write(html)
    doc.close()

    setTimeout(() => {
      printFrame.contentWindow?.focus()
      printFrame.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(printFrame)
      }, 1000)
    }, 250)
  }

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Training compliance, audit records & data exports</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExportExcel(filtered, 'FluidControl_Compliance_Report')}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportCsv(filtered, 'FluidControl_Compliance_Report')}>
            <Download className="h-4 w-4 text-blue-600 mr-1.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportPdf(filtered)}>
            <FileText className="h-4 w-4 text-rose-600 mr-1.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 text-slate-700 mr-1.5" /> Print
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="stat-card p-3 sm:p-5 text-center">
          <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500 mx-auto mb-1.5 sm:mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">{completedCount}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Completed</p>
        </div>
        <div className="stat-card p-3 sm:p-5 text-center">
          <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500 mx-auto mb-1.5 sm:mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Pending</p>
        </div>
        <div className="stat-card p-3 sm:p-5 text-center">
          <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 mx-auto mb-1.5 sm:mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-red-600">{overdueCount}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Overdue</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3.5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Training</Label>
              <Select value={trainingFilter} onValueChange={setTrainingFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trainings</SelectItem>
                  {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Department</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Employee</Label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by employee name, code (FC...), training, or dept…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs sm:text-sm"
              />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full sm:w-auto">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs flex-1 sm:w-36" />
              <span className="text-muted-foreground text-xs">to</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs flex-1 sm:w-36" />
            </div>
            <Button variant="outline" size="sm" className="h-8 w-full sm:w-auto" onClick={() => {
              setStatusFilter('all'); setTrainingFilter('all'); setDepartmentFilter('all')
              setEmployeeFilter('all'); setDateFrom(''); setDateTo(''); setSearch('')
            }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Report table */}
      <Card>
        <CardContent className="p-3.5 sm:p-6">
          {loading ? (
            <div className="flex justify-center py-16"><div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Filter className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium text-muted-foreground">No records match the current filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full -mx-3.5 sm:mx-0 px-3.5 sm:px-0">
              <table className="data-table min-w-[700px]">
                <thead>
                  <tr><th>Employee</th><th>Department</th><th>Training</th><th>Date</th><th>Status</th><th>Completed On</th><th>Due Date</th></tr>
                </thead>
                <tbody>
                  {filtered.map(h => (
                    <tr key={h.id}>
                      <td>
                        <button onClick={() => openEmpDrilldown(h.employees as unknown as Employee)} className="text-primary hover:underline font-medium flex items-center gap-1.5 whitespace-nowrap text-left">
                          {h.employees?.employee_code && (
                            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                              {h.employees.employee_code}
                            </Badge>
                          )}
                          <span>{h.employees?.name}</span>
                        </button>
                      </td>
                      <td className="text-muted-foreground text-xs whitespace-nowrap">{h.employees?.departments?.name}</td>
                      <td className="whitespace-nowrap">{h.trainings?.name}</td>
                      <td className="text-sm whitespace-nowrap">{formatDate(h.training_schedules?.scheduled_date)}</td>
                      <td><span className={`status-badge ${getStatusColor(h.status)}`}>{h.status}</span></td>
                      <td className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(h.completed_on)}</td>
                      <td className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(h.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4 pt-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground">Showing {filtered.length} matching records</p>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Button size="sm" variant="outline" className="flex-1 sm:flex-initial" onClick={() => handleExportExcel(filtered, 'FluidControl_Filtered_Compliance')}>
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 mr-1" /> Excel
                </Button>
                <Button size="sm" variant="outline" className="flex-1 sm:flex-initial" onClick={() => handleExportCsv(filtered, 'FluidControl_Filtered_Compliance')}>
                  <Download className="h-3.5 w-3.5 text-blue-600 mr-1" /> CSV
                </Button>
                <Button size="sm" variant="outline" className="flex-1 sm:flex-initial" onClick={() => handleExportPdf(filtered)}>
                  <FileText className="h-3.5 w-3.5 text-rose-600 mr-1" /> PDF
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee drill-down dialog */}
      <Dialog open={empDialog} onOpenChange={setEmpDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Training Record — {selectedEmployee?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="mb-4 p-3.5 bg-muted/50 rounded-lg border border-border/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                <div><span className="text-muted-foreground font-medium">Employee Code:</span> <span className="font-semibold">{selectedEmployee.employee_code}</span></div>
                <div><span className="text-muted-foreground font-medium">Email:</span> {selectedEmployee.email}</div>
                <div><span className="text-muted-foreground font-medium">Designation:</span> {selectedEmployee.designation}</div>
                <div><span className="text-muted-foreground font-medium">Department:</span> {selectedEmployee.departments?.name}</div>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
            <Button size="sm" variant="outline" onClick={() => handleExportExcel(empHistory, `FluidControl_Record_${selectedEmployee?.employee_code}`)}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 mr-1" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExportCsv(empHistory, `FluidControl_Record_${selectedEmployee?.employee_code}`)}>
              <Download className="h-3.5 w-3.5 text-blue-600 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              if (selectedEmployee) {
                exportEmployeeHistoryPdf({
                  employee: {
                    name: selectedEmployee.name,
                    code: selectedEmployee.employee_code,
                    email: selectedEmployee.email,
                    department: selectedEmployee.departments?.name || '',
                    designation: selectedEmployee.designation,
                  },
                  history: empHistory.map(h => ({
                    trainingName: h.trainings?.name || '',
                    date: h.training_schedules?.scheduled_date || '',
                    status: h.status,
                    completedOn: h.completed_on,
                  })),
                })
              }
            }}>
              <FileText className="h-3.5 w-3.5 text-rose-600 mr-1" /> PDF Record
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Training</th><th>Date</th><th>Status</th><th>Completed On</th></tr></thead>
              <tbody>
                {empHistory.map(h => (
                  <tr key={h.id}>
                    <td className="font-medium">{h.trainings?.name}</td>
                    <td>{formatDate(h.training_schedules?.scheduled_date)}</td>
                  <td><span className={`status-badge ${getStatusColor(h.status)}`}>{h.status}</span></td>
                  <td className="text-muted-foreground">{formatDate(h.completed_on)}</td>
                </tr>
              ))}
              {empHistory.length === 0 && (
                <tr><td colSpan={4} className="text-center text-muted-foreground py-8">No training history found</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
