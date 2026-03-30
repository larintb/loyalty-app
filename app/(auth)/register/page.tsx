'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { register } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FormError } from '@/components/ui/form-error'
import { MailCheck } from 'lucide-react'

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, null)

  if (state?.verifyEmail) {
    return (
      <Card>
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MailCheck className="h-7 w-7 text-primary" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold">Revisa tu correo</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Te enviamos un enlace de confirmación a
            </p>
            <p className="text-sm font-medium mt-0.5">{state.verifyEmail}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Abre el correo y haz clic en el enlace para activar tu cuenta.
            Después podrás iniciar sesión.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full mt-2">
              Ir a iniciar sesión
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea tu cuenta</CardTitle>
        <CardDescription>
          7 días gratis, sin tarjeta de crédito
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">Nombre del negocio</Label>
            <Input
              id="businessName"
              name="businessName"
              placeholder="Café El Rincón"
              required
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerName">Tu nombre</Label>
            <Input
              id="ownerName"
              name="ownerName"
              placeholder="Juan Pérez"
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="hola@micafe.mx"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {state?.error && <FormError message={state.error} />}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Creando cuenta...' : 'Crear cuenta gratis'}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Al registrarte aceptas nuestros{' '}
            <Link href="/terms" className="underline">
              Términos de uso
            </Link>
          </p>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?&nbsp;
        <Link
          href="/login"
          className="text-primary font-medium hover:underline"
        >
          Inicia sesión
        </Link>
      </CardFooter>
    </Card>
  )
}
