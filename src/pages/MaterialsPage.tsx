import React, { useState, useEffect } from 'react'
import { Plus, FolderOpen, Trash2, ExternalLink, Upload, Download, Link } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import type { Training, TrainingMaterial, ResourceType } from '@/types'

const RESOURCE_ICONS: Record<ResourceType, React.ElementType> = {
  pdf: () => <span className="text-red-500 font-bold text-xs">PDF</span>,
  video: () => <span className="text-blue-500 font-bold text-xs">VID</span>,
  link: Link,
  doc: () => <span className="text-sky-500 font-bold text-xs">DOC</span>,
}

const RESOURCE_COLORS: Record<ResourceType, string> = {
  pdf: 'bg-red-100',
  video: 'bg-blue-100',
  link: 'bg-emerald-100',
  doc: 'bg-sky-100',
}

export default function MaterialsPage() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [materials, setMaterials] = useState<TrainingMaterial[]>([])
  const [selectedTrainingId, setSelectedTrainingId] = useState('')
  const [dialog, setDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ title: '', file_url: '', resource_type: 'pdf' as ResourceType })
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)

  useEffect(() => { loadTrainings() }, [])
  useEffect(() => { if (selectedTrainingId) loadMaterials(selectedTrainingId) }, [selectedTrainingId])

  const loadTrainings = async () => {
    const { data } = await supabase.from('trainings').select('*').eq('is_active', true).order('name')
    setTrainings(data || [])
  }

  const loadMaterials = async (trainingId: string) => {
    const { data } = await supabase.from('training_materials').select('*').eq('training_id', trainingId).order('uploaded_at', { ascending: false })
    setMaterials((data || []) as TrainingMaterial[])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileToUpload(file)
      const ext = file.name.split('.').pop()?.toLowerCase()
      const type: ResourceType = ext === 'pdf' ? 'pdf' : ext === 'mp4' || ext === 'mov' ? 'video' : 'doc'
      setForm(f => ({ ...f, resource_type: type, title: f.title || file.name }))
    }
  }

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return }
    if (!form.file_url && !fileToUpload && form.resource_type !== 'link') { toast.error('Please provide a file or URL'); return }
    if (form.resource_type === 'link' && !form.file_url) { toast.error('Please enter a URL'); return }

    setSaving(true)
    try {
      let fileUrl = form.file_url

      if (fileToUpload) {
        setUploading(true)
        const cleanName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${selectedTrainingId}/${Date.now()}_${cleanName}`
        
        const { error: uploadError } = await supabase.storage
          .from('training-materials')
          .upload(storagePath, fileToUpload, {
            cacheControl: '3600',
            upsert: true,
          })
        
        setUploading(false)

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          const msg = uploadError.message || 'Upload failed'
          if (msg.toLowerCase().includes('bucket') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('policy')) {
            toast.error(
              `Storage bucket 'training-materials' not configured in Supabase. Please run the Storage Bucket SQL in database_setup.sql or create bucket 'training-materials' in Supabase Dashboard.`,
              { duration: 8000 }
            )
          } else {
            toast.error(`Upload failed: ${msg}`)
          }
          return
        }

        const { data: urlData } = supabase.storage.from('training-materials').getPublicUrl(storagePath)
        fileUrl = urlData?.publicUrl || ''
      }

      if (!fileUrl) {
        toast.error('Could not determine file URL')
        return
      }

      const payload = { 
        training_id: selectedTrainingId, 
        title: form.title, 
        file_url: fileUrl, 
        resource_type: form.resource_type 
      }
      const { data, error } = await supabase.from('training_materials').insert(payload).select().single()
      if (error) {
        console.error('Insert error:', error)
        throw error
      }

      await logAudit({ 
        action: 'material_uploaded', 
        entity_type: 'training_material', 
        entity_id: data.id, 
        details: { title: form.title, resource_type: form.resource_type } 
      })
      toast.success('Material added successfully')
      setDialog(false)
      setFileToUpload(null)
      setForm({ title: '', file_url: '', resource_type: 'pdf' })
      loadMaterials(selectedTrainingId)
    } catch (e: unknown) {
      console.error(e)
      const err = e as { message?: string }
      toast.error(err?.message ? `Failed to save material: ${err.message}` : 'Failed to save material')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const handleDelete = async (m: TrainingMaterial) => {
    if (!confirm(`Delete "${m.title}"?`)) return
    const { error } = await supabase.from('training_materials').delete().eq('id', m.id)
    if (error) { toast.error('Failed to delete'); return }
    await logAudit({ action: 'material_deleted', entity_type: 'training_material', entity_id: m.id })
    toast.success('Material deleted')
    loadMaterials(selectedTrainingId)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Training Materials</h1>
          <p className="page-subtitle">Upload and manage training resources by training program</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-md space-y-1.5">
            <Label>Select Training Program</Label>
            <Select value={selectedTrainingId} onValueChange={setSelectedTrainingId}>
              <SelectTrigger><SelectValue placeholder="Choose a training…" /></SelectTrigger>
              <SelectContent>
                {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedTrainingId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle>Resources</CardTitle>
            <Button size="sm" onClick={() => setDialog(true)}><Plus className="h-4 w-4" /> Add Material</Button>
          </CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No materials uploaded yet</p>
                <Button className="mt-3" size="sm" onClick={() => setDialog(true)}><Plus className="h-4 w-4" /> Add Material</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {materials.map(m => {
                  const IconComp = RESOURCE_ICONS[m.resource_type as ResourceType] || FolderOpen
                  return (
                    <div key={m.id} className={`p-4 rounded-xl border ${RESOURCE_COLORS[m.resource_type as ResourceType] || 'bg-muted/30'} hover:shadow-md transition-shadow`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className={`h-10 w-10 rounded-lg ${RESOURCE_COLORS[m.resource_type as ResourceType]} border flex items-center justify-center`}>
                          <IconComp className="h-5 w-5" />
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(m)} className="h-7 w-7 text-muted-foreground hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="font-medium text-sm mb-1 line-clamp-2">{m.title}</p>
                      <Badge variant="outline" className="text-xs capitalize mb-3">{m.resource_type}</Badge>
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Open Resource
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Training Material</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Resource Type</Label>
              <Select value={form.resource_type} onValueChange={v => setForm(f => ({ ...f, resource_type: v as ResourceType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="link">External Link</SelectItem>
                  <SelectItem value="doc">Word/Doc</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input placeholder="e.g. Cyber Security Best Practices Guide" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            {form.resource_type === 'link' ? (
              <div className="space-y-1.5">
                <Label>URL *</Label>
                <Input placeholder="https://…" value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Upload File</Label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{fileToUpload ? fileToUpload.name : 'Click to upload file'}</span>
                    <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,.mp4,.mov,.ppt,.pptx" />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Or enter a direct URL below</p>
                <Input placeholder="https://… (optional if uploading file)" value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Add Material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
