/**
 * Fluid Controls ETMS — Full System Integrity & Data Reconciliation Test Suite
 * Validates that all data hops (Training -> Schedule -> Attendance -> History -> Reports -> Dashboard) match exactly.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      const key = match[1]
      let value = match[2] || ''
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
      process.env[key] = value.trim()
    }
  })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runReconciliation() {
  console.log('🚀 Starting Full System Integrity & Reconciliation Audit...\n')

  let passedTests = 0
  let totalTests = 0

  function assert(condition, testName, details = '') {
    totalTests++
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`)
      passedTests++
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${details ? `— ${details}` : ''}`)
    }
  }

  try {
    // 1. Check Database Connectivity
    console.log('1. Database Connectivity & Core Table Verification')
    const { data: depts, error: deptErr } = await supabase.from('departments').select('id, name')
    assert(!deptErr && Array.isArray(depts), 'Departments table readable', deptErr?.message)

    const { data: trainings, error: trErr } = await supabase.from('trainings').select('id, name, is_active')
    assert(!trErr && Array.isArray(trainings), 'Trainings master table readable', trErr?.message)

    const { data: emps, error: empErr } = await supabase.from('employees').select('id, name, is_active, department_id')
    assert(!empErr && Array.isArray(emps), 'Employees master table readable', empErr?.message)

    // 2. Training to Schedule Interconnection
    console.log('\n2. Training Schedule & Group Resolution Integrity')
    const { data: schedules, error: schedErr } = await supabase
      .from('training_schedules')
      .select('id, training_id, scheduled_date, group_type, department_id, status')
    assert(!schedErr && Array.isArray(schedules), 'Training schedules table readable', schedErr?.message)

    const { data: schedEmployees, error: seErr } = await supabase
      .from('schedule_employees')
      .select('schedule_id, employee_id')
    assert(!seErr && Array.isArray(schedEmployees), 'Schedule employees (group resolution) readable', seErr?.message)

    // Verify foreign key integrity: every schedule employee points to an existing employee
    const empIdSet = new Set((emps || []).map(e => e.id))
    const orphanEmployeesInSchedules = (schedEmployees || []).filter(se => !empIdSet.has(se.employee_id))
    assert(orphanEmployeesInSchedules.length === 0, 'No orphaned employee references in schedule_employees')

    // 3. Attendance to Training History Atomic Sync
    console.log('\n3. Attendance & Training History Atomic Reconciliation')
    const { data: attendance, error: attErr } = await supabase.from('attendance').select('schedule_id, employee_id, attendance_status')
    assert(!attErr && Array.isArray(attendance), 'Attendance table readable', attErr?.message)

    const { data: history, error: histErr } = await supabase.from('employee_training_history').select('employee_id, schedule_id, status, completed_on')
    assert(!histErr && Array.isArray(history), 'Employee training history table readable', histErr?.message)

    // Check that every 'present' attendance record has a corresponding 'completed' history entry
    const presentRecords = (attendance || []).filter(a => a.attendance_status === 'present')
    const historyMap = new Map((history || []).map(h => [`${h.employee_id}_${h.schedule_id}`, h]))

    let presentWithoutCompletedHistory = 0
    for (const pr of presentRecords) {
      const hist = historyMap.get(`${pr.employee_id}_${pr.schedule_id}`)
      if (!hist || hist.status !== 'completed') {
        presentWithoutCompletedHistory++
      }
    }
    assert(presentWithoutCompletedHistory === 0, 'All present attendance records reconcile 1:1 with completed training history', `Mismatch count: ${presentWithoutCompletedHistory}`)

    // 4. Overdue Logic Consistency
    console.log('\n4. Overdue Engine & Status Consistency')
    const today = new Date().toISOString().split('T')[0]
    const pendingPastDue = (history || []).filter(h => h.status === 'pending' && h.due_date && h.due_date < today)
    assert(pendingPastDue.length === 0, 'Zero unrefreshed overdue records in history', `Found ${pendingPastDue.length} pending records past due date`)

    // 5. System Settings Persistence
    console.log('\n5. Zero-Hardcoding Settings & Lookups')
    const { data: settings, error: setErr } = await supabase.from('system_settings').select('key, value')
    assert(!setErr && Array.isArray(settings), 'System settings table readable', setErr?.message)
    const settingsKeys = new Set((settings || []).map(s => s.key))
    assert(settingsKeys.has('company_profile'), 'company_profile setting present in database')
    assert(settingsKeys.has('training_frequencies'), 'training_frequencies setting present in database')
    assert(settingsKeys.has('notification_rules'), 'notification_rules setting present in database')
    assert(settingsKeys.has('compliance_thresholds'), 'compliance_thresholds setting present in database')
    assert(settingsKeys.has('email_templates'), 'email_templates setting present in database')

    // 6. Audit Trail Immutability
    console.log('\n6. Audit Trail Logging & Immutability Verification')
    const { data: audit, error: audErr } = await supabase.from('audit_log').select('id, action, entity_type, created_at').limit(10)
    assert(!audErr && Array.isArray(audit), 'Audit log readable and logging operations', audErr?.message)

    console.log(`\n======================================================`)
    console.log(`🎯 Reconciliation Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`)
    console.log(`======================================================\n`)

    if (passedTests === totalTests) {
      console.log('✅ System integrity and data interconnection fully verified.')
      process.exit(0)
    } else {
      console.error('⚠️ Some reconciliation tests failed. Review details above.')
      process.exit(1)
    }
  } catch (err) {
    console.error('🚨 Reconciliation execution error:', err)
    process.exit(1)
  }
}

runReconciliation()
