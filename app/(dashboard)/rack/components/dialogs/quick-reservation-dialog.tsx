'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfDay, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarIcon, Users, Loader2, ArrowRight, Check, Bed } from 'lucide-react'
import { getRackHabitaciones, getRackReservas, type RackHabitacion } from '@/lib/actions/rack'
import { cn } from '@/lib/utils'
import { DateRange } from 'react-day-picker'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelectRoom: (habitacion: RackHabitacion, fechaInicial: Date, fechaFinal: Date) => void
}

type HabitacionConDisponibilidad = RackHabitacion & {
    disponible: boolean
    razon?: string
}

export function QuickReservationDialog({ open, onOpenChange, onSelectRoom }: Props) {
    const [step, setStep] = useState<'fechas' | 'habitaciones'>('fechas')
    const [dateRange, setDateRange] = useState<DateRange | undefined>()
    const [habitaciones, setHabitaciones] = useState<HabitacionConDisponibilidad[]>([])
    const [loading, setLoading] = useState(false)

    // Reset al cerrar
    useEffect(() => {
        if (!open) {
            setStep('fechas')
            setDateRange(undefined)
            setHabitaciones([])
        }
    }, [open])

    const handleDateSelect = (range: DateRange | undefined) => {
        setDateRange(range)
    }

    const handleContinue = async () => {
        if (!dateRange?.from) return

        setLoading(true)
        try {
            // Obtener todas las habitaciones
            const todasHabitaciones = await getRackHabitaciones()

            // Obtener reservas en el rango de fechas
            const fechaInicio = dateRange.from
            const fechaFin = dateRange.to || addDays(dateRange.from, 1)

            const reservas = await getRackReservas(fechaInicio, fechaFin)

            // Determinar disponibilidad de cada habitación
            const habitacionesConDisponibilidad: HabitacionConDisponibilidad[] = todasHabitaciones.map(hab => {
                // Verificar si está fuera de servicio
                if (hab.estado_servicio === 'FUERA_SERVICIO' || hab.estado_servicio === 'MANTENIMIENTO') {
                    return {
                        ...hab,
                        disponible: false,
                        razon: 'Fuera de servicio'
                    }
                }

                // Verificar si tiene reserva en el rango
                const tieneReserva = reservas.some(r =>
                    r.habitacion_id === hab.id &&
                    ['RESERVADA', 'CHECKED_IN'].includes(r.estado)
                )

                if (tieneReserva) {
                    return {
                        ...hab,
                        disponible: false,
                        razon: 'Ocupada en estas fechas'
                    }
                }

                return {
                    ...hab,
                    disponible: true
                }
            })

            // Ordenar: disponibles primero
            habitacionesConDisponibilidad.sort((a, b) => {
                if (a.disponible && !b.disponible) return -1
                if (!a.disponible && b.disponible) return 1
                return a.numero.localeCompare(b.numero)
            })

            setHabitaciones(habitacionesConDisponibilidad)
            setStep('habitaciones')
        } catch (error) {
            console.error('Error al cargar habitaciones:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSelectRoom = (habitacion: HabitacionConDisponibilidad) => {
        if (!habitacion.disponible || !dateRange?.from) return

        const fechaInicial = dateRange.from
        const fechaFinal = dateRange.to || addDays(dateRange.from, 1)

        onOpenChange(false)
        onSelectRoom(habitacion, fechaInicial, fechaFinal)
    }

    const noches = dateRange?.from && dateRange?.to
        ? differenceInDays(dateRange.to, dateRange.from)
        : dateRange?.from ? 1 : 0

    const habitacionesDisponibles = habitaciones.filter(h => h.disponible).length

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'fechas' ? 'Seleccionar Fechas' : 'Seleccionar Habitación'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'fechas'
                            ? 'Elige las fechas de entrada y salida'
                            : `${habitacionesDisponibles} habitación${habitacionesDisponibles !== 1 ? 'es' : ''} disponible${habitacionesDisponibles !== 1 ? 's' : ''} del ${format(dateRange!.from!, 'dd/MM')} al ${format(dateRange?.to || addDays(dateRange!.from!, 1), 'dd/MM')}`
                        }
                    </DialogDescription>
                </DialogHeader>

                {step === 'fechas' ? (
                    <div className="flex flex-col items-center gap-4 py-4">
                        <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={handleDateSelect}
                            locale={es}
                            numberOfMonths={1}
                            disabled={(date) => date < startOfDay(new Date())}
                            className="rounded-md border"
                        />

                        {dateRange?.from && (
                            <div className="text-center text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">
                                    {noches} noche{noches !== 1 ? 's' : ''}
                                </span>
                                {' · '}
                                {format(dateRange.from, 'dd MMM', { locale: es })}
                                {' → '}
                                {format(dateRange.to || addDays(dateRange.from, 1), 'dd MMM', { locale: es })}
                            </div>
                        )}

                        <div className="flex gap-2 w-full justify-end pt-4 border-t">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleContinue}
                                disabled={!dateRange?.from || loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Buscando...
                                    </>
                                ) : (
                                    <>
                                        Ver disponibilidad
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {/* Lista de habitaciones */}
                        <div className="flex-1 overflow-y-auto space-y-2 py-2">
                            {habitaciones.map(hab => (
                                <button
                                    key={hab.id}
                                    onClick={() => handleSelectRoom(hab)}
                                    disabled={!hab.disponible}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left",
                                        hab.disponible
                                            ? "hover:bg-accent hover:border-primary cursor-pointer"
                                            : "opacity-50 cursor-not-allowed bg-muted"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold",
                                            hab.disponible ? "bg-green-600" : "bg-gray-400"
                                        )}>
                                            {hab.numero}
                                        </div>
                                        <div>
                                            <div className="font-medium">
                                                {hab.tipos_habitacion.nombre}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                <Users className="h-3 w-3" />
                                                {hab.tipos_habitacion.capacidad_personas} personas
                                                <span>·</span>
                                                <Bed className="h-3 w-3" />
                                                {hab.categorias_habitacion.nombre}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {hab.disponible ? (
                                            <Badge variant="outline" className="text-green-600 border-green-600">
                                                <Check className="h-3 w-3 mr-1" />
                                                Disponible
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                {hab.razon}
                                            </Badge>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="flex gap-2 justify-between pt-4 border-t">
                            <Button variant="outline" onClick={() => setStep('fechas')}>
                                Cambiar fechas
                            </Button>
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
