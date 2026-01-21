import { Suspense } from 'react'
import { getDirectorioHuespedes, getEstadisticasDirectorio } from '@/lib/actions/huespedes'
import { DirectorioHuespedesClient } from './directorio-huespedes-client'
import { DashboardHeader } from '@/components/dashboard-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Users, Star, AlertCircle, TrendingUp, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata = {
  title: 'Directorio de Huéspedes',
  description: 'Historial y gestión de clientes'
}

async function EstadisticasDirectorio() {
  const stats = await getEstadisticasDirectorio()

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border bg-card p-3 sm:p-4">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-xs sm:text-sm font-medium">Total Huéspedes</p>
          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
        </div>
        <div className="text-xl sm:text-2xl font-bold">{stats.total_huespedes}</div>
        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">Registrados</p>
      </div>

      <div className="rounded-lg border bg-card p-3 sm:p-4">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-xs sm:text-sm font-medium">Clientes VIP</p>
          <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-500" />
        </div>
        <div className="text-xl sm:text-2xl font-bold">{stats.clientes_vip}</div>
        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">Frecuentes</p>
      </div>

      <div className="rounded-lg border bg-card p-3 sm:p-4">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-xs sm:text-sm font-medium">Con Alertas</p>
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
        </div>
        <div className="text-xl sm:text-2xl font-bold">{stats.con_alertas}</div>
        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">Notas internas</p>
      </div>

      <div className="rounded-lg border bg-card p-3 sm:p-4">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-xs sm:text-sm font-medium">Promedio Visitas</p>
          <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
        </div>
        <div className="text-xl sm:text-2xl font-bold">{stats.promedio_visitas}</div>
        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">Por huésped</p>
      </div>
    </div>
  )
}

export default async function DirectorioHuespedesPage() {
  const huespedes = await getDirectorioHuespedes()

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Directorio de Huéspedes' }
        ]}
      />

      <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Directorio de Huéspedes</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Historial completo de clientes y estadísticas
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/huespedes/registro-legal">
              <BookOpen className="mr-2 h-4 w-4" />
              <span className="sm:inline">Libro de Registro</span>
            </Link>
          </Button>
        </div>

        <Suspense fallback={<SkeletonStats />}>
          <EstadisticasDirectorio />
        </Suspense>

        <DirectorioHuespedesClient huespedes={huespedes} />
      </div>
    </>
  )
}

function SkeletonStats() {
  return (
    <div className="grid gap-4 md:grid-cols-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
