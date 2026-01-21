import { redirect } from 'next/navigation'
import { getUser } from '@/lib/actions/auth'
import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardClient } from './dashboard-client'
import {
  getDashboardMetrics,
  getIngresosPorMetodoPago,
  getTendenciaIngresos,
  getResumenFacturacion
} from '@/lib/actions/dashboard'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getDevolucionesPendientes } from '@/lib/actions/cajas'
import { DevolucionesPendientesAlert } from '@/components/dashboard/devoluciones-pendientes-alert'

export default async function DashboardPage() {
  // Verificar que el usuario esté autenticado
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // Obtener devoluciones pendientes
  // @ts-ignore - Ignoramos error de tipado temporalmente para agilizar, los datos son compatibles en runtime
  const devolucionesPendientes = await getDevolucionesPendientes()

  if (user.rol !== 'ADMIN') {
    return (
      <>
        <DashboardHeader
          breadcrumbs={[{ label: 'Inicio' }]}
        />

        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">
          {/* Alerta de Devoluciones Pendientes */}
          <DevolucionesPendientesAlert devoluciones={devolucionesPendientes} />

          <Card className="border-orange-200 bg-orange-50/50">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-orange-900">
                    Acceso Restringido
                  </p>
                  <p className="text-sm text-orange-700">
                    El Dashboard Ejecutivo está disponible únicamente para usuarios con rol
                    <span className="font-semibold"> ADMIN</span>. Tu rol actual es{' '}
                    <span className="font-semibold">{user.rol}</span>.
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    Para acceder a tus funciones, utiliza el menú lateral para navegar a
                    las secciones disponibles para tu rol.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accesos rápidos según rol */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            {user.rol === 'RECEPCION' && (
              <>
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Rack de Habitaciones</h3>
                    <p className="text-sm text-muted-foreground">
                      Vista visual de disponibilidad y check-in rápido
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Gestión de Cajas</h3>
                    <p className="text-sm text-muted-foreground">
                      Apertura de turno, cobros y cierre de caja
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Facturación</h3>
                    <p className="text-sm text-muted-foreground">
                      Emisión de boletas y facturas electrónicas
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {user.rol === 'HOUSEKEEPING' && (
              <Card className="hover:bg-accent cursor-pointer transition-colors">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">Estado de Habitaciones</h3>
                  <p className="text-sm text-muted-foreground">
                    Actualizar limpieza y mantenimiento de habitaciones
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </>
    )
  }

  // Cargar datos del dashboard (solo para ADMIN)
  const [metrics, ingresosPorMetodoPago, tendencia, facturacion] = await Promise.all([
    getDashboardMetrics(),
    getIngresosPorMetodoPago(),
    getTendenciaIngresos(),
    getResumenFacturacion()
  ])

  return (
    <>
      <DashboardHeader
        breadcrumbs={[{ label: 'Dashboard Ejecutivo' }]}
      />

      <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 md:p-8">
        <DashboardClient
          metrics={metrics}
          ingresosPorMetodoPago={ingresosPorMetodoPago}
          tendencia={tendencia}
          facturacion={facturacion}
          devolucionesPendientes={devolucionesPendientes}
        />
      </div>
    </>
  )
}
