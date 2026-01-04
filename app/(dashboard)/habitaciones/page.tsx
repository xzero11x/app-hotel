import { DashboardHeader } from '@/components/dashboard-header'
import { HabitacionesClient, CreateButton } from './habitaciones-client'
import { getHabitaciones } from '@/lib/actions/habitaciones'
import { getCategoriasConTarifas } from '@/lib/actions/categorias'
import { Separator } from '@/components/ui/separator'

export default async function HabitacionesPage() {
    const [habitaciones, categorias] = await Promise.all([
        getHabitaciones(),
        getCategoriasConTarifas(),
    ])

    // Estadísticas
    const stats = {
        total: habitaciones.length,
        disponibles: habitaciones.filter((h: any) => h.estado_ocupacion === 'DISPONIBLE').length,
        ocupadas: habitaciones.filter((h: any) => h.estado_ocupacion === 'OCUPADA').length,
        mantenimiento: habitaciones.filter((h: any) => h.estado_ocupacion === 'MANTENIMIENTO').length,
    }

    return (
        <>
            <DashboardHeader
                breadcrumbs={[
                    { label: 'Habitaciones' },
                ]}
            />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header con título y acción principal */}
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">Gestión de Habitaciones</h1>
                        <p className="text-sm text-muted-foreground">
                            Administra el estado y disponibilidad de las habitaciones
                        </p>
                    </div>
                    <CreateButton categorias={categorias} />
                </div>

                {/* Métricas */}
                <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="font-semibold">{stats.disponibles}</span>
                        <span className="text-muted-foreground">Disponibles</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="font-semibold">{stats.ocupadas}</span>
                        <span className="text-muted-foreground">Ocupadas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="font-semibold">{stats.mantenimiento}</span>
                        <span className="text-muted-foreground">Limpieza</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-slate-500" />
                        <span className="font-semibold">{stats.total}</span>
                        <span className="text-muted-foreground">Mantenimiento</span>
                    </div>
                </div>

                <Separator className="-mt-2" />

                {/* Contenido principal */}
                <HabitacionesClient habitaciones={habitaciones} categorias={categorias} />
            </div>
        </>
    )
}
