'use client'

import { useState, useEffect } from 'react'
import { isToday, isSameDay, startOfDay, differenceInCalendarDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { GridCell } from './grid-cell'
import { ReservationBlock } from './reservation-block'
import { RoomContextMenu } from '../context-menu/room-context-menu'
import { getRoomVisualState } from '@/lib/utils/room-status'
import type { RackHabitacion, RackReserva } from '@/lib/actions/rack'
import { Key, User, Sparkles, Users } from 'lucide-react'

type Props = {
  habitacion: RackHabitacion
  days: Date[]
  reservas: RackReserva[]
  startDate: Date
  onReservationClick: (id: string) => void
  onNewReservation: (habitacion: RackHabitacion, fecha: Date, fechaFinal?: Date) => void
  onUpdate: () => void
  clearSelection?: boolean
  // Funciones para actualizaciones optimistas
  updateHabitacionOptimistic?: (habitacionId: string, updates: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>) => void
  revertHabitacionOptimistic?: (habitacionId: string, originalData: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>) => void
  updateReservaOptimistic?: (reservaId: string, updates: Partial<Pick<RackReserva, 'huesped_presente'>>) => void
  removeReservaOptimistic?: (reservaId: string) => void
}

export function RoomRow({
  habitacion,
  days,
  reservas,
  startDate,
  onReservationClick,
  onNewReservation,
  onUpdate,
  clearSelection,
  updateHabitacionOptimistic,
  revertHabitacionOptimistic,
  updateReservaOptimistic,
  removeReservaOptimistic,
}: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null)
  const [lastSelectedRange, setLastSelectedRange] = useState<{ start: number, end: number } | null>(null)

  // Limpiar selección cuando se cierra el Sheet
  useEffect(() => {
    if (clearSelection) {
      setIsDragging(false)
      setDragStartIndex(null)
      setDragEndIndex(null)
      setLastSelectedRange(null)
    }
  }, [clearSelection])

  // Calcular estado visual prioritario
  const visualState = getRoomVisualState(habitacion)

  // Calcular qué celdas están ocupadas por reservas
  const getReservationForCell = (dayIndex: number) => {
    const cellDay = startOfDay(days[dayIndex])

    for (const reserva of reservas) {
      const entrada = startOfDay(new Date(reserva.fecha_entrada))
      const salida = startOfDay(new Date(reserva.fecha_salida))

      // Verificar si este día es el primer día de la reserva
      if (isSameDay(cellDay, entrada)) {
        const nights = differenceInCalendarDays(salida, entrada)
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

  // Calcular reserva activa hoy para el menú contextual
  const today = startOfDay(new Date())
  const activeReservation = reservas.find(r => {
    if (r.estado !== 'CHECKED_IN') return false
    const start = startOfDay(new Date(r.fecha_entrada))
    const end = startOfDay(new Date(r.fecha_salida))
    return today >= start && today <= end
  })

  return (
    <>
      {/* Room info cell (sticky) con menú contextual */}
      <RoomContextMenu
        habitacion={habitacion}
        reservaActiva={activeReservation ? { id: activeReservation.id, huesped_presente: activeReservation.huesped_presente } : null}
        onUpdate={onUpdate}
        updateHabitacionOptimistic={updateHabitacionOptimistic}
        revertHabitacionOptimistic={revertHabitacionOptimistic}
        updateReservaOptimistic={updateReservaOptimistic}
      >
        <div className="sticky left-0 z-20 border-b border-r bg-background p-2 cursor-context-menu h-[80px]">
          <div className="flex items-start justify-between h-full">
            {/* Lado izquierdo: Info habitación */}
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="font-bold text-xl leading-none">{habitacion.numero}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {habitacion.tipos_habitacion.nombre}
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {habitacion.tipos_habitacion.capacidad_personas || 2}
              </div>
            </div>

            {/* Lado derecho: Badges + Indicador */}
            <div className="flex flex-col items-end justify-between h-full">
              {/* Badges según estado */}
              {habitacion.estado_ocupacion === 'OCUPADA' ? (
                <div className="flex flex-col items-end gap-1">
                  {/* Badge Huésped */}
                  <Badge
                    variant="outline"
                    className={`${activeReservation?.huesped_presente === false
                      ? 'bg-[#f59e0b] text-white border-0'
                      : 'bg-[#f44250] text-white border-0'
                      } text-[10px] px-2 py-0.5 flex items-center gap-1`}
                  >
                    {activeReservation?.huesped_presente === false ? (
                      <><Key className="w-3 h-3" /> Fuera</>
                    ) : (
                      <><User className="w-3 h-3" /> Dentro</>
                    )}
                  </Badge>

                  {/* Badge Limpieza */}
                  <Badge
                    variant="outline"
                    className={`${habitacion.estado_limpieza === 'SUCIA' ? 'bg-[#fecc1b] text-white border-0' :
                      habitacion.estado_limpieza === 'EN_LIMPIEZA' ? 'bg-[#2B7FFF] text-white border-0' :
                        'bg-[#2B7FFF] text-white border-0'
                      } text-[10px] px-2 py-0.5 flex items-center gap-1`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {habitacion.estado_limpieza === 'SUCIA' ? 'Sucia' :
                      habitacion.estado_limpieza === 'EN_LIMPIEZA' ? 'Limpiando' :
                        'Limpia'}
                  </Badge>
                </div>
              ) : habitacion.estado_limpieza === 'SUCIA' || habitacion.estado_limpieza === 'EN_LIMPIEZA' ? (
                /* Mostrar badge de limpieza en habitaciones LIBRES pero SUCIAS */
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={`${habitacion.estado_limpieza === 'SUCIA' ? 'bg-[#fecc1b] text-black border-0' :
                      'bg-[#2B7FFF] text-white border-0'
                      } text-[10px] px-2 py-0.5 flex items-center gap-1`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {habitacion.estado_limpieza === 'SUCIA' ? 'Sucia' : 'Limpiando'}
                  </Badge>
                </div>
              ) : (
                <div></div>
              )}

              {/* Círculo de estado de ocupación */}
              <div className={`w-4 h-4 rounded-full ${habitacion.estado_servicio !== 'OPERATIVA' ? 'bg-[#374151]' :
                habitacion.estado_ocupacion === 'OCUPADA' ? 'bg-[#f44250]' :
                  'bg-[#6BD968]'
                }`}></div>
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
                updateHabitacionOptimistic={updateHabitacionOptimistic}
                removeReservaOptimistic={removeReservaOptimistic}
              />
            )}
          </GridCell>
        )
      })}
    </>
  )
}
