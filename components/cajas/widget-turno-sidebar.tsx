'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { getReporteMetodosPago, type DetalleTurno } from '@/lib/actions/cajas'
import { getResumenMovimientos } from '@/lib/actions/movimientos'
import { CerrarCajaDialog } from '@/components/cajas/cerrar-caja-dialog'
import { RegistrarMovimientoDialog } from '@/components/cajas/registrar-movimiento-dialog'
import { Lock, RefreshCw, Wallet, Clock, CreditCard } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useSidebar } from '@/components/ui/sidebar'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

type Props = {
  turno: DetalleTurno
  onTurnoCerrado: () => void
}

export function WidgetTurnoSidebar({ turno, onTurnoCerrado }: Props) {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const [reportePagos, setReportePagos] = useState<any>(null)
  const [resumenMovimientos, setResumenMovimientos] = useState<any>(null)
  const [loadingMovimientos, setLoadingMovimientos] = useState(false)

  const t = turno.turno
  const stats = turno.estadisticas

  const cargarMovimientos = async () => {
    setLoadingMovimientos(true)
    const [resultPagos, resultResumen] = await Promise.all([
      getReporteMetodosPago(t.id),
      getResumenMovimientos(t.id)
    ])

    if (resultPagos.success) {
      setReportePagos(resultPagos.data)
    }
    if (resultResumen.success) {
      setResumenMovimientos(resultResumen.data)
    }
    setLoadingMovimientos(false)
  }

  useEffect(() => {
    cargarMovimientos()

    // Actualizar cada 60 segundos
    const interval = setInterval(cargarMovimientos, 60000)
    return () => clearInterval(interval)
  }, [t.id])

  const tiempoActivo = formatDistanceToNow(new Date(t.fecha_apertura), {
    locale: es,
    addSuffix: false
  })

  // NOTA: totalEfectivoPEN ya incluye la resta de egresos (modificado en getReporteMetodosPago)
  // Por lo tanto solo sumamos la apertura
  const saldoEfectivoReal =
    t.monto_apertura_efectivo +
    (reportePagos?.totalEfectivoPEN || 0)

  if (isCollapsed) {
    return (
      <div className="flex justify-center mb-2">
        <HoverCard openDelay={100} closeDelay={100}>
          <HoverCardTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 relative hover:bg-muted/50 transition-colors"
            >
              <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-green-500 ring-2 ring-background animate-pulse" />
              <Wallet className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Button>
          </HoverCardTrigger>
          <HoverCardContent side="right" align="start" className="w-80 p-0 overflow-hidden" sideOffset={10}>
            {/* Header */}
            <div className="bg-muted/30 p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-full">
                  <Wallet className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Caja Activa</span>
                  <span className="font-semibold text-sm">{t.caja_nombre}</span>
                </div>
              </div>
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </div>

            {/* Main Balance */}
            <div className="p-5 flex flex-col items-center justify-center space-y-1 bg-background">
              <span className="text-xs text-muted-foreground font-medium">Efectivo Disponible</span>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-medium text-muted-foreground">S/</span>
                <span className="text-4xl font-bold tracking-tight text-foreground">
                  {saldoEfectivoReal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 border-t bg-muted/5 divide-x">
              <div className="p-3 flex flex-col gap-1 items-center justify-center hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase">Ventas</span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  S/ {reportePagos?.totalGeneral?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-1 items-center justify-center hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase">Tiempo</span>
                </div>
                <span className="text-sm font-medium">
                  {tiempoActivo}
                </span>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>
    )
  }

  return (
    <div className="mx-2 mb-2 rounded-lg border bg-card p-3 shadow-sm">
      {/* Header - Turno Activo */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold">Caja Abierta</span>
        </div>
        <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 font-normal">
          {t.caja_nombre}
        </Badge>
      </div>

      {/* Montos principales */}
      {loadingMovimientos && !reportePagos ? (
        <div className="text-center text-[10px] text-muted-foreground py-4">
          <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" />
          Actualizando...
        </div>
      ) : reportePagos && (
        <div className="space-y-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Efectivo en Caja</span>
            <span className="text-xl font-bold tracking-tight">
              S/ {saldoEfectivoReal.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-muted/50 rounded p-2">
              <span className="text-[10px] text-muted-foreground block">Ventas Hoy</span>
              <span className="text-sm font-semibold block text-blue-600">
                S/ {reportePagos.totalGeneral.toFixed(2)}
              </span>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-[10px] text-muted-foreground block">Transacciones</span>
              <span className="text-sm font-semibold block">{reportePagos.pagos.length}</span>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground text-right">
            Abierto hace {tiempoActivo}
          </div>
        </div>
      )}

      <Separator className="my-3" />

      {/* Botones de acción - UNIFICADOS */}
      <div className="space-y-2">
        <div className="[&>button]:w-full">
          <RegistrarMovimientoDialog />
        </div>

        <CerrarCajaDialog
          turnoId={t.id}
          totalEsperadoPen={saldoEfectivoReal}
          totalEsperadoUsd={t.monto_apertura_usd || 0}
          customTrigger={
            <Button
              variant="default"
              size="sm"
              className="w-full h-8 text-xs"
            >
              <Lock className="h-3 w-3 mr-1.5" />
              Cerrar Turno
            </Button>
          }
        />
      </div>
    </div>
  )
}
