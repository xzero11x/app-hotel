'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    RefreshCw,
    Check,
    Loader2,
    Sparkles,
    Wrench,
    UserX,
    DoorClosed
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getHabitacionesSucias,
    marcarLimpia,
    type HabitacionLimpieza
} from '@/lib/actions/limpieza'
import { createClient } from '@/lib/supabase/client'

type Props = {
    habitacionesIniciales: HabitacionLimpieza[]
}

export function LimpiezaClient({ habitacionesIniciales }: Props) {
    const [habitaciones, setHabitaciones] = useState(habitacionesIniciales)
    const [isPending, startTransition] = useTransition()
    const [marcando, setMarcando] = useState<string | null>(null)

    const handleRefresh = () => {
        startTransition(async () => {
            const data = await getHabitacionesSucias()
            setHabitaciones(data)
            toast.success('Lista actualizada')
        })
    }

    const handleMarcarLimpia = async (id: string, numero: string) => {
        setMarcando(id)
        try {
            const result = await marcarLimpia(id)
            if (result.success) {
                // Quitar de la lista localmente
                setHabitaciones(prev => prev.filter(h => h.id !== id))
                toast.success(`Habitación ${numero} marcada como limpia`)
            } else {
                toast.error(result.error || 'Error al actualizar')
            }
        } catch (error) {
            toast.error('Error inesperado')
        } finally {
            setMarcando(null)
        }
    }

    // ==========================================
    // REALTIME: Sincronización automática
    // ==========================================
    useEffect(() => {
        const supabase = createClient()

        // Suscribirse a cambios en habitaciones
        const channel = supabase
            .channel('limpieza-habitaciones')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'habitaciones' },
                (payload) => {
                    const updated = payload.new as any
                    console.log('[Realtime Limpieza] Habitación actualizada:', updated.numero)

                    // Si cambió a LIMPIA, quitarla de la lista
                    if (updated.estado_limpieza === 'LIMPIA') {
                        setHabitaciones(prev => prev.filter(h => h.id !== updated.id))
                    } 
                    // Si cambió a SUCIA, agregarla o actualizarla
                    else if (updated.estado_limpieza === 'SUCIA' || updated.estado_limpieza === 'EN_LIMPIEZA') {
                        // Recargar la lista completa para obtener datos relacionados (tipo, categoría, etc.)
                        startTransition(async () => {
                            const data = await getHabitacionesSucias()
                            setHabitaciones(data)
                        })
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'reservas' },
                (payload) => {
                    const updated = payload.new as any
                    console.log('[Realtime Limpieza] Reserva actualizada:', updated.estado)

                    // Si hicieron checkout, la habitación pasó a SUCIA
                    // Recargar para que aparezca en la lista
                    if (updated.estado === 'CHECKED_OUT') {
                        startTransition(async () => {
                            const data = await getHabitacionesSucias()
                            setHabitaciones(data)
                        })
                    }
                }
            )
            .subscribe((status) => {
                console.log('[Realtime Limpieza] Canal:', status)
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Agrupar por piso
    const habitacionesPorPiso = habitaciones.reduce((acc, hab) => {
        const piso = hab.piso
        if (!acc[piso]) acc[piso] = []
        acc[piso].push(hab)
        return acc
    }, {} as Record<number, HabitacionLimpieza[]>)

    const pisos = Object.keys(habitacionesPorPiso).map(Number).sort((a, b) => a - b)

    // Contadores
    const totalSucias = habitaciones.length
    const puedenEntrar = habitaciones.filter(h => h.puede_entrar).length
    const ocupadas = habitaciones.filter(h => !h.puede_entrar).length

    return (
        <div className="min-h-screen bg-muted/30 pb-20">
            {/* Header fijo */}
            <header className="sticky top-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <h1 className="font-semibold text-lg">Limpieza</h1>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isPending}
                >
                    <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                </Button>
            </header>

            {/* Resumen */}
            <div className="px-4 py-3 flex gap-3 overflow-x-auto">
                <Badge variant="secondary" className="text-sm px-3 py-1.5 whitespace-nowrap">
                    {totalSucias} habitaciones
                </Badge>
                <Badge variant="default" className="bg-green-600 text-sm px-3 py-1.5 whitespace-nowrap">
                    {puedenEntrar} disponibles
                </Badge>
                {ocupadas > 0 && (
                    <Badge variant="destructive" className="text-sm px-3 py-1.5 whitespace-nowrap">
                        {ocupadas} ocupadas
                    </Badge>
                )}
            </div>

            {/* Lista de habitaciones */}
            <div className="px-4 space-y-6">
                {habitaciones.length === 0 ? (
                    <div className="text-center py-12">
                        <Check className="h-12 w-12 mx-auto text-green-500 mb-3" />
                        <p className="text-lg font-medium">¡Todo limpio!</p>
                        <p className="text-muted-foreground text-sm">No hay habitaciones pendientes</p>
                    </div>
                ) : (
                    pisos.map(piso => (
                        <div key={piso}>
                            <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">
                                Piso {piso}
                            </h2>
                            <div className="space-y-3">
                                {habitacionesPorPiso[piso].map(hab => (
                                    <HabitacionCard
                                        key={hab.id}
                                        habitacion={hab}
                                        onMarcarLimpia={handleMarcarLimpia}
                                        isMarcando={marcando === hab.id}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

// ========================================
// Card de Habitación
// ========================================

function HabitacionCard({
    habitacion,
    onMarcarLimpia,
    isMarcando
}: {
    habitacion: HabitacionLimpieza
    onMarcarLimpia: (id: string, numero: string) => void
    isMarcando: boolean
}) {
    const { id, numero, tipo_limpieza, puede_entrar } = habitacion

    // Estilos según tipo
    const estilos = {
        LIMPIEZA_TOTAL: {
            bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
            badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
            icon: <Sparkles className="h-5 w-5 text-emerald-500" />,
            label: 'Limpieza Total',
            sublabel: 'Disponible para limpiar'
        },
        MANTENIMIENTO: {
            bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
            badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
            icon: <Wrench className="h-5 w-5 text-amber-500" />,
            label: 'Mantenimiento',
            sublabel: 'Huésped fuera'
        },
        OCUPADO: {
            bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
            badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
            icon: <UserX className="h-5 w-5 text-red-500" />,
            label: 'Huésped Presente',
            sublabel: 'No puede entrar'
        }
    }

    const estilo = estilos[tipo_limpieza]

    return (
        <Card className={`border-2 ${estilo.bg} transition-all`}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-background border">
                            <DoorClosed className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold">{numero}</span>
                                {estilo.icon}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <Badge className={`${estilo.badge} text-xs`}>
                                    {estilo.label}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {estilo.sublabel}
                            </p>
                        </div>
                    </div>

                    {puede_entrar && (
                        <Button
                            size="lg"
                            className="h-14 w-14 rounded-xl"
                            onClick={() => onMarcarLimpia(id, numero)}
                            disabled={isMarcando}
                        >
                            {isMarcando ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <Check className="h-6 w-6" />
                            )}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
