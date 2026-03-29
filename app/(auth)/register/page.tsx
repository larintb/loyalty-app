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

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea tu cuenta</CardTitle>
        <CardDescription>
          14 días gratis, sin tarjeta de crédito
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
