'use client'

import { startOfDay, differenceInHours, format, isSameDay, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RoomContextMenu } from '../context-menu/room-context-menu'
import { getRoomVisualState } from '@/lib/utils/room-status'
import { Key, User, Sparkles, Users, LogIn, LogOut, Clock, AlertCircle } from 'lucide-react'
import type { RackHabitacion, RackReserva } from '@/lib/actions/rack'
import { cn } from '@/lib/utils'

type Props = {
    habitacion: RackHabitacion
    reservas: RackReserva[]
    onReservationClick: (id: string) => void
    onNewReservation: (habitacion: RackHabitacion, fecha: Date) => void
    onUpdate: () => void
    // Funciones para actualizaciones optimistas
    updateHabitacionOptimistic?: (habitacionId: string, updates: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>) => void
    revertHabitacionOptimistic?: (habitacionId: string, originalData: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>) => void
    updateReservaOptimistic?: (reservaId: string, updates: Partial<Pick<RackReserva, 'huesped_presente'>>) => void
}

export function RoomCard({
    habitacion,
    reservas,
    onReservationClick,
    onNewReservation,
    onUpdate,
    updateHabitacionOptimistic,
    revertHabitacionOptimistic,
    updateReservaOptimistic,
}: Props) {
    const visualState = getRoomVisualState(habitacion)
    const now = new Date()
    const today = startOfDay(now)

    // Buscar reserva activa (CHECKED_IN) de hoy
    const activeReservation = reservas.find(r => {
        if (r.estado !== 'CHECKED_IN') return false
        const start = startOfDay(new Date(r.fecha_entrada))
        const end = startOfDay(new Date(r.fecha_salida))
        return today >= start && today <= end
    })

    // Buscar reserva próxima (RESERVADA que entra hoy)
    const upcomingReservation = reservas.find(r => {
        if (r.estado !== 'RESERVADA') return false
        return isToday(new Date(r.fecha_entrada))
    })

    // Calcular horas hasta check-in próximo
    const hoursUntilCheckin = upcomingReservation 
        ? differenceInHours(new Date(upcomingReservation.fecha_entrada), now)
        : null

    // Hora de checkout esperada para reserva activa
    const checkoutTime = activeReservation 
        ? format(new Date(activeReservation.fecha_salida), 'HH:mm', { locale: es })
        : null

    const handleClick = () => {
        if (activeReservation) {
            onReservationClick(activeReservation.id)
        } else if (upcomingReservation) {
            onReservationClick(upcomingReservation.id)
        } else {
            onNewReservation(habitacion, new Date())
        }
    }

    return (
        <RoomContextMenu
            habitacion={habitacion}
            reservaActiva={activeReservation ? { id: activeReservation.id, huesped_presente: activeReservation.huesped_presente } : null}
            onUpdate={onUpdate}
            updateHabitacionOptimistic={updateHabitacionOptimistic}
            revertHabitacionOptimistic={revertHabitacionOptimistic}
            updateReservaOptimistic={updateReservaOptimistic}
        >
            <div
                className={cn(
                    "relative bg-card border rounded-xl shadow-sm p-3 sm:p-4 cursor-pointer transition-all duration-200 group h-full flex flex-col justify-between overflow-hidden",
                    "hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5"
                )}
                onClick={handleClick}
            >
                {/* Barra de estado lateral con gradiente */}
                <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5",
                    habitacion.estado_servicio !== 'OPERATIVA' ? 'bg-gradient-to-b from-gray-500 to-gray-700' :
                    habitacion.estado_ocupacion === 'OCUPADA' ? 'bg-gradient-to-b from-red-500 to-red-600' :
                    'bg-gradient-to-b from-green-400 to-green-600'
                )} />

                {/* Quick Actions en hover - Superior derecha */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 z-10">
                    {activeReservation && (
                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 w-6 sm:h-7 sm:w-7 p-0 shadow-md"
                            onClick={(e) => {
                                e.stopPropagation()
                                onReservationClick(activeReservation.id)
                            }}
                            title="Ver Check-out"
                        >
                            <LogOut className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </Button>
                    )}
                    {upcomingReservation && !activeReservation && (
                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 w-6 sm:h-7 sm:w-7 p-0 shadow-md"
                            onClick={(e) => {
                                e.stopPropagation()
                                onReservationClick(upcomingReservation.id)
                            }}
                            title="Ver Check-in"
                        >
                            <LogIn className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </Button>
                    )}
                </div>

                <div className="flex items-start justify-between mb-2 sm:mb-3 pl-2">
                    <div className="space-y-0.5 sm:space-y-1">
                        <h3 className="font-bold text-xl sm:text-2xl leading-none group-hover:text-primary transition-colors">{habitacion.numero}</h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{habitacion.tipos_habitacion.nombre}</p>
                    </div>

                    {/* Badges con mejor diseño */}
                    {habitacion.estado_ocupacion === 'OCUPADA' ? (
                        <div className="flex flex-col items-end gap-1.5">
                            {/* Badge Huésped */}
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-[10px] px-2 py-0.5 flex items-center gap-1 shadow-sm border-0 font-medium",
                                    activeReservation?.huesped_presente === false
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-red-500 text-white'
                                )}
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
                                className={cn(
                                    "text-[10px] px-2 py-0.5 flex items-center gap-1 shadow-sm border-0 font-medium",
                                    habitacion.estado_limpieza === 'SUCIA' ? 'bg-yellow-500 text-white' :
                                    habitacion.estado_limpieza === 'EN_LIMPIEZA' ? 'bg-blue-500 text-white' :
                                    'bg-blue-600 text-white'
                                )}
                            >
                                <Sparkles className="w-3 h-3" />
                                {habitacion.estado_limpieza === 'SUCIA' ? 'Sucia' :
                                    habitacion.estado_limpieza === 'EN_LIMPIEZA' ? 'Limpiando' :
                                    'Limpia'}
                            </Badge>
                        </div>
                    ) : upcomingReservation && hoursUntilCheckin !== null && hoursUntilCheckin <= 6 ? (
                        <Badge
                            variant="outline"
                            className="bg-orange-500 text-white border-0 text-[10px] px-2 py-0.5 font-semibold shadow-sm flex items-center gap-1 animate-pulse"
                        >
                            <AlertCircle className="w-3 h-3" />
                            Entrada {hoursUntilCheckin}h
                        </Badge>
                    ) : (
                        <Badge
                            variant="outline"
                            className={cn(
                                visualState.badgeColor,
                                visualState.textColor,
                                "border-0 text-xs px-2.5 py-0.5 font-semibold shadow-sm"
                            )}
                        >
                            {visualState.label}
                        </Badge>
                    )}
                </div>

                <div className="text-[10px] sm:text-xs space-y-2 sm:space-y-2.5 pl-2 mt-auto">
                    <div className="flex justify-between items-center text-muted-foreground">
                        <span className="font-medium">Piso {habitacion.piso}</span>
                        <div className="flex items-center gap-1 bg-secondary/60 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md">
                            <Users className="w-3 h-3" />
                            <span className="font-medium">{habitacion.tipos_habitacion.capacidad_personas || 2}</span>
                        </div>
                    </div>

                    {/* Información de reserva activa */}
                    {activeReservation && (
                        <>
                            <div className="pt-2 border-t space-y-1.5">
                                <div className="flex items-center gap-2 text-foreground font-medium">
                                    <User className="w-3.5 h-3.5 text-primary" />
                                    <span className="truncate">
                                        {activeReservation.huespedes
                                            ? `${activeReservation.huespedes.nombres} ${activeReservation.huespedes.apellidos}`
                                            : 'Huésped'
                                        }
                                    </span>
                                </div>
                                
                                {/* Hora de checkout esperada */}
                                {checkoutTime && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="text-[11px]">Sale: {checkoutTime}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Información de reserva próxima */}
                    {!activeReservation && upcomingReservation && (
                        <div className="pt-2 border-t border-dashed border-orange-300 bg-orange-50/50 dark:bg-orange-950/20 -mx-2 px-3 py-2 rounded-md">
                            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-medium text-[11px]">
                                <LogIn className="w-3.5 h-3.5" />
                                <span className="truncate">
                                    {upcomingReservation.huespedes
                                        ? `${upcomingReservation.huespedes.nombres} ${upcomingReservation.huespedes.apellidos}`
                                        : 'Reserva próxima'
                                    }
                                </span>
                            </div>
                            {hoursUntilCheckin !== null && (
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-orange-600 dark:text-orange-500">
                                    <Clock className="w-3 h-3" />
                                    Entrada en {hoursUntilCheckin}h
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </RoomContextMenu>
    )
}
