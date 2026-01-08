'use client'

import { useState, useEffect } from 'react'
import { isToday, isSameDay, startOfDay, differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { GridCell } from './grid-cell'
import { ReservationBlock } from './reservation-block'
import { RoomContextMenu } from '../context-menu/room-context-menu'
import type { RackHabitacion, RackReserva } from '@/lib/actions/rack'

type Props = {
  habitacion: RackHabitacion
  days: Date[]
  reservas: RackReserva[]
  startDate: Date
  onReservationClick: (id: string) => void
  onNewReservation: (habitacion: RackHabitacion, fecha: Date, fechaFinal?: Date) => void
  onUpdate: () => void
  clearSelection?: boolean
}

export function RoomRow({ habitacion, days, reservas, startDate, onReservationClick, onNewReservation, onUpdate, clearSelection }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null)
  const [lastSelectedRange, setLastSelectedRange] = useState<{start: number, end: number} | null>(null)

  // Limpiar selección cuando se cierra el Sheet
  useEffect(() => {
    if (clearSelection) {
      setIsDragging(false)
      setDragStartIndex(null)
      setDragEndIndex(null)
      setLastSelectedRange(null)
    }
  }, [clearSelection])

  const getStatusBadge = (status: string) => {
    if (status === 'LIMPIA') return <Badge variant="secondary" className="bg-blue-500 text-white dark:bg-blue-600">LIMPIA</Badge>
    if (status === 'SUCIA') return <Badge variant="destructive">SUCIA</Badge>
    if (status === 'OCUPADA') return <Badge variant="secondary">OCUPADA</Badge>
    if (status === 'MANTENIMIENTO') return <Badge variant="outline">MANT.</Badge>
    return <Badge variant="outline">{status}</Badge>
  }

  // Calcular qué celdas están ocupadas por reservas
  const getReservationForCell = (dayIndex: number) => {
    const cellDay = startOfDay(days[dayIndex])
    
    for (const reserva of reservas) {
      const entrada = startOfDay(new Date(reserva.fecha_entrada))
      const salida = startOfDay(new Date(reserva.fecha_salida))
      
      // Verificar si este día es el primer día de la reserva
      if (isSameDay(cellDay, entrada)) {
        const nights = differenceInDays(salida, entrada)
        return { reserva, nights, isStart: true }
      }
      
      // Verificar si este día está ocupado por la reserva (pero no es el inicio)
      if (cellDay >= entrada && cellDay < salida) {
        return { reserva, nights: 0, isStart: false }
      }
    }
    
    return null
  }

  const handleMouseDown = (index: number) => {
    const reservation = getReservationForCell(index)
    if (reservation) return
    
    setIsDragging(true)
    setDragStartIndex(index)
    setDragEndIndex(index)
  }

  const handleMouseEnter = (index: number) => {
    if (!isDragging) return
    
    const reservation = getReservationForCell(index)
    if (reservation) return
    
    setDragEndIndex(index)
  }

  const handleMouseUp = () => {
    if (!isDragging || dragStartIndex === null || dragEndIndex === null) {
      setIsDragging(false)
      setDragStartIndex(null)
      setDragEndIndex(null)
      return
    }

    const startIdx = Math.min(dragStartIndex, dragEndIndex)
    const endIdx = Math.max(dragStartIndex, dragEndIndex)
    
    // Guardar rango para mantener visual feedback
    setLastSelectedRange({ start: startIdx, end: endIdx })
    setIsDragging(false)
    
    // Abrir diálogo con el rango completo de fechas
    const fechaInicio = days[startIdx]
    const fechaFin = endIdx > startIdx ? days[endIdx] : undefined
    onNewReservation(habitacion, fechaInicio, fechaFin)
  }

  const isCellSelected = (index: number) => {
    // Mostrar selección activa durante drag
    if (isDragging && dragStartIndex !== null && dragEndIndex !== null) {
      const start = Math.min(dragStartIndex, dragEndIndex)
      const end = Math.max(dragStartIndex, dragEndIndex)
      return index >= start && index <= end
    }
    // Mostrar selección "fantasma" después de soltar
    if (lastSelectedRange) {
      return index >= lastSelectedRange.start && index <= lastSelectedRange.end
    }
    return false
  }

  return (
<>
      {/* Room info cell (sticky) con menú contextual */}
      <RoomContextMenu habitacion={habitacion} onUpdate={onUpdate}>
        <div className="sticky left-0 z-10 border-b border-r bg-background p-2 cursor-context-menu">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{habitacion.numero}</div>
              <div className="text-xs text-muted-foreground">
                {habitacion.tipos_habitacion.nombre}
              </div>
            </div>
            <div className="text-xs">
              {getStatusBadge(habitacion.estado_limpieza)}
            </div>
          </div>
        </div>
      </RoomContextMenu>

      {/* Day cells */}
      {days.map((day, index) => {
        const reservation = getReservationForCell(index)
        
        return (
          <GridCell
            key={index}
            roomId={habitacion.id}
            day={day}
            isToday={isToday(day)}
            onReservationClick={onReservationClick}
            onCellClick={() => !reservation && onNewReservation(habitacion, day)}
            onMouseDown={() => handleMouseDown(index)}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseUp={handleMouseUp}
            isSelected={isCellSelected(index)}
          >
            {reservation?.isStart && (
              <ReservationBlock
                reserva={reservation.reserva}
                nights={reservation.nights}
                onClick={onReservationClick}
                onUpdate={onUpdate}
              />
            )}
          </GridCell>
        )
      })}
    </>
  )
}
