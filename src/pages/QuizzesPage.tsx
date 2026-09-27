import React, { useState, useEffect } from 'react'
import { Plus, ExternalLink, Pencil, Trash2, FileQuestion } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import type { TrainingSchedule, Quiz } from '@/types'

export default function QuizzesPage() {
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [quizDialog, setQuizDialog] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [quizForm, setQuizForm] = useState({ title: '', form_link: '' })

  useEffect(() => { loadSchedules() }, [])
  useEffect(() => { if (selectedScheduleId) loadQuizzes(selectedScheduleId) }, [selectedScheduleId])

  const loadSchedules = async () => {
    const { data } = await supabase
      .from('training_schedules')
      .select('*, trainings(name)')
      .order('scheduled_date', { ascending: false })
    setSchedules((data || []) as unknown as TrainingSchedule[])
  }

  const loadQuizzes = async (scheduleId: string) => {
    setLoading(true)
    const { data } = await supabase.from('quizzes').select('*').eq('schedule_id', scheduleId)
    setQuizzes(data || [])
    setLoading(false)
  }

  const openCreateQuiz = () => {
    setEditingQuiz(null)
    setQuizForm({ title: '', form_link: '' })
    setQuizDialog(true)
  }

  const openEditQuiz = (q: Quiz) => {
    setEditingQuiz(q)
    setQuizForm({ title: q.title, form_link: q.form_link })
    setQuizDialog(true)
  }

  const handleSaveQuiz = async () => {
    if (!quizForm.title.trim() || !quizForm.form_link.trim() || !selectedScheduleId) {
      toast.error('Quiz title and Google Form link are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: quizForm.title.trim(),
        form_link: quizForm.form_link.trim(),
        schedule_id: selectedScheduleId,
      }
      if (editingQuiz) {
        const { error } = await supabase.from('quizzes').update(payload).eq('id', editingQuiz.id)
        if (error) throw error
        await logAudit({ action: 'quiz_updated', entity_type: 'quiz', entity_id: editingQuiz.id })
        toast.success('Quiz updated successfully')
      } else {
        const { data, error } = await supabase.from('quizzes').insert(payload).select().single()
        if (error) throw error
        await logAudit({ action: 'quiz_created', entity_type: 'quiz', entity_id: data.id })
        toast.success('Quiz created successfully')
      }
      setQuizDialog(false)
      loadQuizzes(selectedScheduleId)
    } catch (err) {
      console.error(err)
      toast.error('Failed to save quiz')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQuiz = async (quiz: Quiz) => {
    if (!confirm(`Delete "${quiz.title}"?`)) return
    try {
      const { error } = await supabase.from('quizzes').delete().eq('id', quiz.id)
      if (error) throw error
      toast.success('Quiz deleted')
      loadQuizzes(selectedScheduleId)
    } catch {
      toast.error('Failed to delete quiz')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quiz / Assessment Tracking</h1>
          <p className="page-subtitle">Attach Google Form quizzes to training sessions</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-md space-y-1.5">
            <Label>Select Training Session</Label>
            <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a session…" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {(s as unknown as { trainings: { name: string } }).trainings?.name} — {formatDate(s.scheduled_date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedScheduleId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle>Quizzes for this Session</CardTitle>
            <Button size="sm" onClick={openCreateQuiz}>
              <Plus className="h-4 w-4 mr-1" /> Add Quiz
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
              </div>
            ) : quizzes.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <FileQuestion className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No quizzes added yet</p>
                <Button className="mt-3" size="sm" onClick={openCreateQuiz}>
                  <Plus className="h-4 w-4 mr-1" /> Add Quiz
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {quizzes.map(q => (
                  <div key={q.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <FileQuestion className="h-5 w-5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{q.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{q.form_link}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild className="h-8 text-xs">
                        <a href={q.form_link} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Form
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => openEditQuiz(q)} title="Edit Quiz">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDeleteQuiz(q)} title="Delete Quiz">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quiz Create/Edit Dialog */}
      <Dialog open={quizDialog} onOpenChange={setQuizDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? 'Edit Quiz' : 'Add Quiz'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="quiz-title">Quiz Title *</Label>
              <Input
                id="quiz-title"
                placeholder="e.g. Cyber Security Assessment Q3"
                value={quizForm.title}
                onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiz-link">Google Form Link *</Label>
              <Input
                id="quiz-link"
                placeholder="https://docs.google.com/forms/d/..."
                value={quizForm.form_link}
                onChange={e => setQuizForm(f => ({ ...f, form_link: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setQuizDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuiz} disabled={saving}>
              {saving ? 'Saving…' : editingQuiz ? 'Save Changes' : 'Add Quiz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
