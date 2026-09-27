import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleString('en-IN', { 
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit' 
  })
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'planned': return 'badge-planned'
    case 'ongoing': return 'badge-ongoing'
    case 'completed': return 'badge-completed'
    case 'cancelled': return 'badge-cancelled'
    case 'overdue': return 'badge-overdue'
    case 'pending': return 'badge-pending'
    case 'present': return 'badge-completed'
    case 'absent': return 'badge-cancelled'
    case 'pass': return 'badge-completed'
    case 'fail': return 'badge-cancelled'
    case 'pending_review': return 'badge-pending'
    default: return 'badge-pending'
  }
}

export function getFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'one_time': return 'One Time'
    case 'monthly': return 'Monthly'
    case 'quarterly': return 'Quarterly'
    case 'half_yearly': return 'Half Yearly'
    case 'yearly': return 'Yearly'
    case 'as_required': return 'As Required'
    default: return frequency
  }
}

export function getCalendarEventColor(status: string): string {
  switch (status) {
    case 'planned': return '#3B82F6'
    case 'ongoing': return '#F59E0B'
    case 'completed': return '#10B981'
    case 'cancelled': return '#EF4444'
    default: return '#6B7280'
  }
}

export function addDaysToFrequency(date: Date, frequency: string): Date {
  const d = new Date(date)
  switch (frequency) {
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'half_yearly': d.setMonth(d.getMonth() + 6); break
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break
  }
  return d
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
