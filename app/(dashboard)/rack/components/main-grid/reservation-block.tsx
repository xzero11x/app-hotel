'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { differenceInDays } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DollarSign, Receipt, AlertCircle, Users } from 'lucide-react'
import { ReservationContextMenu } from '../context-menu/reservation-context-menu'
import type { RackReserva } from '@/lib/actions/rack'

type Props = {
  reserva: RackReserva
  nights: number
  onClick: (id: string) => void
  onUpdate: () => void
}

export function ReservationBlock({ reserva, nights, onClick, onUpdate }: Props) {
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

  const totalEstimado = reserva.precio_pactado * totalNoches

  // Calcular estados financieros (mock por ahora, se puede mejorar con query real)
  const estaPagado = reserva.precio_pactado > 0 // Mock: considerar pagado si hay precio
  const tieneDeuda = !estaPagado
  const estaFacturado = false // Mock: en fase 2 se conecta con comprobantes
  const tieneObservaciones = reserva.notas && reserva.notas.length > 0

  // Construir tooltip rico con información completa
  const tooltipContent = (
    <div className="space-y-2 text-left min-w-[250px]">
      <div className="font-semibold border-b pb-1">
        {huespedCompleto}
      </div>
      <div className="space-y-1 text-xs">
        <p><span className="text-muted-foreground">Código:</span> {reserva.codigo_reserva}</p>
        <p><span className="text-muted-foreground">Entrada:</span> {format(new Date(reserva.fecha_entrada), 'dd MMM yyyy', { locale: es })}</p>
        <p><span className="text-muted-foreground">Salida:</span> {format(new Date(reserva.fecha_salida), 'dd MMM yyyy', { locale: es })}</p>
        <p><span className="text-muted-foreground">Noches:</span> {totalNoches}</p>
        <p><span className="text-muted-foreground">Total:</span> S/ {totalEstimado.toFixed(2)}</p>
        {reserva.notas && (
          <p className="pt-1 border-t"><span className="text-muted-foreground">Notas:</span> {reserva.notas}</p>
        )}
      </div>
    </div>
  )

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <ReservationContextMenu reserva={reserva} onUpdate={onUpdate}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'absolute inset-1 rounded border-2 cursor-pointer transition-colors z-10',
                'flex flex-col justify-between px-2 py-1 text-white shadow-sm',
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
                    <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center" title="Tiene deuda">
                      <DollarSign className="w-2.5 h-2.5" />
                    </div>
                  )}
                  {estaPagado && (
                    <div className="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center" title="Pagado">
                      <DollarSign className="w-2.5 h-2.5" />
                    </div>
                  )}
                  {estaFacturado && (
                    <div className="w-4 h-4 rounded-full bg-blue-400 flex items-center justify-center" title="Facturado">
                      <Receipt className="w-2.5 h-2.5" />
                    </div>
                  )}
                  {tieneObservaciones && (
                    <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center" title="Tiene observaciones">
                      <AlertCircle className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
              </div>

              {/* Footer: Precio */}
              <div className="text-xs font-semibold">
                S/ {totalEstimado.toFixed(2)}
              </div>
            </div>
          </TooltipTrigger>
        </ReservationContextMenu>
        <TooltipContent side="top" className="bg-gray-900 text-white border-gray-700">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
