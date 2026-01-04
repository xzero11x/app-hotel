import { DashboardHeader } from '@/components/dashboard-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { Bed, Users, DollarSign, Calendar, TrendingUp, MapPin, User } from 'lucide-react'

async function getStats() {
    const supabase = await createClient()

    // Total habitaciones
    const { count: totalHabitaciones } = await supabase
        .from('habitaciones')
        .select('*', { count: 'exact', head: true })

    // Habitaciones por estado
    const { data: habitacionesPorEstado } = await supabase
        .from('habitaciones')
        .select('estado_ocupacion')

    const disponibles = habitacionesPorEstado?.filter(h => h.estado_ocupacion === 'DISPONIBLE').length || 0
    const ocupadas = habitacionesPorEstado?.filter(h => h.estado_ocupacion === 'OCUPADA').length || 0
    const limpieza = habitacionesPorEstado?.filter(h => h.estado_ocupacion === 'LIMPIEZA').length || 0
    const mantenimiento = habitacionesPorEstado?.filter(h => h.estado_ocupacion === 'MANTENIMIENTO').length || 0

    // Estadías activas
    const { count: estadiasActivas } = await supabase
        .from('estadias')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'ACTIVA')

    // Check-ins del día
    const hoy = new Date().toISOString().split('T')[0]
    const { count: checkInsHoy } = await supabase
        .from('estadias')
        .select('*', { count: 'exact', head: true })
        .eq('fecha_hora_entrada', hoy)

    // Check-outs del día
    const { count: checkOutsHoy } = await supabase
        .from('estadias')
        .select('*', { count: 'exact', head: true })
        .eq('fecha_hora_salida', hoy)

    // Habitaciones disponibles con detalles
    const { data: habitacionesDisponibles } = await supabase
        .from('habitaciones')
        .select(`
            numero,
            piso,
            categorias (nombre),
            tarifas (precio_base)
        `)
        .eq('estado_ocupacion', 'DISPONIBLE')
        .order('numero')
        .limit(6)

    return {
        totalHabitaciones: totalHabitaciones || 0,
        disponibles,
        ocupadas,
        limpieza,
        mantenimiento,
        estadiasActivas: estadiasActivas || 0,
        checkInsHoy: checkInsHoy || 0,
        checkOutsHoy: checkOutsHoy || 0,
        habitacionesDisponibles: habitacionesDisponibles || [],
        ocupacion: totalHabitaciones ? Math.round((ocupadas / totalHabitaciones) * 100) : 0,
    }
}

export default async function DashboardPage() {
    const stats = await getStats()
    const fecha = new Date().toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })

    return (
        <>
            <DashboardHeader breadcrumbs={[{ label: 'Dashboard' }]} />
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                {/* Header con título y botón */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                        <p className="text-muted-foreground">
                            Bienvenido al sistema de gestión hotelera - {fecha}
                        </p>
                    </div>
                    <Button size="lg" className="gap-2">
                        <Calendar className="h-4 w-4" />
                        Nuevo Check-in
                    </Button>
                </div>

                {/* Indicadores de estado */}
                <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="font-medium">{stats.disponibles}</span>
                        <span className="text-muted-foreground">Disponibles</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="font-medium">{stats.ocupadas}</span>
                        <span className="text-muted-foreground">Ocupados</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="font-medium">{stats.limpieza}</span>
                        <span className="text-muted-foreground">Limpieza</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                        <span className="font-medium">{stats.mantenimiento}</span>
                        <span className="text-muted-foreground">Mantenimiento</span>
                    </div>
                </div>

                {/* Cards de métricas */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Total Habitaciones
                            </CardTitle>
                            <Bed className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalHabitaciones}</div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <TrendingUp className="h-3 w-3 text-green-500" />
                                <span className="text-green-500">{stats.ocupacion}% ocupación</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Huéspedes Activos
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.estadiasActivas}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                <span className="text-green-500">✓ {stats.estadiasActivas} dentro</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Ingresos de Hoy
                            </CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">S/ 0</div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <TrendingUp className="h-3 w-3 text-green-500" />
                                <span className="text-green-500">+0% vs ayer</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Check-ins Hoy
                            </CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.checkInsHoy}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                ↓ {stats.checkOutsHoy} check-outs
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Habitaciones Disponibles */}
                <div className="grid gap-4 md:grid-cols-7">
                    <Card className="md:col-span-5">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Habitaciones Disponibles Ahora</CardTitle>
                                    <CardDescription>
                                        Listas para check-in inmediato
                                    </CardDescription>
                                </div>
                                <Button className="gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Nuevo Check-in
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 md:grid-cols-2">
                                {stats.habitacionesDisponibles.map((hab: any) => (
                                    <div
                                        key={hab.numero}
                                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                <Bed className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <div className="font-semibold">{hab.numero}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {hab.categorias?.nombre || 'Simple'}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />
                                                    Piso {hab.piso}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className="text-green-500 border-green-500">
                                                DISPONIBLE
                                            </Badge>
                                            <div className="mt-1 text-sm font-medium">
                                                S/ {hab.tarifas?.precio_base || 50}/noche
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Panel lateral: Huéspedes Fuera */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Huéspedes Fuera</CardTitle>
                            <CardDescription>
                                Reactivarán atención
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 rounded-lg border p-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">Sin huéspedes fuera</div>
                                        <div className="text-xs text-muted-foreground">
                                            Todos en el hotel
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        FUERA
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    )
}
