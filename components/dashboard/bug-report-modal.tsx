'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, Send, X, Bug, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { submitBugReport } from '@/actions/bug-reports'

interface BugReportModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor sube una imagen válida')
      return
    }

    // Validar tamaño máximo (20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('La imagen no debe exceder 20MB')
      return
    }

    setPhoto(file)

    // Crear preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('El título es requerido')
      return
    }

    setIsSubmitting(true)

    try {
      // Si hay foto, enviarla primero por separado
      if (photo) {
        const fileName = `${Date.now()}_${photo.name}`
        
        // Crear FormData para la subida de archivo
        const uploadFormData = new FormData()
        uploadFormData.append('file', photo)
        
        // Hacer upload directo sin pasar por server action
        const uploadResponse = await fetch('/api/upload-bug-photo', {
          method: 'POST',
          body: uploadFormData,
        })

        if (!uploadResponse.ok) {
          throw new Error('Error al subir la foto')
        }

        const { photoUrl } = await uploadResponse.json()

        // Enviar reporte sin la foto (ya está subida)
        const result = await submitBugReport({
          title: title.trim(),
          description: description.trim() || undefined,
          photoUrl: photoUrl,
        })

        if (result.success) {
          toast.success('Bug reportado exitosamente')
          handleClose()
        } else {
          toast.error(result.error)
        }
      } else {
        // Sin foto, enviar solo datos
        const result = await submitBugReport({
          title: title.trim(),
          description: description.trim() || undefined,
        })

        if (result.success) {
          toast.success('Bug reportado exitosamente')
          handleClose()
        } else {
          toast.error(result.error)
        }
      }
    } catch (error) {
      toast.error('Error al enviar el reporte')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setTitle('')
    setDescription('')
    setPhoto(null)
    setPhotoPreview('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-red-500" />
            Reportar un bug
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="bug-title" className="text-sm font-medium">
              Título del problema
            </Label>
            <Input
              id="bug-title"
              placeholder="ej: El botón de salvar no funciona"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="bug-description" className="text-sm font-medium">
              Descripción (opcional)
            </Label>
            <Textarea
              id="bug-description"
              placeholder="Describe qué sucedió exactamente..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Upload de foto */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Foto del problema (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />

            {photoPreview ? (
              <div className="relative w-full rounded-lg overflow-hidden border-2 border-primary/20 bg-muted/30">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-40 object-cover"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-1 right-1 h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-950"
                  onClick={() => {
                    setPhoto(null)
                    setPhotoPreview('')
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                <Upload className="h-4 w-4" />
                Seleccionar imagen
              </Button>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar reporte
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
