import React, { useState, useEffect } from 'react'
import { Download, Search, Filter, User, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { exportToExcel } from '@/lib/excel'
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
    const matchSearch = !search || 
      h.employees?.name?.toLowerCase().includes(search.toLowerCase()) ||
      h.trainings?.name?.toLowerCase().includes(search.toLowerCase())
    const matchDateFrom = !dateFrom || (h.training_schedules?.scheduled_date >= dateFrom)
    const matchDateTo = !dateTo || (h.training_schedules?.scheduled_date <= dateTo)
    return matchStatus && matchTraining && matchDept && matchEmp && matchSearch && matchDateFrom && matchDateTo
  })

  const handleExport = (data: HistoryWithRelations[], filename: string) => {
    exportToExcel(
      data as unknown as Record<string, unknown>[],
      [
        { key: 'employees', label: 'Employee', formatter: v => (v as Employee)?.name || '' },
        { key: 'employees', label: 'Dept', formatter: v => (v as Employee & { departments: Department })?.departments?.name || '' },
        { key: 'trainings', label: 'Training', formatter: v => (v as Training)?.name || '' },
        { key: 'training_schedules', label: 'Date', formatter: v => formatDate((v as { scheduled_date: string })?.scheduled_date) },
        { key: 'status', label: 'Status' },
        { key: 'completed_on', label: 'Completed On', formatter: v => formatDate(v as string) },
        { key: 'due_date', label: 'Due Date', formatter: v => formatDate(v as string) },
      ],
      filename
    )
  }

  const completedCount = filtered.filter(h => h.status === 'completed').length
  const pendingCount = filtered.filter(h => h.status === 'pending' && (!h.due_date || h.due_date >= todayStr)).length
  const overdueCount = filtered.filter(h => h.status === 'overdue' || (h.status === 'pending' && h.due_date && h.due_date < todayStr)).length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Training compliance and completion reports</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => handleExport(filtered, 'training_report')}>
          <Download className="h-4 w-4" /> Export All
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-emerald-600">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
        <div className="stat-card text-center">
          <TrendingUp className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="stat-card text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <div className="flex gap-2 items-center">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
              <span className="text-muted-foreground text-xs">to</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={() => {
              setStatusFilter('all'); setTrainingFilter('all'); setDepartmentFilter('all')
              setEmployeeFilter('all'); setDateFrom(''); setDateTo(''); setSearch('')
            }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Report table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-16"><div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Filter className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium text-muted-foreground">No records match the current filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="data-table">
                <thead>
                  <tr><th>Employee</th><th>Department</th><th>Training</th><th>Date</th><th>Status</th><th>Completed On</th><th>Due Date</th></tr>
                </thead>
                <tbody>
                  {filtered.map(h => (
                    <tr key={h.id}>
                      <td>
                        <button onClick={() => openEmpDrilldown(h.employees as unknown as Employee)} className="text-primary hover:underline font-medium flex items-center gap-1 whitespace-nowrap">
                          <User className="h-3.5 w-3.5" /> {h.employees?.name}
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
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Showing {filtered.length} records</p>
              <Button size="sm" variant="outline" onClick={() => handleExport(filtered, 'training_report_filtered')}>
                <Download className="h-4 w-4" /> Export Filtered
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee drill-down dialog */}
      <Dialog open={empDialog} onOpenChange={setEmpDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Training History — {selectedEmployee?.name}</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Code:</span> {selectedEmployee.employee_code}</div>
                <div><span className="text-muted-foreground">Email:</span> {selectedEmployee.email}</div>
                <div><span className="text-muted-foreground">Designation:</span> {selectedEmployee.designation}</div>
                <div><span className="text-muted-foreground">Department:</span> {selectedEmployee.departments?.name}</div>
              </div>
            </div>
          )}
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="outline" onClick={() => handleExport(empHistory, `history_${selectedEmployee?.name}`)}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
