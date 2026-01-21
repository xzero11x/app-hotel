'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getDetalleTurnoCerrado, getReporteMetodosPago, type DetalleTurno } from '@/lib/actions/cajas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft,
  Flag,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calculator,
  CheckCircle,
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Receipt,
  DollarSign,
  RotateCcw,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'

type Props = {
  turnoId: string
  turnoInicial: DetalleTurno
}

function RenderMotivo({ motivo }: { motivo: string }) {
  const regex = /Reserva\s+([A-Z0-9-]+)/i
  const match = motivo.match(regex)

  if (match && match[1]) {
    const codigo = match[1]
    const partes = motivo.split(codigo)

    return (
      <span className="flex items-center gap-1">
        {partes[0]}
        <Link
          href={`/reservas?search=${codigo}`}
          className="font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {codigo}
          <ExternalLink className="h-3 w-3" />
        </Link>
        {partes[1]}
      </span>
    )
  }

  return <span>{motivo}</span>
}

export function DetalleTurnoClient({ turnoId, turnoInicial }: Props) {
  const [turno, setTurno] = useState<DetalleTurno>(turnoInicial)
  const [desglosePagos, setDesglosePagos] = useState<any>(null)

  useEffect(() => {
    cargarDatosAdicionales()
  }, [turnoId])

  const cargarDatosAdicionales = async () => {
    try {
      // Recargar detalle turno por si acaso
      const detalleActualizado = await getDetalleTurnoCerrado(turnoId).catch(() => null)
      if (detalleActualizado) setTurno(detalleActualizado)

      // Cargar desglose de pagos real
      const reportePagos = await getReporteMetodosPago(turnoId)
      if (reportePagos.success) {
        setDesglosePagos(reportePagos.data)
      }
    } catch (error) {
      console.error("Error cargando datos adicionales", error)
    }
  }

  const t = turno.turno
  const stats = turno.estadisticas
  const esCerrada = t.estado === 'CERRADA'

  const diferencia = (t.monto_cierre_real_efectivo || 0) - (t.monto_cierre_teorico_efectivo || stats.total_esperado_pen)

  // Usar datos del reporte de pagos si existen, sino 0 (evitar undefined)
  const porMetodo = desglosePagos || {
    totalEfectivoPEN: 0,
    totalTarjeta: 0,
    totalYape: 0,
    totalPlin: 0,
    totalTransferencia: 0,
    totalGeneral: 0
  }

  // Combinar Yape y Plin para visualización
  const totalBilleteras = porMetodo.totalYape + porMetodo.totalPlin

  // Analítica de Movimientos
  const movimientosIngresos = turno.movimientos.filter(m => m.tipo === 'INGRESO')
  const movimientosEgresos = turno.movimientos.filter(m => m.tipo === 'EGRESO')

  // Calcular devoluciones (egresos con categoría DEVOLUCION o motivo que contenga "Devolución")
  const movimientosDevoluciones = movimientosEgresos.filter(m =>
    m.categoria === 'DEVOLUCION' ||
    (m.motivo && m.motivo.toLowerCase().includes('devolución'))
  )
  const cantidadDevoluciones = movimientosDevoluciones.length
  const montoDevoluciones = movimientosDevoluciones.reduce((acc, m) => acc + (m.monto || 0), 0)

  const cantidadVentas = movimientosIngresos.length
  const ticketPromedio = cantidadVentas > 0 ? stats.total_ingresos_pen / cantidadVentas : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/cajas">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {t.caja_nombre} - Detalle de Sesión
          </h1>
          <p className="text-sm text-muted-foreground">
            Cajero: {t.usuario_nombre}
          </p>
        </div>
      </div>

      {/* Fecha de cierre */}
      {esCerrada && t.fecha_cierre && (
        <div className="bg-muted/50 border rounded-lg px-4 py-3 text-sm text-muted-foreground">
          Esta sesión fue cerrada el {format(new Date(t.fecha_cierre), "d 'de' MMMM, yyyy, h:mm a", { locale: es })}
        </div>
      )}

      {/* CÁLCULO DE BALANCE TOTAL */}
      {(() => {
        const balanceTotal = t.monto_apertura_efectivo + stats.total_ingresos_pen - stats.total_egresos_pen

        return (
          <>
            {/* KPIs Fila 1 - Resumen Financiero Global */}
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Resumen Financiero Global</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* Saldo Inicial */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                    <Flag className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold mt-2">
                    S/ {t.monto_apertura_efectivo.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              {/* Total Ingresos */}
              <Card className="border-green-100">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-green-600 font-medium">Total Ingresos</p>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    S/ {stats.total_ingresos_pen.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              {/* Total Egresos */}
              <Card className="border-red-100">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-red-600 font-medium">Total Egresos</p>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    S/ {stats.total_egresos_pen.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              {/* Balance Total (Todo) */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-purple-700 font-medium">Balance Total (Global)</p>
                    <DollarSign className="h-4 w-4 text-purple-700" />
                  </div>
                  <p className="text-2xl font-bold text-purple-700 mt-2">
                    S/ {balanceTotal.toFixed(2)}
                  </p>
                  <p className="text-xs text-purple-600/80 mt-1">
                    Efectivo + Bancos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* KPIs Fila 2 - Control de Efectivo */}
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Control de Efectivo (Caja Física)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Efectivo Teórico (Sistema) */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-blue-700 font-medium">Efectivo Teórico (Sistema)</p>
                    <Wallet className="h-4 w-4 text-blue-700" />
                  </div>
                  <p className="text-2xl font-bold text-blue-700 mt-2">
                    S/ {(t.monto_cierre_teorico_efectivo || stats.total_esperado_pen).toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-600/80 mt-1">
                    Debe haber en cajón
                  </p>
                </CardContent>
              </Card>

              {/* Solo si cerrada: Efectivo Declarado y Diferencia */}
              {esCerrada && (
                <>
                  {/* Efectivo Declarado */}
                  <Card className="border-pink-200 bg-pink-50/50">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <p className="text-sm text-pink-700 font-medium">Efectivo Declarado (Real)</p>
                        <Calculator className="h-4 w-4 text-pink-700" />
                      </div>
                      <p className="text-2xl font-bold text-pink-700 mt-2">
                        S/ {(t.monto_cierre_real_efectivo || 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Diferencia */}
                  <Card className={`${Math.abs(diferencia) < 0.5 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <p className={`text-sm font-medium ${Math.abs(diferencia) < 0.5 ? 'text-green-700' : 'text-red-700'}`}>
                          Diferencia
                        </p>
                        <CheckCircle className={`h-4 w-4 ${Math.abs(diferencia) < 0.5 ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <p className={`text-2xl font-bold mt-2 ${Math.abs(diferencia) < 0.5 ? 'text-green-700' : 'text-red-700'}`}>
                        S/ {diferencia.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </>
        )
      })()}

      {/* Cards inferiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Por Método de Pago */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por Método de Pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetodoPagoItem
              icon={<Banknote className="h-4 w-4" />}
              nombre="Efectivo"
              descripcion={`Incluye apertura S/ ${t.monto_apertura_efectivo.toFixed(2)}`}
              monto={porMetodo.totalEfectivoPEN + t.monto_apertura_efectivo} // Ajustamos visualización para incluir apertura como en sidebar
            />
            <Separator />
            <MetodoPagoItem
              icon={<CreditCard className="h-4 w-4" />}
              nombre="Tarjetas"
              descripcion="Debe cuadrar con el cierre del POS"
              monto={porMetodo.totalTarjeta}
            />
            <Separator />
            <MetodoPagoItem
              icon={<Smartphone className="h-4 w-4" />}
              nombre="Billeteras (Yape/Plin)"
              descripcion="Debe cuadrar con el celular"
              monto={totalBilleteras}
            />
            <Separator />
            <MetodoPagoItem
              icon={<Building2 className="h-4 w-4" />}
              nombre="Transferencias"
              monto={porMetodo.totalTransferencia}
            />
          </CardContent>
        </Card>

        {/* Resumen Operativo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumen Operativo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Receipt className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Cantidad de Ventas</p>
                <p className="font-semibold">{cantidadVentas} tickets</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Ticket Promedio</p>
                <p className="font-semibold">S/ {ticketPromedio.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <RotateCcw className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Cantidad de Devoluciones</p>
                <p className="font-semibold">
                  {cantidadDevoluciones} <span className="text-muted-foreground font-normal">(S/ {montoDevoluciones.toFixed(2)})</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Línea de Tiempo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Línea de Tiempo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Todas las transacciones ordenadas cronológicamente
          </p>
        </CardHeader>
        <CardContent>
          {turno.movimientos.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No hay movimientos registrados
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Hora</TableHead>
                  <TableHead className="w-28">Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turno.movimientos.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(mov.created_at), 'HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={mov.tipo === 'INGRESO'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-red-100 text-red-700 border-red-200'
                        }
                      >
                        {mov.tipo === 'INGRESO' ? '→' : '←'} {mov.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RenderMotivo motivo={mov.motivo} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {mov.comprobante_referencia || 'N/A'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                      {mov.tipo === 'INGRESO' ? '+' : '-'} S/ {mov.monto.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetodoPagoItem({
  icon,
  nombre,
  descripcion,
  monto
}: {
  icon: React.ReactNode
  nombre: string
  descripcion?: string
  monto: number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <p className="font-medium text-sm">{nombre}</p>
          {descripcion && (
            <p className="text-xs text-muted-foreground">{descripcion}</p>
          )}
        </div>
      </div>
      <p className="font-semibold">S/ {monto.toFixed(2)}</p>
    </div>
  )
}
