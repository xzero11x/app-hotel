'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, DollarSign, UserX, Clock } from 'lucide-react'
import { getAlertasRack } from '@/lib/actions/rack'
import { Skeleton } from '@/components/ui/skeleton'

type Alerta = {
  id: string
  type: 'deuda' | 'noshow' | 'checkout_atrasado'
  titulo: string
  subtitulo: string
  severity: 'high' | 'medium' | 'low'
}

export function AlertsTab() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarAlertas() {
      try {
        const data = await getAlertasRack()
        setAlertas(data)
      } catch (error) {
        console.error('Error al cargar alertas:', error)
      } finally {
        setLoading(false)
      }
    }
    cargarAlertas()
  }, [])

  const getIcon = (type: string) => {
    if (type === 'deuda') return <DollarSign className="h-4 w-4" />
    if (type === 'noshow') return <UserX className="h-4 w-4" />
    if (type === 'checkout_atrasado') return <Clock className="h-4 w-4" />
    return <AlertCircle className="h-4 w-4" />
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Alertas
        </CardTitle>
        <CardDescription>
          {alertas.length === 0
            ? 'No hay alertas'
            : `${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} requieren atención`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {alertas.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No hay alertas por el momento
          </div>
        ) : (
          alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  {alerta.severity === 'high' && (
                    <Badge variant="destructive" className="gap-1">
                      {getIcon(alerta.type)}
                      Alta
                    </Badge>
                  )}
                  {alerta.severity === 'medium' && (
                    <Badge variant="secondary" className="gap-1 bg-yellow-500 text-white">
                      {getIcon(alerta.type)}
                      Media
                    </Badge>
                  )}
                  {alerta.severity === 'low' && (
                    <Badge variant="outline" className="gap-1">
                      {getIcon(alerta.type)}
                      Baja
                    </Badge>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alerta.titulo}</p>
                  <p className="text-xs text-muted-foreground">{alerta.subtitulo}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
