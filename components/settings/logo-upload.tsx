'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { getLogoUploadUrl, saveBusinessLogoUrl } from '@/actions/settings'

const MAX_SIZE = 25 * 1024 * 1024 // 25 MB
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

type Props = {
  currentUrl: string | null
  businessName: string
  businessId?: string
  onUploaded: (url: string) => void
  variant?: 'row' | 'centered'
}

export function LogoUpload({ currentUrl, businessName, onUploaded, variant = 'row' }: Props) {
  // preview holds the objectUrl during upload, then the public URL after success
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const initial = businessName.trim().charAt(0).toUpperCase()

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Formato no soportado. Usa JPG, PNG, WebP, GIF o SVG.')
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('La imagen no puede superar 25 MB.')
      return
    }

    // Mostrar preview local de inmediato
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)

    try {
      // 1. Pedir signed URL al servidor (admin — sin restricciones de RLS ni bucket)
      const urlResult = await getLogoUploadUrl(file.name)
      if (urlResult.error || !urlResult.signedUrl || !urlResult.publicUrl) {
        toast.error(urlResult.error ?? 'Error al preparar la subida.')
        setPreview(currentUrl) // revertir al logo anterior
        return
      }

      // 2. Subir directamente a Supabase con el signed URL — no pasa por Next.js
      const uploadRes = await fetch(urlResult.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        toast.error('Error al subir la imagen.')
        setPreview(currentUrl)
        return
      }

      // 3. Guardar URL pública en la DB (payload mínimo: un string)
      const freshUrl = `${urlResult.publicUrl}?v=${Date.now()}`
      const saveResult = await saveBusinessLogoUrl(freshUrl)
      if (saveResult.error) {
        toast.error(saveResult.error)
        setPreview(currentUrl)
        return
      }

      // Mantener el objectUrl en preview — ya se ve bien, evitamos un flash de red
      // El freshUrl se usa solo para persistencia
      onUploaded(freshUrl)
      toast.success('Logo actualizado.')
    } finally {
      setUploading(false)
      // No revocar aquí — el objectUrl sigue siendo el preview visible
    }
  }

  function openPicker() { inputRef.current?.click() }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleRemove() {
    setPreview(null)
    onUploaded('')
  }

  if (variant === 'centered') {
    return (
      <div className="flex flex-col items-center gap-3">
        <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={handleChange} />

        <button
          type="button"
          onClick={openPicker}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          disabled={uploading}
          className="relative group w-24 h-24 rounded-2xl border-2 border-dashed border-border hover:border-primary transition-colors overflow-hidden bg-muted/40 flex items-center justify-center"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-muted-foreground">{initial}</span>
          )}
          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {uploading
              ? <Loader2 className="h-6 w-6 text-white animate-spin" />
              : <ImagePlus className="h-6 w-6 text-white" />
            }
          </div>
        </button>

        <p className="text-xs text-muted-foreground">
          {uploading ? 'Subiendo...' : 'Logo del negocio (opcional) · Máx. 25 MB'}
        </p>
      </div>
    )
  }

  // variant === 'row'
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={handleChange} />

      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        className="relative group w-10 h-10 rounded-lg border border-border overflow-hidden bg-muted/40 flex items-center justify-center shrink-0 transition-colors hover:border-primary"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Logo" className="w-full h-full object-cover" />
        ) : (
          <span className="text-base font-bold text-muted-foreground">{initial}</span>
        )}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {uploading
            ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
            : <ImagePlus className="h-3.5 w-3.5 text-white" />
          }
        </div>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Logo</span>
          <span className="text-xs text-muted-foreground/60">(opcional · máx. 25 MB)</span>
        </div>
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="text-sm text-primary hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {uploading ? 'Subiendo...' : preview ? 'Cambiar logo' : 'Subir logo'}
        </button>
      </div>

      {preview && !uploading && (
        <button
          type="button"
          onClick={handleRemove}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          title="Quitar logo"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
