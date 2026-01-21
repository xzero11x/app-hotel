'use client'

import { Suspense, useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Zap, History, ArrowRight, User, Clock, TrendingUp, TrendingDown, Wallet, Plus } from 'lucide-react'
import { getTodosLosTurnosActivos } from '@/lib/actions/cajas'
import { ModalAperturaTurno } from '@/components/cajas/modal-apertura-turno'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

type TurnoActivo = {
    turno: {
        id: string
        caja_nombre: string
        usuario_nombre: string
        fecha_apertura: string
        monto_apertura_efectivo: number
    }
    estadisticas: {
        total_esperado_pen: number
        total_ingresos_pen: number
        total_egresos_pen: number
        desglose_metodos_pago?: {
            efectivo: number
        }
    }
}

export function GestionCajasClient() {
    const [activeTab, setActiveTab] = useState('monitor')
    const [turnosActivos, setTurnosActivos] = useState<TurnoActivo[]>([])
    const [loading, setLoading] = useState(true)
    const [showAbrirCaja, setShowAbrirCaja] = useState(false)

    useEffect(() => {
        loadTurnosActivos()
    }, [])

    async function loadTurnosActivos() {
        setLoading(true)
        try {
            const turnos = await getTodosLosTurnosActivos()
            setTurnosActivos(turnos || [])
        } catch (error) {
            console.error('Error loading turnos:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleTurnoAbierto = () => {
        setShowAbrirCaja(false)
        loadTurnosActivos()
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Modal Abrir Caja */}
            {showAbrirCaja && (
                <ModalAperturaTurno
                    onSuccess={handleTurnoAbierto}
                    onCancel={() => setShowAbrirCaja(false)}
                    allowCancel={true}
                />
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold">Gestión de Cajas</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Monitoreo en tiempo real y auditoría de cierres
                    </p>
                </div>
                <Button onClick={() => setShowAbrirCaja(true)} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Abrir Caja
                </Button>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="monitor" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Monitor Activo</span>
                        <span className="sm:hidden">Monitor</span>
                        {turnosActivos.length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-[10px] sm:text-xs px-1 sm:px-2">
                                {turnosActivos.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="historial" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Historial de Cierres</span>
                        <span className="sm:hidden">Historial</span>
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Monitor Activo */}
                <TabsContent value="monitor" className="mt-4 sm:mt-6">
                    <MonitorActivoTab
                        turnos={turnosActivos}
                        loading={loading}
                        onRefresh={loadTurnosActivos}
                    />
                </TabsContent>

                {/* Tab: Historial de Cierres */}
                <TabsContent value="historial" className="mt-4 sm:mt-6">
                    <HistorialCierresTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}

// ========================================
// MONITOR ACTIVO TAB
// ========================================
function MonitorActivoTab({
    turnos,
    loading,
    onRefresh
}: {
    turnos: TurnoActivo[]
    loading: boolean
    onRefresh: () => void
}) {
    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2].map(i => (
                        <Skeleton key={i} className="h-64 w-full" />
                    ))}
                </div>
            </div>
        )
    }

    if (turnos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No hay cajas activas</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    No hay ningún turno de caja abierto en este momento
                </p>
            </div>
        )
    }

    // Identificar "Tu caja activa" (la primera por ahora, o la del usuario)
    const miCaja = turnos[0]
    const otrasCajas = turnos.slice(1)

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Mi caja activa */}
            <div>
                <div className="flex items-center gap-2 mb-3 text-xs sm:text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Tu caja activa
                </div>
                <CajaActivaCard turno={miCaja} destacada />
            </div>

            {/* Otras cajas (si hay más) */}
            {otrasCajas.length > 0 && (
                <div>
                    <div className="text-xs sm:text-sm text-muted-foreground mb-3">
                        Otras cajas activas
                    </div>
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                        {otrasCajas.map(turno => (
                            <CajaActivaCard key={turno.turno.id} turno={turno} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function CajaActivaCard({ turno, destacada }: { turno: TurnoActivo, destacada?: boolean }) {
    const horaApertura = format(new Date(turno.turno.fecha_apertura), 'hh:mm a', { locale: es })

    return (
        <Card className={destacada ? 'border-2' : ''}>
            <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-muted rounded-lg">
                            <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-base sm:text-lg">{turno.turno.caja_nombre}</CardTitle>
                            <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {turno.turno.usuario_nombre}
                            </div>
                        </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-[10px] sm:text-xs px-1.5 sm:px-2">
                        Abierta
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
                {/* Hora apertura */}
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Apertura: {horaApertura}
                </div>

                {/* Saldo principal - EFECTIVO TEÓRICO */}
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                    <div className="flex justify-between items-start mb-1">
                        <p className="text-xs sm:text-sm text-muted-foreground">Efectivo en Caja</p>
                        <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">Teórico</Badge>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold">
                        S/ {(turno.turno.monto_apertura_efectivo + (turno.estadisticas.desglose_metodos_pago?.efectivo || 0)).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 text-right">
                        Balance Total: S/ {turno.estadisticas.total_esperado_pen.toFixed(2)}
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center text-xs sm:text-sm">
                    <div>
                        <p className="text-muted-foreground text-[10px] sm:text-xs">$ Inicial</p>
                        <p className="font-medium text-sm sm:text-base">S/ {turno.turno.monto_apertura_efectivo.toFixed(0)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-[10px] sm:text-xs flex items-center justify-center gap-0.5 sm:gap-1">
                            <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Ingresos
                        </p>
                        <p className="font-medium text-green-600 text-sm sm:text-base">
                            +S/ {turno.estadisticas.total_ingresos_pen.toFixed(0)}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-[10px] sm:text-xs flex items-center justify-center gap-0.5 sm:gap-1">
                            <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Egresos
                        </p>
                        <p className="font-medium text-red-600 text-sm sm:text-base">
                            -S/ {turno.estadisticas.total_egresos_pen.toFixed(0)}
                        </p>
                    </div>
                </div>

                {/* Botón gestionar */}
                <Button className="w-full" asChild size="sm">
                    <Link href={`/cajas/gestionar/${turno.turno.id}`}>
                        <span className="hidden sm:inline">Gestionar / Arquear</span>
                        <span className="sm:hidden">Gestionar</span>
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    )
}

// ========================================
// HISTORIAL DE CIERRES TAB (Simplificado)
// ========================================
import { HistorialCierresClient } from './historial/historial-cierres-client'

function HistorialCierresTab() {
    return <HistorialCierresClient />
}
