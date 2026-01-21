'use client'

import { useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { differenceInDays, format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DollarSign,
  AlertCircle,
  CalendarDays,
  Moon,
  CreditCard,
  MessageSquare,
  User,
  GripVertical
} from 'lucide-react'
import { ReservationContextMenu } from '../context-menu/reservation-context-menu'
import type { RackReserva, RackHabitacion } from '@/types/rack'

type Props = {
  reserva: RackReserva
  nights: number
  onClick: (id: string) => void
  onUpdate: () => void
  onResizeStart?: (reservaId: string) => void
  onResizeEnd?: (reservaId: string, newNights: number, newFechaSalida: string) => void
  // Funciones para actualizaciones optimistas
  updateHabitacionOptimistic?: (habitacionId: string, updates: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>) => void
  removeReservaOptimistic?: (reservaId: string) => void
}

export function ReservationBlock({ reserva, nights, onClick, onUpdate, updateHabitacionOptimistic, removeReservaOptimistic }: Props) {
  // Colores según estado
  const getStatusColor = (estado: string) => {
    if (estado === 'CHECKED_IN') return 'bg-green-500 border-green-600 hover:bg-green-600'
    if (estado === 'RESERVADA') return 'bg-blue-500 border-blue-600 hover:bg-blue-600'
    if (estado === 'CHECKED_OUT') return 'bg-gray-500 border-gray-600 hover:bg-gray-600'
    return 'bg-gray-500 border-gray-600 hover:bg-gray-600'
  }

  const huesped = reserva.huespedes
    ? `${reserva.huespedes.apellidos}` // Solo apellido para ahorrar espacio
    : 'Sin huésped'

  const huespedCompleto = reserva.huespedes
    ? `${reserva.huespedes.nombres} ${reserva.huespedes.apellidos}`
    : 'Sin huésped'

  // Calcular noches
  const totalNoches = differenceInDays(
    new Date(reserva.fecha_salida),
    new Date(reserva.fecha_entrada)
  )

  // Usar precio pactado directamente si existe, o calcular estimado
  // En este componente asumimos que el precio viene en total o diario
  // pero el cálculo más seguro es el que viene del backend o simple mult
  const totalEstimado = (reserva.precio_pactado || 0) * (totalNoches || 1)

  // Calcular estados financieros REALES
  const saldo = reserva.saldo_pendiente || 0
  const tieneDeuda = saldo > 0.5 // Tolerancia de 50 céntimos
  const estaPagado = !tieneDeuda
  const tieneObservaciones = reserva.notas && reserva.notas.length > 0

  // Helper para iniciales
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  // Construir tooltip moderno y visualmente integrado
  const tooltipContent = (
    <div className="w-[280px] p-0">
      {/* Header: Avatar y Nombre */}
      <div className="flex items-start gap-3 p-3 pb-3">
        <Avatar className="h-9 w-9 border ring-1 ring-background shadow-sm">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {reserva.huespedes ? getInitials(reserva.huespedes.nombres + ' ' + reserva.huespedes.apellidos) : '??'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 flex flex-col justify-center h-9">
          <p className="font-semibold text-sm truncate leading-none mb-1.5">
            {huespedCompleto}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
              {reserva.codigo_reserva}
            </span>
            <Badge
              variant={tieneDeuda ? "destructive" : "secondary"}
              className={cn("text-[10px] h-4 px-1.5 font-medium rounded-sm shadow-none", !tieneDeuda && "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600")}
            >
              {tieneDeuda ? "Pendiente" : "Pagado"}
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* Body: Datos clave con iconos */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 p-3 bg-muted/5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
            <CalendarDays className="w-3 h-3" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Llegada</span>
          </div>
          <p className="text-xs font-medium pl-4.5">{format(new Date(reserva.fecha_entrada), 'EEE d MMM', { locale: es })}</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
            <CalendarDays className="w-3 h-3" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Salida</span>
          </div>
          <p className="text-xs font-medium pl-4.5">{format(new Date(reserva.fecha_salida), 'EEE d MMM', { locale: es })}</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
            <Moon className="w-3 h-3" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Duración</span>
          </div>
          <p className="text-xs font-medium pl-4.5">{totalNoches} noches</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
            <CreditCard className="w-3 h-3" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Total</span>
          </div>
          <p className="text-xs font-medium pl-4.5">S/ {totalEstimado.toFixed(2)}</p>
        </div>
      </div>

      {/* Footer: Estado Financiero o Notas */}
      {(tieneDeuda || reserva.notas) && (
        <>
          <Separator />
          <div className="p-3 bg-muted/30 space-y-2.5">
            {tieneDeuda && (
              <div className="flex justify-between items-center text-xs px-1">
                <span className="text-muted-foreground font-medium">Saldo pendiente</span>
                <span className="font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded">S/ {saldo.toFixed(2)}</span>
              </div>
            )}

            {reserva.notas && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-background p-2 rounded border shadow-sm">
                <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />
                <span className="italic line-clamp-2 leading-relaxed">"{reserva.notas}"</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <ReservationContextMenu reserva={reserva} onUpdate={onUpdate} updateHabitacionOptimistic={updateHabitacionOptimistic} removeReservaOptimistic={removeReservaOptimistic}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'absolute inset-1 rounded-md border shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] z-10',
                'flex flex-col justify-between px-2.5 py-1.5 text-white',
                getStatusColor(reserva.estado)
              )}
              style={{
                width: `calc(${nights * 80}px - 8px)` // 80px por celda menos margins
              }}
              onClick={(e) => {
                e.stopPropagation()
                onClick(reserva.id)
              }}
              onContextMenu={(e) => {
                e.stopPropagation()
              }}
            >
              {/* Header: Badges de estado */}
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs truncate">
                    {huesped}
                  </div>
                  <div className="text-[10px] opacity-75 truncate">
                    {totalNoches}N • {reserva.codigo_reserva}
                  </div>
                </div>
                <div className="flex gap-0.5 flex-shrink-0">
                  {tieneDeuda && (
                    <div className="w-4 h-4 rounded-full bg-red-600 border border-red-400 flex items-center justify-center shadow-sm animate-pulse" title={`Deuda: S/ ${saldo.toFixed(2)}`}>
                      <DollarSign className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {estaPagado && (
                    <div className="w-4 h-4 rounded-full bg-green-500 border border-green-400 flex items-center justify-center shadow-sm" title="Pagado">
                      <DollarSign className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {tieneObservaciones && (
                    <div className="w-4 h-4 rounded-full bg-yellow-500 border border-yellow-400 flex items-center justify-center shadow-sm" title="Tiene observaciones">
                      <AlertCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* Footer: Precio */}
              <div className="text-xs font-semibold flex justify-between items-end">
                <span>S/ {totalEstimado.toFixed(2)}</span>
                {tieneDeuda && (
                  <span className="text-[9px] bg-red-700 px-1 rounded text-white ml-1">Debe</span>
                )}
              </div>
            </div>
          </TooltipTrigger>
        </ReservationContextMenu>
        <TooltipContent
          side="top"
          className="bg-popover text-popover-foreground p-0 overflow-hidden shadow-xl border border-border/60"
          sideOffset={5}
        >
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
