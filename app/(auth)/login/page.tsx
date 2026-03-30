'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { login } from '@/actions/auth'
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

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>
          Ingresa a tu cuenta para gestionar tu negocio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
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
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          {state?.error && <FormError message={state.error} />}
          {state?.verifyEmail && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
              <MailCheck className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Confirma tu correo antes de iniciar sesión.
                Revisa la bandeja de <strong>{state.verifyEmail}</strong>.
              </span>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        ¿No tienes cuenta?&nbsp;
        <Link
          href="/register"
          className="text-primary font-medium hover:underline"
        >
          Registra tu negocio
        </Link>
      </CardFooter>
    </Card>
  )
}
