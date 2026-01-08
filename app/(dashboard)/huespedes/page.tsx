import { Suspense } from 'react'
import { getDirectorioHuespedes, getEstadisticasDirectorio } from '@/lib/actions/huespedes'
import { DirectorioHuespedesClient } from './directorio-huespedes-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Star, AlertCircle, TrendingUp } from 'lucide-react'

export const metadata = {
  title: 'Directorio de Huéspedes',
  description: 'Historial y gestión de clientes'
}

async function EstadisticasDirectorio() {
  const stats = await getEstadisticasDirectorio()

  return (
    <div className="grid gap-4 md:grid-cols-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Huéspedes</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_huespedes}</div>
          <p className="text-xs text-muted-foreground">
            Registrados en el sistema
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Clientes VIP</CardTitle>
          <Star className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.clientes_vip}</div>
          <p className="text-xs text-muted-foreground">
            Marcados como frecuentes
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Con Alertas</CardTitle>
          <AlertCircle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.con_alertas}</div>
          <p className="text-xs text-muted-foreground">
            Con notas internas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Promedio Visitas</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.promedio_visitas}</div>
          <p className="text-xs text-muted-foreground">
            Por huésped
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function DirectorioHuespedesPage() {
  const huespedes = await getDirectorioHuespedes()

  return (
    <div className="flex-1 space-y-4 p-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Directorio de Huéspedes</h2>
          <p className="text-muted-foreground">
            Historial completo de clientes y estadísticas
          </p>
        </div>
      </div>

      <Suspense fallback={<SkeletonStats />}>
        <EstadisticasDirectorio />
      </Suspense>

      <DirectorioHuespedesClient huespedes={huespedes} />
    </div>
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
