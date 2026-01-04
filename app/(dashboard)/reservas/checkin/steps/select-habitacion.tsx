'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bed, Users, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectHabitacionProps {
    habitaciones: any[]
    initialData: any
    onNext: (data: any) => void
}

export function SelectHabitacion({ habitaciones, initialData, onNext }: SelectHabitacionProps) {
    const [habitacionId, setHabitacionId] = useState(initialData?.habitacion_id || '')
    const [tarifaId, setTarifaId] = useState(initialData?.tarifa_id || '')

    const habitacionSeleccionada = habitaciones.find((h) => h.id === habitacionId)
    const tarifaSeleccionada = habitacionSeleccionada?.categorias?.tarifas?.find(
        (t: any) => t.id === tarifaId
    )

    function handleContinuar() {
        if (!habitacionId || !tarifaId) {
            alert('Por favor selecciona una habitación y una tarifa')
            return
        }

        onNext({
            habitacion_id: habitacionId,
            habitacion_numero: habitacionSeleccionada.numero,
            categoria_nombre: habitacionSeleccionada.categorias?.nombre,
            capacidad_max: habitacionSeleccionada.categorias?.capacidad_max,
            tarifa_id: tarifaId,
            tarifa_nombre: tarifaSeleccionada.nombre,
            precio_noche: tarifaSeleccionada.precio,
        })
    }

    return (
        <>
            {/* Grid de habitaciones - sin wrapper */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {habitaciones.map((habitacion) => {
                    const isSelected = habitacionId === habitacion.id

                    return (
                        <div
                            key={habitacion.id}
                            className={cn(
                                'relative rounded-lg border p-4 transition-all cursor-pointer hover:border-primary/50',
                                isSelected && 'border-primary bg-primary/5'
                            )}
                            onClick={() => {
                                setHabitacionId(habitacion.id)
                                if (!habitacion.categorias?.tarifas?.some((t: any) => t.id === tarifaId)) {
                                    setTarifaId('')
                                }
                            }}
                        >
                            {isSelected && (
                                <div className="absolute -top-2 -right-2 rounded-full bg-primary p-1">
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                            )}

                            <div className="flex items-start gap-3 mb-3">
                                <div className="rounded bg-primary/10 p-2">
                                    <Bed className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold">{habitacion.numero}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Piso {habitacion.piso}
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm font-medium mb-1">
                                {habitacion.categorias?.nombre}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                                <Users className="h-3 w-3" />
                                <span>{habitacion.categorias?.capacidad_max} pers.</span>
                            </div>

                            <div className="space-y-1.5">
                                {habitacion.categorias?.tarifas?.map((tarifa: any) => (
                                    <button
                                        key={tarifa.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setHabitacionId(habitacion.id)
                                            setTarifaId(tarifa.id)
                                        }}
                                        className={cn(
                                            'w-full flex items-center justify-between rounded px-2 py-1.5 text-xs transition-colors',
                                            tarifaId === tarifa.id && isSelected
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted'
                                        )}
                                    >
                                        <span className="capitalize">{tarifa.nombre}</span>
                                        <span className="font-semibold">S/ {tarifa.precio}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Bottom Bar Fija - siempre visible, respeta sidebar */}
            <div className="fixed bottom-0 right-0 left-0 md:left-[var(--sidebar-width)] border-t bg-background z-50">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                        {/* Resumen selección */}
                        <div className="flex-1">
                            {habitacionId && tarifaId ? (
                                <div className="flex items-center gap-3">
                                    <div className="hidden sm:flex items-center gap-2 text-sm">
                                        <div className="rounded bg-primary/10 p-1.5">
                                            <Bed className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <span className="font-medium">
                                            Hab. {habitacionSeleccionada.numero}
                                        </span>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="capitalize text-muted-foreground">
                                            {tarifaSeleccionada.nombre}
                                        </span>
                                    </div>
                                    <div className="text-lg font-semibold text-primary">
                                        S/ {tarifaSeleccionada.precio}
                                        <span className="text-xs text-muted-foreground font-normal ml-1">
                                            /noche
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Selecciona una habitación y una tarifa para continuar
                                </p>
                            )}
                        </div>

                        {/* Botón */}
                        <Button
                            onClick={handleContinuar}
                            disabled={!habitacionId || !tarifaId}
                            size="lg"
                        >
                            Continuar
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
