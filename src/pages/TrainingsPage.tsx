import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Power, Search, BookOpen, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { exportToExcel } from '@/lib/excel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { getFrequencyLabel } from '@/lib/utils'
import { toast } from 'sonner'
import type { Training, TrainingFrequency } from '@/types'

const FREQUENCIES: { value: TrainingFrequency; label: string }[] = [
  { value: 'one_time', label: 'One Time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'as_required', label: 'As Required' },
]

interface FormData {
  name: string
  description: string
  frequency: TrainingFrequency
  is_active: boolean
}

const defaultForm: FormData = { name: '', description: '', frequency: 'yearly', is_active: true }

export default function TrainingsPage() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Training | null>(null)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadTrainings() }, [])

  const loadTrainings = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('trainings').select('*').order('created_at', { ascending: false })
    if (error) toast.error('Failed to load trainings')
    else setTrainings(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (t: Training) => {
    setEditing(t)
    setForm({ name: t.name, description: t.description || '', frequency: t.frequency as TrainingFrequency, is_active: t.is_active })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Training name is required'); return }
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('trainings').update(form).eq('id', editing.id)
        if (error) throw error
        await logAudit({ action: 'training_updated', entity_type: 'training', entity_id: editing.id, details: { name: form.name } })
        toast.success('Training updated successfully')
      } else {
        const { data, error } = await supabase.from('trainings').insert(form).select().single()
        if (error) throw error
        await logAudit({ action: 'training_created', entity_type: 'training', entity_id: data.id, details: { name: form.name } })
        toast.success('Training created successfully')
      }
      setDialogOpen(false)
      loadTrainings()
    } catch (e) {
      toast.error('Failed to save training')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (t: Training) => {
    const { error } = await supabase.from('trainings').update({ is_active: !t.is_active }).eq('id', t.id)
    if (error) { toast.error('Failed to update status'); return }
    await logAudit({ action: t.is_active ? 'training_deactivated' : 'training_activated', entity_type: 'training', entity_id: t.id })
    toast.success(`Training ${t.is_active ? 'deactivated' : 'activated'}`)
    loadTrainings()
  }

  const handleExport = () => {
    exportToExcel(
      filtered,
      [
        { key: 'name', label: 'Training Name' },
        { key: 'description', label: 'Description' },
        { key: 'frequency', label: 'Frequency', formatter: v => getFrequencyLabel(v as string) },
        { key: 'is_active', label: 'Status', formatter: v => v ? 'Active' : 'Inactive' },
        { key: 'created_at', label: 'Created At' },
      ],
      'trainings_export'
    )
  }

  const filtered = trainings.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Training Master</h1>
          <p className="page-subtitle">{trainings.filter(t => t.is_active).length} active training programs</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add New Training
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search trainings…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium text-muted-foreground">No trainings found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Create your first training program to get started</p>
              <Button className="mt-4" size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add Training</Button>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Training Name</th>
                    <th>Description</th>
                    <th>Frequency</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium whitespace-nowrap">{t.name}</span>
                        </div>
                      </td>
                      <td className="text-muted-foreground max-w-xs truncate">{t.description || '—'}</td>
                      <td>
                        <Badge variant="info">{getFrequencyLabel(t.frequency)}</Badge>
                      </td>
                      <td>
                        <Badge variant={t.is_active ? 'success' : 'secondary'}>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleActive(t)} title={t.is_active ? 'Deactivate' : 'Activate'}>
                            <Power className={`h-4 w-4 ${t.is_active ? 'text-red-500' : 'text-emerald-500'}`} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Training' : 'Add New Training'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Training Name <span className="text-red-500">*</span></Label>
              <Input id="t-name" placeholder="e.g. Cyber Security Awareness" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-desc">Description</Label>
              <Textarea id="t-desc" placeholder="Brief description of this training program..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-freq">Frequency <span className="text-red-500">*</span></Label>
              <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v as TrainingFrequency }))}>
                <SelectTrigger id="t-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div className="flex items-center gap-3">
                <Switch id="t-active" checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label htmlFor="t-active">Active</Label>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Training'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
