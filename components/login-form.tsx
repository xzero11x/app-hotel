'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, type LoginState } from '@/lib/actions/auth'
import { Hotel } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="w-full h-11 text-base font-medium" disabled={pending}>
      {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
    </Button>
  )
}

export function LoginForm() {
  const router = useRouter()
  const [state, formAction] = useFormState<LoginState, FormData>(login, {} as LoginState)

  useEffect(() => {
    if (state?.success) {
      router.push('/')
      router.refresh()
    }
  }, [state?.success, router])

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-sm border-border/50 shadow-lg">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex items-center justify-center gap-2">
            <Hotel className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="text-xl sm:text-2xl font-semibold">Hotel App</span>
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <CardTitle className="text-2xl sm:text-3xl">Iniciar sesión</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Ingresa tu email y contraseña para acceder
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="usuario@example.com"
                required
                autoComplete="email"
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11 text-base"
              />
            </div>

            {state?.error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
