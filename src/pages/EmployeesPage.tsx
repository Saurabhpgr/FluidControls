import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Pencil,
  Search,
  Users,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Power,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  X,
  Info,
  UserCheck,
  UserPlus,
  Lock
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { exportToExcel, exportToCsv, downloadEmployeeTemplate, downloadEmployeeCsvTemplate, parseExcelFile } from '@/lib/excel'
import { exportEmployeeDirectoryPdf } from '@/lib/pdf'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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
  isExisting?: boolean
}

const defaultEmpForm: EmpForm = {
  employee_code: '',
  name: '',
  email: '',
  department_id: '',
  designation: '',
  is_active: true,
}

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
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadAll()
  }, [])

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

  const openEmpCreate = () => {
    setEditingEmp(null)
    setEmpForm(defaultEmpForm)
    setEmpDialog(true)
  }

  const openEmpEdit = (emp: Employee) => {
    setEditingEmp(emp)
    setEmpForm({
      employee_code: emp.employee_code,
      name: emp.name,
      email: emp.email,
      department_id: emp.department_id,
      designation: emp.designation,
      is_active: emp.is_active,
    })
    setEmpDialog(true)
  }

  const handleSaveEmp = async () => {
    if (!empForm.name.trim() || !empForm.email.trim() || !empForm.department_id || !empForm.designation.trim()) {
      toast.error('All fields marked with * are required')
      return
    }

    if (!empForm.email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setSaving(true)
    try {
      if (editingEmp) {
        // Employee Code is strictly immutable: omit from update payload
        const updatePayload = {
          name: empForm.name.trim(),
          email: empForm.email.trim(),
          department_id: empForm.department_id,
          designation: empForm.designation.trim(),
          is_active: empForm.is_active,
        }
        const { error } = await supabase.from('employees').update(updatePayload).eq('id', editingEmp.id)
        if (error) throw error
        await logAudit({ action: 'employee_updated', entity_type: 'employee', entity_id: editingEmp.id, details: { name: empForm.name, code: editingEmp.employee_code } })
        toast.success('Employee updated successfully')
      } else {
        // New Employee: let database sequence generate the unique code if not provided
        const insertPayload: Record<string, unknown> = {
          name: empForm.name.trim(),
          email: empForm.email.trim(),
          department_id: empForm.department_id,
          designation: empForm.designation.trim(),
          is_active: empForm.is_active,
        }
        if (empForm.employee_code.trim()) {
          insertPayload.employee_code = empForm.employee_code.trim().toUpperCase()
        }
        const { data, error } = await supabase.from('employees').insert(insertPayload).select().single()
        if (error) throw error
        await logAudit({ action: 'employee_created', entity_type: 'employee', entity_id: data.id, details: { name: empForm.name, code: data.employee_code } })
        toast.success(`Employee added successfully (${data.employee_code})`)
      }
      setEmpDialog(false)
      loadAll()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save employee'
      toast.error(msg.includes('duplicate') || msg.includes('unique') || msg.includes('employee_code') ? 'Employee code collision or mutation rejected' : msg)
    } finally {
      setSaving(false)
    }
  }

  const toggleEmpActive = async (emp: Employee) => {
    const { error } = await supabase.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id)
    if (error) {
      toast.error('Failed to update status')
      return
    }
    toast.success(`Employee ${emp.is_active ? 'deactivated (code retained)' : 'activated'}`)
    loadAll()
  }

  const openDeptCreate = () => {
    setEditingDept(null)
    setDeptForm(defaultDeptForm)
    setDeptDialog(true)
  }

  const openDeptEdit = (d: Department) => {
    setEditingDept(d)
    setDeptForm({ name: d.name })
    setDeptDialog(true)
  }

  const handleSaveDept = async () => {
    if (!deptForm.name.trim()) {
      toast.error('Department name is required')
      return
    }
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

  // --- EXPORT HANDLERS ---
  const exportColumns = [
    { key: 'employee_code', label: 'Employee Code' },
    { key: 'name', label: 'Full Name' },
    { key: 'email', label: 'Email Address' },
    { key: 'departments', label: 'Department', formatter: (v: unknown) => (v as { name: string })?.name || '' },
    { key: 'designation', label: 'Designation' },
    { key: 'is_active', label: 'Status', formatter: (v: unknown) => (v ? 'Active' : 'Inactive') },
  ]

  const handleExportExcel = () => {
    exportToExcel(
      filteredEmp as unknown as Record<string, unknown>[],
      exportColumns,
      'FluidControl_Employees_Master'
    )
    toast.success('Exported employees to Excel')
  }

  const handleExportCsv = () => {
    exportToCsv(
      filteredEmp as unknown as Record<string, unknown>[],
      exportColumns,
      'FluidControl_Employees_Master'
    )
    toast.success('Exported employees to CSV')
  }

  const handleExportPdf = () => {
    exportEmployeeDirectoryPdf({
      employees: filteredEmp.map(e => ({
        code: e.employee_code,
        name: e.name,
        email: e.email,
        department: e.departments?.name || '—',
        designation: e.designation,
        status: e.is_active ? 'Active' : 'Inactive',
      })),
      filterSummary: deptFilter !== 'all' ? `Department: ${departments.find(d => d.id === deptFilter)?.name}` : 'All Departments',
    })
    toast.success('Generated Employee Directory PDF')
  }

  // --- TEMPLATE DOWNLOAD HANDLERS ---
  const handleDownloadExcelTemplate = () => {
    const deptNames = departments.length > 0 ? departments.map(d => d.name) : ['Information Technology', 'Operations', 'Finance']
    downloadEmployeeTemplate(deptNames)
    toast.success('Excel import template downloaded')
  }

  const handleDownloadCsvTemplate = () => {
    const deptNames = departments.length > 0 ? departments.map(d => d.name) : ['Information Technology', 'Operations', 'Finance']
    downloadEmployeeCsvTemplate(deptNames)
    toast.success('CSV import template downloaded')
  }

  // --- IMPORT FILE PROCESSING ---
  const processUploadedFile = async (file: File) => {
    setImportFile(file)
    try {
      const rawData = await parseExcelFile(file)
      if (rawData.length === 0) {
        toast.error('The selected file contains no data rows')
        setParsedRows([])
        return
      }

      // Existing employee codes in DB for fast lookup (all active + inactive/retired)
      const existingCodeMap = new Set(employees.map(e => e.employee_code.trim().toUpperCase()))
      const fileCodeOccurrences = new Map<string, number>()

      // First pass: count code occurrences within file
      rawData.forEach(row => {
        for (const [k, v] of Object.entries(row)) {
          const lk = k.toLowerCase().replace(/[^a-z]/g, '')
          if (lk === 'employeecode' || lk === 'empcode' || lk === 'code' || lk === 'empid' || lk === 'id') {
            const code = String(v).trim().toUpperCase()
            if (code) {
              fileCodeOccurrences.set(code, (fileCodeOccurrences.get(code) || 0) + 1)
            }
          }
        }
      })

      // Second pass: map and validate rows
      const mapped: ParsedEmployeeRow[] = rawData.map(row => {
        const getVal = (...keys: string[]) => {
          for (const key of keys) {
            const cleanTarget = key.toLowerCase().replace(/[^a-z]/g, '')
            for (const [k, v] of Object.entries(row)) {
              const cleanKey = k.toLowerCase().replace(/[^a-z]/g, '')
              if (cleanKey === cleanTarget) {
                return String(v).trim()
              }
            }
          }
          return ''
        }

        const rawCode = getVal('Employee Code', 'EmployeeCode', 'Emp Code', 'Code', 'Emp ID', 'ID', 'Staff ID')
        const code = rawCode.toUpperCase()
        const name = getVal('Name', 'Employee Name', 'Full Name', 'Emp Name', 'Staff Name')
        const email = getVal('Email', 'Email Address', 'EmailAddress', 'Mail', 'E-mail')
        const departmentName = getVal('Department', 'Dept', 'Department Name', 'Team')
        const designation = getVal('Designation', 'Role', 'Title', 'Job Title', 'Position')
        const statusVal = getVal('Status', 'Active Status', 'State', 'Is Active').toLowerCase()
        const status: 'Active' | 'Inactive' =
          statusVal === 'inactive' || statusVal === 'false' || statusVal === '0' || statusVal === 'no'
            ? 'Inactive'
            : 'Active'

        let valid = true
        let error = ''

        if (code) {
          if (!/^FC[0-9A-Za-z_-]{2,}$/.test(code)) {
            valid = false
            error = 'Invalid Code format (must start with FC, e.g. FC101)'
          } else if ((fileCodeOccurrences.get(code) || 0) > 1) {
            valid = false
            error = `Duplicate code '${code}' in import file`
          } else if (existingCodeMap.has(code)) {
            valid = false
            error = `Code '${code}' is already assigned to an existing/retired employee (immutable)`
          }
        }

        if (valid) {
          if (!name) {
            valid = false
            error = 'Missing Name'
          } else if (!email || !email.includes('@')) {
            valid = false
            error = 'Invalid Email'
          } else if (!departmentName) {
            valid = false
            error = 'Missing Department'
          } else if (!designation) {
            valid = false
            error = 'Missing Designation'
          }
        }

        return { code: code || '(Auto-generated)', name, email, departmentName, designation, status, valid, error, isExisting: false }
      })

      setParsedRows(mapped)
      const validCount = mapped.filter(r => r.valid).length
      toast.info(`Parsed ${mapped.length} rows (${validCount} valid) from ${file.name}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to parse file. Please ensure it is a valid .xlsx, .xls, or .csv file.')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processUploadedFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processUploadedFile(file)
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

      // Populate existing departments
      departments.forEach(d => deptMap.set(d.name.toLowerCase().trim(), d.id))

      // Create missing departments automatically
      for (const deptName of uniqueDeptNames) {
        const cleanName = deptName.trim()
        if (!deptMap.has(cleanName.toLowerCase())) {
          const { data: newDept, error: deptErr } = await supabase
            .from('departments')
            .insert({ name: cleanName })
            .select()
            .single()
          if (!deptErr && newDept) {
            deptMap.set(cleanName.toLowerCase(), newDept.id)
          }
        }
      }

      // 2. Prepare employee payload for insert
      const employeesToInsert = validRows.map(r => {
        const rowData: Record<string, unknown> = {
          name: r.name,
          email: r.email,
          department_id: deptMap.get(r.departmentName.toLowerCase().trim()) || departments[0]?.id,
          designation: r.designation,
          is_active: r.status === 'Active',
        }
        if (r.code && r.code !== '(Auto-generated)') {
          rowData.employee_code = r.code
        }
        return rowData
      })

      // Insert into Supabase (database sequence auto-generates if employee_code is omitted)
      const { error: insertErr } = await supabase
        .from('employees')
        .insert(employeesToInsert)

      if (insertErr) throw insertErr

      await logAudit({
        action: 'employees_imported',
        entity_type: 'employee',
        details: { count: validRows.length, file: importFile?.name },
      })

      toast.success(`Import complete! ${validRows.length} new employees created.`)
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
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      e.designation.toLowerCase().includes(search.toLowerCase())
    const matchDept = deptFilter === 'all' || e.department_id === deptFilter
    return matchSearch && matchDept
  })

  const validRowsCount = parsedRows.filter(r => r.valid).length
  const newRowsCount = parsedRows.filter(r => r.valid && !r.isExisting).length
  const updateRowsCount = parsedRows.filter(r => r.valid && r.isExisting).length
  const errorRowsCount = parsedRows.filter(r => !r.valid).length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Employees & Groups</h1>
          <p className="page-subtitle">
            {employees.filter(e => e.is_active).length} active employees across {departments.length} departments
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Template Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-100 h-9">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 mr-1.5" />
                Template
                <ChevronDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Import Templates</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleDownloadExcelTemplate}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 mr-2" />
                Excel Template (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadCsvTemplate}>
                <FileText className="h-4 w-4 text-blue-600 mr-2" />
                CSV Template (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Import Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialog(true)}
            className="border-slate-300 hover:bg-slate-100 h-9"
          >
            <Upload className="h-4 w-4 text-blue-600 mr-1.5" /> Import
          </Button>

          {/* Export Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-100 h-9">
                <Download className="h-4 w-4 text-slate-700 mr-1.5" />
                Export
                <ChevronDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Export Employees ({filteredEmp.length})</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 mr-2" />
                Export to Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv}>
                <Download className="h-4 w-4 text-blue-600 mr-2" />
                Export to CSV (.csv)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="h-4 w-4 text-rose-600 mr-2" />
                Export Directory PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Employee Button */}
          <Button size="sm" onClick={openEmpCreate} className="h-9">
            <Plus className="h-4 w-4 mr-1" /> Add Employee
          </Button>
        </div>
      </div>

      <Tabs defaultValue="employees">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardContent className="p-3.5 sm:p-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 sm:mb-6">
                <div className="relative flex-1 w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code, name, email, designation…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-full sm:w-48 h-9">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments ({employees.length})</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({employees.filter(e => e.department_id === d.id).length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {search || deptFilter !== 'all' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setDeptFilter('all')
                    }}
                    className="h-9 text-xs"
                  >
                    Clear Filters
                  </Button>
                ) : null}
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                </div>
              ) : filteredEmp.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-slate-700">No employees found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    {search || deptFilter !== 'all'
                      ? 'Try adjusting your search query or department filter.'
                      : 'Get started by adding your first employee or importing a spreadsheet.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full -mx-3.5 sm:mx-0 px-3.5 sm:px-0">
                  <table className="data-table min-w-[700px]">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Designation</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmp.map(emp => (
                        <tr key={emp.id}>
                          <td>
                            <Badge variant="outline" className="font-mono text-xs">
                              {emp.employee_code}
                            </Badge>
                          </td>
                          <td className="font-medium whitespace-nowrap">{emp.name}</td>
                          <td className="text-muted-foreground whitespace-nowrap text-xs">{emp.email}</td>
                          <td className="whitespace-nowrap">{emp.departments?.name || '—'}</td>
                          <td className="whitespace-nowrap">{emp.designation}</td>
                          <td>
                            <Badge variant={emp.is_active ? 'success' : 'secondary'} className="text-xs">
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:text-primary"
                                onClick={() => openEmpEdit(emp)}
                                title="Edit Employee"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => toggleEmpActive(emp)}
                                title={emp.is_active ? 'Deactivate Employee' : 'Activate Employee'}
                              >
                                <Power className={`h-4 w-4 ${emp.is_active ? 'text-red-500' : 'text-emerald-500'}`} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredEmp.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-4 pt-4 border-t text-xs text-muted-foreground">
                  <p>
                    Showing {filteredEmp.length} of {employees.length} employees
                  </p>
                  <p>
                    {filteredEmp.filter(e => e.is_active).length} Active, {filteredEmp.filter(e => !e.is_active).length} Inactive
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Departments</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Manage organizational units and team structures</p>
              </div>
              <Button size="sm" onClick={openDeptCreate} className="h-9">
                <Plus className="h-4 w-4 mr-1" /> Add Department
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Department Name</th>
                      <th>Employees</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map(d => (
                      <tr key={d.id}>
                        <td className="font-medium">{d.name}</td>
                        <td className="text-xs text-muted-foreground">
                          {employees.filter(e => e.department_id === d.id && e.is_active).length} active staff
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDeptEdit(d)}
                            title="Edit Department Name"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              Import Employees from Spreadsheet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template Download Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
              <div className="flex items-start gap-2.5">
                <Info className="h-5 w-5 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-emerald-950">Standard Import Format</p>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Columns: <strong>Employee Code</strong>, <strong>Name</strong>, <strong>Email</strong>, <strong>Department</strong>, <strong>Designation</strong>, <strong>Status</strong>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs h-8 flex-1 sm:flex-none"
                  onClick={handleDownloadExcelTemplate}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs h-8 flex-1 sm:flex-none"
                  onClick={handleDownloadCsvTemplate}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" /> CSV (.csv)
                </Button>
              </div>
            </div>

            {/* File Upload Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-primary bg-primary/5 scale-[0.99]'
                  : 'border-slate-300 hover:border-primary/60 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
              />
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-800">
                {importFile ? importFile.name : 'Click or drag & drop spreadsheet here'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</p>
            </div>

            {/* Parsed Rows Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Preview Data ({parsedRows.length} total rows)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {newRowsCount > 0 && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <UserPlus className="h-3 w-3 mr-1" /> {newRowsCount} New
                      </Badge>
                    )}
                    {updateRowsCount > 0 && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <UserCheck className="h-3 w-3 mr-1" /> {updateRowsCount} Updates
                      </Badge>
                    )}
                    {errorRowsCount > 0 && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" /> {errorRowsCount} Errors
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="border rounded-xl max-h-60 overflow-y-auto">
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
                        <tr key={idx} className={!row.valid ? 'bg-red-50/50' : row.isExisting ? 'bg-blue-50/20' : ''}>
                          <td>
                            {row.valid ? (
                              <span
                                className={`inline-flex items-center gap-1 font-medium text-[11px] ${
                                  row.isExisting ? 'text-blue-600' : 'text-emerald-600'
                                }`}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                {row.isExisting ? 'Update' : 'New'}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-red-600 font-medium text-[11px]"
                                title={row.error}
                              >
                                <AlertCircle className="h-3.5 w-3.5" /> {row.error}
                              </span>
                            )}
                          </td>
                          <td className="font-mono font-medium">{row.code || '—'}</td>
                          <td className="font-medium">{row.name || '—'}</td>
                          <td className="text-muted-foreground">{row.email || '—'}</td>
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

          <DialogFooter className="gap-2 mt-4 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setImportDialog(false)
                setImportFile(null)
                setParsedRows([])
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleExecuteImport} disabled={importing || validRowsCount === 0}>
              {importing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Importing…
                </>
              ) : (
                `Import ${validRowsCount} Employees`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Add/Edit Dialog */}
      <Dialog open={empDialog} onOpenChange={setEmpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmp ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">Employee Code</Label>
                  <Badge variant="outline" className={`text-[10px] ${editingEmp ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {editingEmp ? 'Immutable' : 'Auto-Generated'}
                  </Badge>
                </div>
                <div className="relative">
                  <Input
                    disabled
                    readOnly
                    value={editingEmp ? empForm.employee_code : 'Auto-generated on Save (e.g. FC101)'}
                    className={`font-mono text-xs cursor-not-allowed ${
                      editingEmp
                        ? 'bg-slate-100 font-semibold text-slate-900 border-slate-300'
                        : 'bg-slate-50 text-muted-foreground border-dashed'
                    }`}
                  />
                  <Lock className={`absolute right-2.5 top-2.5 h-4 w-4 ${editingEmp ? 'text-amber-600' : 'text-slate-400'}`} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {editingEmp
                    ? 'Unique identifier permanently locked across all modules.'
                    : 'Generated automatically by database sequence on creation.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  placeholder="e.g. Vikram Malhotra"
                  value={empForm.name}
                  onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="name@fluidcontrol.com"
                value={empForm.email}
                onChange={e => setEmpForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department *</Label>
                <Select value={empForm.department_id} onValueChange={v => setEmpForm(f => ({ ...f, department_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dept" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Designation *</Label>
                <Input
                  placeholder="e.g. Senior Engineer"
                  value={empForm.designation}
                  onChange={e => setEmpForm(f => ({ ...f, designation: e.target.value }))}
                />
              </div>
            </div>
            {editingEmp && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border">
                <div>
                  <Label htmlFor="emp-active" className="font-medium cursor-pointer">
                    Employment Status
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {empForm.is_active ? 'Active employee (eligible for training schedules)' : 'Deactivated employee'}
                  </p>
                </div>
                <Switch
                  id="emp-active"
                  checked={empForm.is_active}
                  onCheckedChange={v => setEmpForm(f => ({ ...f, is_active: v }))}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEmpDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEmp} disabled={saving}>
              {saving ? 'Saving…' : editingEmp ? 'Save Changes' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department Dialog */}
      <Dialog open={deptDialog} onOpenChange={setDeptDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'Add Department'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Department Name *</Label>
            <Input
              placeholder="e.g. Operations"
              value={deptForm.name}
              onChange={e => setDeptForm({ name: e.target.value })}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeptDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDept} disabled={saving}>
              {saving ? 'Saving…' : editingDept ? 'Save' : 'Add Department'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
