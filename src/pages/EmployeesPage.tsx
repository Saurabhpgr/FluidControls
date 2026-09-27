import React, { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Search, Users, Download, Upload, FileSpreadsheet, Power, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { exportToExcel, downloadEmployeeTemplate, parseExcelFile } from '@/lib/excel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { Employee, Department } from '@/types'

interface EmpForm {
  employee_code: string
  name: string
  email: string
  department_id: string
  designation: string
  is_active: boolean
}

interface DeptForm {
  name: string
}

interface ParsedEmployeeRow {
  code: string
  name: string
  email: string
  departmentName: string
  designation: string
  status: 'Active' | 'Inactive'
  valid: boolean
  error?: string
}

const defaultEmpForm: EmpForm = { employee_code: '', name: '', email: '', department_id: '', designation: '', is_active: true }
const defaultDeptForm: DeptForm = { name: '' }

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [empDialog, setEmpDialog] = useState(false)
  const [deptDialog, setDeptDialog] = useState(false)
  const [importDialog, setImportDialog] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [empForm, setEmpForm] = useState<EmpForm>(defaultEmpForm)
  const [deptForm, setDeptForm] = useState<DeptForm>(defaultDeptForm)
  const [saving, setSaving] = useState(false)

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: e }, { data: d }] = await Promise.all([
      supabase.from('employees').select('*, departments(name)').order('name'),
      supabase.from('departments').select('*').order('name'),
    ])
    setEmployees((e || []) as unknown as Employee[])
    setDepartments(d || [])
    setLoading(false)
  }

  const openEmpCreate = () => { setEditingEmp(null); setEmpForm(defaultEmpForm); setEmpDialog(true) }
  const openEmpEdit = (emp: Employee) => {
    setEditingEmp(emp)
    setEmpForm({ employee_code: emp.employee_code, name: emp.name, email: emp.email, department_id: emp.department_id, designation: emp.designation, is_active: emp.is_active })
    setEmpDialog(true)
  }

  const handleSaveEmp = async () => {
    if (!empForm.employee_code || !empForm.name || !empForm.email || !empForm.department_id || !empForm.designation) {
      toast.error('All fields are required'); return
    }
    setSaving(true)
    try {
      if (editingEmp) {
        const { error } = await supabase.from('employees').update(empForm).eq('id', editingEmp.id)
        if (error) throw error
        await logAudit({ action: 'employee_updated', entity_type: 'employee', entity_id: editingEmp.id, details: { name: empForm.name } })
        toast.success('Employee updated')
      } else {
        const { data, error } = await supabase.from('employees').insert(empForm).select().single()
        if (error) throw error
        await logAudit({ action: 'employee_created', entity_type: 'employee', entity_id: data.id, details: { name: empForm.name } })
        toast.success('Employee added')
      }
      setEmpDialog(false)
      loadAll()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save employee'
      toast.error(msg.includes('duplicate') ? 'Employee code already exists' : msg)
    } finally {
      setSaving(false)
    }
  }

  const toggleEmpActive = async (emp: Employee) => {
    const { error } = await supabase.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id)
    if (error) { toast.error('Failed to update status'); return }
    toast.success(`Employee ${emp.is_active ? 'deactivated' : 'activated'}`)
    loadAll()
  }

  const openDeptCreate = () => { setEditingDept(null); setDeptForm(defaultDeptForm); setDeptDialog(true) }
  const openDeptEdit = (d: Department) => { setEditingDept(d); setDeptForm({ name: d.name }); setDeptDialog(true) }

  const handleSaveDept = async () => {
    if (!deptForm.name.trim()) { toast.error('Department name required'); return }
    setSaving(true)
    try {
      if (editingDept) {
        const { error } = await supabase.from('departments').update(deptForm).eq('id', editingDept.id)
        if (error) throw error
        await logAudit({ action: 'department_updated', entity_type: 'department', entity_id: editingDept.id })
        toast.success('Department updated')
      } else {
        const { data, error } = await supabase.from('departments').insert(deptForm).select().single()
        if (error) throw error
        await logAudit({ action: 'department_created', entity_type: 'department', entity_id: data.id })
        toast.success('Department created')
      }
      setDeptDialog(false)
      loadAll()
    } catch {
      toast.error('Failed to save department')
    } finally {
      setSaving(false)
    }
  }

  const handleExportEmp = () => {
    exportToExcel(
      filteredEmp as unknown as Record<string, unknown>[],
      [
        { key: 'employee_code', label: 'Employee Code' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'departments', label: 'Department', formatter: v => (v as { name: string })?.name || '' },
        { key: 'designation', label: 'Designation' },
        { key: 'is_active', label: 'Status', formatter: v => (v ? 'Active' : 'Inactive') },
      ],
      'fluidcontrol_employees_export'
    )
    toast.success('Employees exported to Excel')
  }

  const handleDownloadTemplate = () => {
    const deptNames = departments.length > 0 ? departments.map(d => d.name) : ['Information Technology', 'Operations', 'Finance']
    downloadEmployeeTemplate(deptNames)
    toast.success('Excel template downloaded')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    try {
      const rawData = await parseExcelFile(file)
      if (rawData.length === 0) {
        toast.error('The selected Excel file is empty')
        setParsedRows([])
        return
      }

      // Map rows with flexible header normalization
      const mapped: ParsedEmployeeRow[] = rawData.map(row => {
        const getVal = (...keys: string[]) => {
          for (const key of keys) {
            for (const [k, v] of Object.entries(row)) {
              if (k.trim().toLowerCase() === key.toLowerCase()) {
                return String(v).trim()
              }
            }
          }
          return ''
        }

        const code = getVal('Employee Code', 'EmployeeCode', 'Emp Code', 'Code', 'Emp ID', 'ID')
        const name = getVal('Name', 'Employee Name', 'Full Name', 'Emp Name')
        const email = getVal('Email', 'Email Address', 'Mail')
        const departmentName = getVal('Department', 'Dept', 'Department Name')
        const designation = getVal('Designation', 'Role', 'Title', 'Job Title', 'Position')
        const statusVal = getVal('Status', 'Active Status', 'State').toLowerCase()
        const status: 'Active' | 'Inactive' = statusVal.includes('inact') ? 'Inactive' : 'Active'

        let valid = true
        let error = ''
        if (!code) { valid = false; error = 'Missing Employee Code' }
        else if (!name) { valid = false; error = 'Missing Name' }
        else if (!email || !email.includes('@')) { valid = false; error = 'Invalid Email' }
        else if (!departmentName) { valid = false; error = 'Missing Department' }
        else if (!designation) { valid = false; error = 'Missing Designation' }

        return { code, name, email, departmentName, designation, status, valid, error }
      })

      setParsedRows(mapped)
      toast.info(`Parsed ${mapped.length} rows from ${file.name}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to parse Excel file. Please ensure it matches the template.')
    }
  }

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r.valid)
    if (validRows.length === 0) {
      toast.error('No valid rows found to import')
      return
    }

    setImporting(true)
    try {
      // 1. Resolve / Create Departments
      const uniqueDeptNames = Array.from(new Set(validRows.map(r => r.departmentName)))
      const deptMap = new Map<string, string>()

      // Check against existing departments
      departments.forEach(d => deptMap.set(d.name.toLowerCase(), d.id))

      // Create missing departments automatically
      for (const deptName of uniqueDeptNames) {
        if (!deptMap.has(deptName.toLowerCase())) {
          const { data: newDept, error: deptErr } = await supabase
            .from('departments')
            .insert({ name: deptName })
            .select()
            .single()
          if (!deptErr && newDept) {
            deptMap.set(deptName.toLowerCase(), newDept.id)
          }
        }
      }

      // 2. Prepare employee payload for upsert
      const employeesToUpsert = validRows.map(r => ({
        employee_code: r.code,
        name: r.name,
        email: r.email,
        department_id: deptMap.get(r.departmentName.toLowerCase()) || departments[0]?.id,
        designation: r.designation,
        is_active: r.status === 'Active',
      }))

      // Upsert into Supabase
      const { error: upsertErr } = await supabase
        .from('employees')
        .upsert(employeesToUpsert, { onConflict: 'employee_code' })

      if (upsertErr) throw upsertErr

      await logAudit({
        action: 'employees_imported',
        entity_type: 'employee',
        details: { count: validRows.length, file: importFile?.name }
      })

      toast.success(`Successfully imported ${validRows.length} employees!`)
      setImportDialog(false)
      setImportFile(null)
      setParsedRows([])
      loadAll()
    } catch (err: unknown) {
      console.error('Import error:', err)
      const error = err as { message?: string }
      toast.error(error?.message || 'Failed to import employees')
    } finally {
      setImporting(false)
    }
  }

  const filteredEmp = employees.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
    const matchDept = deptFilter === 'all' || e.department_id === deptFilter
    return matchSearch && matchDept
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees & Groups</h1>
          <p className="page-subtitle">{employees.filter(e => e.is_active).length} active employees across {departments.length} departments</p>
        </div>
        {/* Top Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            title="Download Excel Template"
            className="border-slate-300 hover:bg-slate-100"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 mr-1.5" /> Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialog(true)}
            title="Import Employees from Excel"
            className="border-slate-300 hover:bg-slate-100"
          >
            <Upload className="h-4 w-4 text-blue-600 mr-1.5" /> Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportEmp}
            title="Export Employees to Excel"
            className="border-slate-300 hover:bg-slate-100"
          >
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button size="sm" onClick={openEmpCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add Employee
          </Button>
        </div>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex justify-center py-16"><div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" /></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Code</th><th>Name</th><th>Email</th><th>Department</th><th>Designation</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredEmp.map(emp => (
                      <tr key={emp.id}>
                        <td><Badge variant="outline">{emp.employee_code}</Badge></td>
                        <td className="font-medium">{emp.name}</td>
                        <td className="text-muted-foreground">{emp.email}</td>
                        <td>{emp.departments?.name || '—'}</td>
                        <td>{emp.designation}</td>
                        <td><Badge variant={emp.is_active ? 'success' : 'secondary'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge></td>
                        <td>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEmpEdit(emp)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => toggleEmpActive(emp)}>
                              <Power className={`h-4 w-4 ${emp.is_active ? 'text-red-500' : 'text-emerald-500'}`} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-4">
              <CardTitle>Departments</CardTitle>
              <Button size="sm" onClick={openDeptCreate}><Plus className="h-4 w-4" /> Add Department</Button>
            </CardHeader>
            <CardContent>
              <table className="data-table">
                <thead><tr><th>Department Name</th><th>Employees</th><th>Actions</th></tr></thead>
                <tbody>
                  {departments.map(d => (
                    <tr key={d.id}>
                      <td className="font-medium">{d.name}</td>
                      <td>{employees.filter(e => e.department_id === d.id && e.is_active).length} active</td>
                      <td><Button variant="ghost" size="icon" onClick={() => openDeptEdit(d)}><Pencil className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Employees Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Import Employees from Excel
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template Download Banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-900">Need the standard Excel format?</p>
                  <p className="text-[11px] text-emerald-700">Download our sample template with pre-filled columns.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs h-8"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Download Template
              </Button>
            </div>

            {/* File Upload Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
              />
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">
                {importFile ? importFile.name : 'Click or drag & drop Excel sheet here'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, and .csv files</p>
            </div>

            {/* Parsed Rows Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Preview Data ({parsedRows.filter(r => r.valid).length} valid, {parsedRows.filter(r => !r.valid).length} errors)
                  </span>
                  <Badge variant={parsedRows.every(r => r.valid) ? 'success' : 'secondary'} className="text-xs">
                    {parsedRows.filter(r => r.valid).length} / {parsedRows.length} Ready to Import
                  </Badge>
                </div>

                <div className="border rounded-xl max-h-56 overflow-y-auto">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Designation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className={!row.valid ? 'bg-red-50/50' : ''}>
                          <td>
                            {row.valid ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                                <CheckCircle className="h-3.5 w-3.5" /> Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-600 font-medium text-[11px]" title={row.error}>
                                <AlertCircle className="h-3.5 w-3.5" /> {row.error}
                              </span>
                            )}
                          </td>
                          <td className="font-mono">{row.code || '—'}</td>
                          <td className="font-medium">{row.name || '—'}</td>
                          <td>{row.email || '—'}</td>
                          <td>{row.departmentName || '—'}</td>
                          <td>{row.designation || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setImportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteImport}
              disabled={importing || parsedRows.filter(r => r.valid).length === 0}
            >
              {importing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Importing…
                </>
              ) : (
                `Import ${parsedRows.filter(r => r.valid).length} Employees`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Dialog */}
      <Dialog open={empDialog} onOpenChange={setEmpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingEmp ? 'Edit Employee' : 'Add Employee'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Employee Code *</Label>
                <Input placeholder="FC001" value={empForm.employee_code} onChange={e => setEmpForm(f => ({ ...f, employee_code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="Full name" value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" placeholder="email@company.com" value={empForm.email} onChange={e => setEmpForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Department *</Label>
                <Select value={empForm.department_id} onValueChange={v => setEmpForm(f => ({ ...f, department_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Designation *</Label>
                <Input placeholder="e.g. Engineer" value={empForm.designation} onChange={e => setEmpForm(f => ({ ...f, designation: e.target.value }))} />
              </div>
            </div>
            {editingEmp && (
              <div className="flex items-center gap-3">
                <Switch id="emp-active" checked={empForm.is_active} onCheckedChange={v => setEmpForm(f => ({ ...f, is_active: v }))} />
                <Label htmlFor="emp-active">Active</Label>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEmpDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEmp} disabled={saving}>{saving ? 'Saving…' : editingEmp ? 'Save' : 'Add Employee'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department Dialog */}
      <Dialog open={deptDialog} onOpenChange={setDeptDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingDept ? 'Edit Department' : 'Add Department'}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Department Name *</Label>
            <Input placeholder="e.g. Operations" value={deptForm.name} onChange={e => setDeptForm({ name: e.target.value })} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeptDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveDept} disabled={saving}>{saving ? 'Saving…' : editingDept ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
