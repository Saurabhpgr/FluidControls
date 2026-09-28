import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  BookOpen, CalendarDays, Users, AlertTriangle, TrendingUp, 
  CheckCircle, Clock, Plus, ChevronRight, Activity
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, getStatusColor } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import type { TrainingSchedule } from '@/types'

interface Stats {
  totalTrainings: number
  totalEmployees: number
  scheduledThisQuarter: number
  completionRate: number
  overdueCount: number
  upcomingCount: number
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalTrainings: 0, totalEmployees: 0, scheduledThisQuarter: 0,
    completionRate: 0, overdueCount: 0, upcomingCount: 0
  })
  const [upcomingSchedules, setUpcomingSchedules] = useState<TrainingSchedule[]>([])
  const [completionTrend, setCompletionTrend] = useState<{ month: string; completed: number; pending: number }[]>([])
  const [deptCompliance, setDeptCompliance] = useState<{ name: string; rate: number }[]>([])
  const [trainingParticipation, setTrainingParticipation] = useState<{ name: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)
      const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const todayStr = now.toISOString().split('T')[0]

      const [
        { count: totalTrainings },
        { count: totalEmployees },
        { data: quarterSchedules },
        { data: historyData },
        { data: upcoming },
        { data: departments },
      ] = await Promise.all([
        supabase.from('trainings').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('training_schedules').select('status').gte('scheduled_date', quarterStart.toISOString().split('T')[0]).lte('scheduled_date', quarterEnd.toISOString().split('T')[0]),
        supabase.from('employee_training_history').select('status, completed_on, due_date, training_id'),
        supabase.from('training_schedules').select('*, trainings(name)').in('status', ['planned', 'ongoing']).gte('scheduled_date', todayStr).lte('scheduled_date', next7Days.toISOString().split('T')[0]).order('scheduled_date').limit(5),
        supabase.from('departments').select('id, name'),
      ])

      const completed = historyData?.filter(h => h.status === 'completed').length || 0
      const total = historyData?.length || 0
      const overdue = historyData?.filter(h => h.status === 'overdue' || (h.status === 'pending' && h.due_date && h.due_date < todayStr)).length || 0

      setStats({
        totalTrainings: totalTrainings || 0,
        totalEmployees: totalEmployees || 0,
        scheduledThisQuarter: quarterSchedules?.length || 0,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        overdueCount: overdue,
        upcomingCount: upcoming?.length || 0,
      })

      setUpcomingSchedules((upcoming || []) as unknown as TrainingSchedule[])

      // Build completion trend (last 6 months)
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const monthKey = d.toISOString().slice(0, 7)
        const monthLabel = d.toLocaleString('en', { month: 'short' })
        const monthCompleted = historyData?.filter(h => h.completed_on?.startsWith(monthKey)).length || 0
        const monthPending = historyData?.filter(h => h.status === 'pending' && h.due_date?.startsWith(monthKey)).length || 0
        months.push({ month: monthLabel, completed: monthCompleted, pending: monthPending })
      }
      setCompletionTrend(months)

      // Department compliance
      if (departments) {
        const deptData = await Promise.all(
          departments.map(async dept => {
            const { data: empIds } = await supabase.from('employees').select('id').eq('department_id', dept.id).eq('is_active', true)
            if (!empIds?.length) return { name: dept.name, rate: 0 }
            const ids = empIds.map(e => e.id)
            const { data: deptHistory } = await supabase.from('employee_training_history').select('status').in('employee_id', ids)
            const deptTotal = deptHistory?.length || 0
            const deptCompleted = deptHistory?.filter(h => h.status === 'completed').length || 0
            return { name: dept.name, rate: deptTotal > 0 ? Math.round((deptCompleted / deptTotal) * 100) : 0 }
          })
        )
        setDeptCompliance(deptData)
      }

      // Training participation
      const { data: allActiveTrainings } = await supabase.from('trainings').select('id, name').eq('is_active', true)
      if (allActiveTrainings && historyData) {
        const participation = allActiveTrainings.map(t => ({
          name: t.name,
          value: historyData.filter(h => (h as unknown as { training_id: string }).training_id === t.id).length,
        })).filter(t => t.value > 0)
        setTrainingParticipation(participation)
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'Active Trainings', value: stats.totalTrainings, icon: BookOpen, color: 'gradient-primary', link: '/trainings' },
    { label: 'Active Employees', value: stats.totalEmployees, icon: Users, color: 'bg-emerald-500', link: '/employees' },
    { label: 'Quarterly Sessions', value: stats.scheduledThisQuarter, icon: CalendarDays, color: 'bg-violet-500', link: '/schedules' },
    { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: TrendingUp, color: 'bg-amber-500', link: '/reports' },
    { label: 'Overdue Training', value: stats.overdueCount, icon: AlertTriangle, color: 'bg-red-500', link: '/reports' },
    { label: 'Upcoming (7 days)', value: stats.upcomingCount, icon: Clock, color: 'bg-sky-500', link: '/schedules' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-gradient">Dashboard</h1>
          <p className="page-subtitle">FluidControl Employee Training Management System</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Link to="/trainings"><Plus className="h-4 w-4" /> New Training</Link>
          </Button>
          <Button asChild size="sm" className="flex-1 sm:flex-none">
            <Link to="/schedules"><CalendarDays className="h-4 w-4" /> Schedule Training</Link>
          </Button>
        </div>
      </div>

      {/* Overdue alert banner */}
      {stats.overdueCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                {stats.overdueCount} overdue training record{stats.overdueCount !== 1 ? 's' : ''} require attention
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Employees have missed their training deadlines</p>
            </div>
          </div>
          <Button asChild variant="destructive" size="sm" className="w-full sm:w-auto flex-shrink-0">
            <Link to="/reports">View Overdue</Link>
          </Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        {statCards.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="stat-card p-3 sm:p-5 group">
            <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-xl ${color} flex items-center justify-center mb-2 sm:mb-3 shadow-md group-hover:scale-110 transition-transform`}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{value}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Completion trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Completion Trend (6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={completionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} name="Completed" />
                <Line type="monotone" dataKey="pending" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B' }} name="Pending" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Training participation pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Training Participation</CardTitle>
          </CardHeader>
          <CardContent>
            {trainingParticipation.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={trainingParticipation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={false}>
                    {trainingParticipation.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dept compliance + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department compliance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Department Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            {deptCompliance.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={deptCompliance} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => [`${v}%`, 'Compliance']} />
                  <Bar dataKey="rate" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Compliance %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming trainings */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming Trainings (7 days)</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/schedules" className="text-xs">View all <ChevronRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No trainings scheduled in the next 7 days</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSchedules.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{(s as unknown as { trainings: { name: string } }).trainings?.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(s.scheduled_date)}</p>
                    </div>
                    <span className={`status-badge ${getStatusColor(s.status)}`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
