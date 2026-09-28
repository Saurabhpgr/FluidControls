import * as XLSX from 'xlsx'

export interface ExportColumn {
  key: string
  label: string
  formatter?: (value: unknown) => string
}

/**
 * Sanitizes cell values to prevent CSV / Excel Formula Injection (DDE attack vectors)
 * Cells starting with '=', '+', '-', '@', '\t', '\r' are prefixed with an apostrophe.
 */
export function sanitizeCellValue(val: unknown): unknown {
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (
      trimmed.startsWith('=') ||
      trimmed.startsWith('+') ||
      trimmed.startsWith('-') ||
      trimmed.startsWith('@') ||
      trimmed.startsWith('\t') ||
      trimmed.startsWith('\r')
    ) {
      return `'${val}`
    }
  }
  return val
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  sheetName = 'Sheet1'
) {
  const rows = data.map(item =>
    Object.fromEntries(
      columns.map(col => {
        const rawVal = col.formatter ? col.formatter(item[col.key]) : (item[col.key] ?? '')
        return [col.label, sanitizeCellValue(rawVal)]
      })
    )
  )

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportRawToExcel(data: unknown[][], headers: string[], filename: string) {
  const sanitizedData = data.map(row => row.map(sanitizeCellValue))
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sanitizedData])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Exports data as CSV with UTF-8 BOM for Microsoft Excel / Google Sheets compatibility
 */
export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
) {
  const headers = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',')
  const rows = data.map(item =>
    columns
      .map(col => {
        const raw = col.formatter ? col.formatter(item[col.key]) : (item[col.key] ?? '')
        const sanitized = String(sanitizeCellValue(raw)).replace(/"/g, '""')
        return `"${sanitized}"`
      })
      .join(',')
  )

  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generates and downloads an Excel template (.xlsx) for importing employees.
 * Includes an Employees sheet and an Instructions / Department reference sheet.
 */
export function downloadEmployeeTemplate(existingDepartments: string[] = ['Information Technology', 'Operations', 'Finance']) {
  const sampleData = [
    {
      'Employee Code': 'FC101',
      'Name': 'Vikram Malhotra',
      'Email': 'vikram.malhotra@fluidcontrol.com',
      'Department': existingDepartments[0] || 'Information Technology',
      'Designation': 'Senior System Engineer',
      'Status': 'Active',
    },
    {
      'Employee Code': 'FC102',
      'Name': 'Meera Sen',
      'Email': 'meera.sen@fluidcontrol.com',
      'Department': existingDepartments[1] || 'Operations',
      'Designation': 'Quality Inspector',
      'Status': 'Active',
    },
    {
      'Employee Code': 'FC103',
      'Name': 'Rohan Deshmukh',
      'Email': 'rohan.deshmukh@fluidcontrol.com',
      'Department': existingDepartments[2] || 'Finance',
      'Designation': 'Financial Analyst',
      'Status': 'Active',
    },
  ]

  const ws = XLSX.utils.json_to_sheet(sampleData)
  
  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, // Employee Code
    { wch: 24 }, // Name
    { wch: 36 }, // Email
    { wch: 28 }, // Department
    { wch: 28 }, // Designation
    { wch: 14 }, // Status
  ]

  // Instructions Sheet
  const instructionsData = [
    ['FluidControl ETMS — Employee Import Guide'],
    [''],
    ['Column', 'Required', 'Description', 'Example'],
    ['Employee Code', 'YES', 'Unique ID for the employee. Duplicate codes in DB will be updated.', 'FC101'],
    ['Name', 'YES', 'Full name of the employee.', 'Vikram Malhotra'],
    ['Email', 'YES', 'Valid corporate or personal email address.', 'vikram@fluidcontrol.com'],
    ['Department', 'YES', 'Department name. New departments will be created automatically.', existingDepartments[0] || 'Information Technology'],
    ['Designation', 'YES', 'Job title or role of the employee.', 'Senior Engineer'],
    ['Status', 'NO', 'Active or Inactive (defaults to Active if blank).', 'Active'],
    [''],
    ['Available Departments in System:'],
    ...existingDepartments.map(d => [d]),
  ]
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData)
  wsInstructions['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 45 }, { wch: 30 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions & Depts')
  XLSX.writeFile(wb, 'FluidControl_Employee_Import_Template.xlsx')
}

/**
 * Generates and downloads a CSV template for importing employees.
 */
export function downloadEmployeeCsvTemplate(existingDepartments: string[] = ['Information Technology', 'Operations', 'Finance']) {
  const headers = ['Employee Code', 'Name', 'Email', 'Department', 'Designation', 'Status']
  const rows = [
    ['FC101', 'Vikram Malhotra', 'vikram.malhotra@fluidcontrol.com', existingDepartments[0] || 'Information Technology', 'Senior System Engineer', 'Active'],
    ['FC102', 'Meera Sen', 'meera.sen@fluidcontrol.com', existingDepartments[1] || 'Operations', 'Quality Inspector', 'Active'],
    ['FC103', 'Rohan Deshmukh', 'rohan.deshmukh@fluidcontrol.com', existingDepartments[2] || 'Finance', 'Financial Analyst', 'Active'],
  ]

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', 'FluidControl_Employee_Import_Template.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Parses an uploaded Excel or CSV file into an array of JSON objects.
 */
export function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: false })
        
        // Normalize keys and filter out empty rows
        const cleaned = rawJson
          .map(row => {
            const normalizedRow: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(row)) {
              normalizedRow[k.trim()] = typeof v === 'string' ? v.trim() : v
            }
            return normalizedRow
          })
          .filter(row => {
            // Must have at least one non-empty value
            return Object.values(row).some(v => v !== '' && v !== null && v !== undefined)
          })

        resolve(cleaned)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = err => reject(err)
    reader.readAsArrayBuffer(file)
  })
}
