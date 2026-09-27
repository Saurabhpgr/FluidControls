import * as XLSX from 'xlsx'

export interface ExportColumn {
  key: string
  label: string
  formatter?: (value: unknown) => string
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  sheetName = 'Sheet1'
) {
  const rows = data.map(item =>
    Object.fromEntries(
      columns.map(col => [
        col.label,
        col.formatter ? col.formatter(item[col.key]) : (item[col.key] ?? '')
      ])
    )
  )

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportRawToExcel(data: unknown[][], headers: string[], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Generates and downloads an Excel template for importing employees.
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
    { wch: 16 }, // Employee Code
    { wch: 22 }, // Name
    { wch: 34 }, // Email
    { wch: 26 }, // Department
    { wch: 26 }, // Designation
    { wch: 12 }, // Status
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')
  XLSX.writeFile(wb, 'employee_import_template.xlsx')
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
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
        resolve(jsonData)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = error => reject(error)
    reader.readAsArrayBuffer(file)
  })
}

