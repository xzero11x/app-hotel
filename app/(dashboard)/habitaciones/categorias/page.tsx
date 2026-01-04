import { DashboardHeader } from '@/components/dashboard-header'
import { Separator } from '@/components/ui/separator'
import { getCategoriasConTarifas } from '@/lib/actions/categorias'
import { CategoriasClient, CreateButton } from './categorias-client'

export default async function CategoriasPage() {
    const categorias = await getCategoriasConTarifas()

    const stats = {
        total: categorias.length,
        totalHabitaciones: categorias.reduce((sum: number, cat: any) =>
            sum + (cat._count?.habitaciones || 0), 0),
        precioPromedio: categorias.length > 0
            ? Math.round(
                categorias.reduce((sum: number, cat: any) =>
                    sum + (cat.tarifas?.[0]?.precio || 0), 0) / categorias.length
            )
            : 0,
    }

    return (
        <>
            <DashboardHeader
                breadcrumbs={[
                    { label: 'Habitaciones', href: '/habitaciones' },
                    { label: 'Categorías' },
                ]}
            />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header con título y acción principal */}
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">Categorías y Tarifas</h1>
                        <p className="text-sm text-muted-foreground">
                            Gestiona los tipos de habitaciones y sus precios
                        </p>
                    </div>
                    <CreateButton />
                </div>

                {/* Métricas */}
                <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="font-semibold">{stats.total}</span>
                        <span className="text-muted-foreground">Categorías</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                        <span className="font-semibold">{stats.totalHabitaciones}</span>
                        <span className="text-muted-foreground">Habitaciones</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold">S/ {stats.precioPromedio}</span>
                        <span className="text-muted-foreground">Precio promedio</span>
                    </div>
                </div>

                <Separator className="-mt-2" />

                {/* Contenido principal */}
                <CategoriasClient categorias={categorias} />
            </div>
        </>
    )
}
