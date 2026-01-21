import { DashboardHeader } from '@/components/dashboard-header'
import { ReservasHistorialTable } from './reservas-historial-table'
import { getEstadisticasOcupaciones } from '@/lib/actions/ocupaciones'
import { CalendarDays, TrendingUp, History, FileBarChart } from 'lucide-react'

export default async function ReservasPage() {
  const stats = await getEstadisticasOcupaciones()

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Historial de Reservas' }
        ]}
      />

      <div className="flex flex-1 flex-col gap-3 sm:gap-4 p-3 sm:p-4 md:p-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Historial de Reservas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Registro histórico completo de reservas, análisis de ocupación y reportes financieros.
          </p>
        </div>

        {/* KPIs orientados a reportes y análisis */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-xs sm:text-sm font-medium">Total Reservas</p>
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.total_todas}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
              Todas del sistema
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-xs sm:text-sm font-medium">Futuras</p>
              <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.total_reservas}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
              Pendientes
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-xs sm:text-sm font-medium">Ocupadas</p>
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.total_checkins}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
              Check-in hecho
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-xs sm:text-sm font-medium">Por Cobrar</p>
              <FileBarChart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold">S/ {stats.monto_total_deuda.toFixed(2)}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
              Pendiente ({stats.total_con_deuda})
            </p>
          </div>
        </div>

        <div className="bg-background">
          <ReservasHistorialTable />
        </div>
      </div>
    </>
  )
}
