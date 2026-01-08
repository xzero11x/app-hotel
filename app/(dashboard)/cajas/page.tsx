import { Suspense } from 'react'
import { getTurnoActivo, getTodosLosTurnosActivos } from '@/lib/actions/cajas'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AbrirCajaDialog } from '@/components/cajas/abrir-caja-dialog'
import { CerrarCajaDialog } from '@/components/cajas/cerrar-caja-dialog'
import { RegistrarMovimientoDialog } from '@/components/cajas/registrar-movimiento-dialog'
import { Clock, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

async function SesionActivaContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return <div>No autenticado</div>
  }

  // Obtener datos del usuario
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  const esAdmin = usuario?.rol === 'ADMIN'

  // Si es ADMIN, ver todos los turnos; si no, solo el suyo
  let turnoActivo = await getTurnoActivo()
  let todosLosTurnos: any[] = []

  if (esAdmin) {
    todosLosTurnos = await getTodosLosTurnosActivos()
  }

  // Calcular tiempo transcurrido
  const calcularTiempoTranscurrido = (fechaApertura: string) => {
    const ahora = new Date()
    const apertura = new Date(fechaApertura)
    const diffMs = ahora.getTime() - apertura.getTime()
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${diffHoras}h ${diffMinutos}m`
  }

  // Vista para ADMIN: Todos los turnos activos
  if (esAdmin && todosLosTurnos.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Todas las Cajas Activas</h2>
            <p className="text-sm text-muted-foreground">
              Monitoreando {todosLosTurnos.length} turno(s) abierto(s)
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {todosLosTurnos.map((detalle) => (
            <Card key={detalle.turno.id} className="border-green-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{detalle.turno.caja_nombre}</CardTitle>
                  <Badge variant="outline" className="bg-green-50">
                    🟢 Activo {calcularTiempoTranscurrido(detalle.turno.fecha_apertura)}
                  </Badge>
                </div>
                <CardDescription>{detalle.turno.usuario_nombre}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Monto Apertura</p>
                    <p className="text-2xl font-bold">
                      S/ {detalle.turno.monto_apertura.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Actual</p>
                    <p className="text-2xl font-bold text-green-600">
                      S/ {detalle.estadisticas.total_esperado_pen.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 text-sm">
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>+S/ {detalle.estadisticas.total_ingresos_pen.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-600">
                    <TrendingDown className="h-4 w-4" />
                    <span>-S/ {detalle.estadisticas.total_egresos_pen.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <CerrarCajaDialog
                    turnoId={detalle.turno.id}
                    totalEsperadoPen={detalle.estadisticas.total_esperado_pen}
                    totalEsperadoUsd={detalle.estadisticas.total_esperado_usd}
                    esAdmin={true}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Vista para RECEPCION: Solo su turno
  if (!turnoActivo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center space-y-2">
          <Wallet className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold">No tienes turno abierto</h2>
          <p className="text-muted-foreground">
            Abre una caja para comenzar a recibir pagos
          </p>
        </div>
        <AbrirCajaDialog />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con badge de estado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{turnoActivo.turno.caja_nombre}</h2>
          <p className="text-sm text-muted-foreground">
            Abierta hace {calcularTiempoTranscurrido(turnoActivo.turno.fecha_apertura)}
          </p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <Clock className="mr-1 h-3 w-3" />
          🟢 Turno Abierto
        </Badge>
      </div>

      {/* KPIs en tarjetas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Saldo Inicial</CardDescription>
            <CardTitle className="text-2xl">
              S/ {turnoActivo.turno.monto_apertura.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Flujo Neto</CardDescription>
            <CardTitle className={`text-2xl ${turnoActivo.estadisticas.flujo_neto_pen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {turnoActivo.estadisticas.flujo_neto_pen >= 0 ? '+' : ''}S/ {turnoActivo.estadisticas.flujo_neto_pen.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-3 w-3" />
                Ingresos: S/ {turnoActivo.estadisticas.total_ingresos_pen.toFixed(2)}
              </div>
              <div className="flex items-center gap-1 text-red-600">
                <TrendingDown className="h-3 w-3" />
                Egresos: S/ {turnoActivo.estadisticas.total_egresos_pen.toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardDescription>Total Esperado</CardDescription>
            <CardTitle className="text-2xl text-green-700">
              S/ {turnoActivo.estadisticas.total_esperado_pen.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Lo que debería haber en caja
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>USD (Opcional)</CardDescription>
            <CardTitle className="text-2xl">
              $ {turnoActivo.estadisticas.total_esperado_usd.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Botones de acción */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Registra movimientos o cierra tu turno
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <RegistrarMovimientoDialog />
          <CerrarCajaDialog
            turnoId={turnoActivo.turno.id}
            totalEsperadoPen={turnoActivo.estadisticas.total_esperado_pen}
            totalEsperadoUsd={turnoActivo.estadisticas.total_esperado_usd}
          />
        </CardContent>
      </Card>

      {/* Lista de movimientos recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
          <CardDescription>
            Últimas transacciones de este turno
          </CardDescription>
        </CardHeader>
        <CardContent>
          {turnoActivo.movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay movimientos registrados
            </p>
          ) : (
            <div className="space-y-2">
              {turnoActivo.movimientos.slice(0, 10).map((mov) => (
                <div
                  key={mov.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{mov.motivo}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(mov.created_at), 'HH:mm', { locale: es })} - {mov.usuario_nombre}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                      {mov.tipo === 'INGRESO' ? '+' : '-'}{mov.moneda === 'PEN' ? 'S/' : '$'} {mov.monto.toFixed(2)}
                    </p>
                    {mov.categoria && (
                      <p className="text-xs text-muted-foreground">{mov.categoria}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function CajasPage() {
  return (
    <div className="p-6 space-y-6">
      <Suspense fallback={<LoadingSkeleton />}>
        <SesionActivaContent />
      </Suspense>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
