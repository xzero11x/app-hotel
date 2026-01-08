'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getDetalleTurnoCerrado, type DetalleTurno } from '@/lib/actions/cajas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Receipt } from 'lucide-react'

interface Props {
  turnoId: string | null
  open: boolean
  onClose: () => void
}

export function TurnoDetailSheet({ turnoId, open, onClose }: Props) {
  const [detalle, setDetalle] = useState<DetalleTurno | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && turnoId) {
      loadDetalle()
    }
  }, [open, turnoId])

  const loadDetalle = async () => {
    if (!turnoId) return
    setLoading(true)
    try {
      const data = await getDetalleTurnoCerrado(turnoId)
      setDetalle(data)
    } catch (error) {
      console.error('Error al cargar detalle:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDiferenciaBadge = () => {
    if (!detalle?.estadisticas.diferencia_pen) return null
    const dif = detalle.estadisticas.diferencia_pen

    if (Math.abs(dif) < 0.01) {
      return <Badge className="bg-green-100 text-green-800 border-green-300">🟢 CUADRADA</Badge>
    } else if (dif < 0) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">🔴 FALTANTE</Badge>
    } else {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300">🔵 SOBRANTE</Badge>
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ) : detalle ? (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <SheetTitle>{detalle.turno.caja_nombre}</SheetTitle>
                {getDiferenciaBadge()}
              </div>
              <SheetDescription>
                {detalle.turno.usuario_nombre} • Cerrado el {' '}
                {format(new Date(detalle.turno.fecha_cierre!), 'dd/MM/yyyy HH:mm', { locale: es })}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Resumen Financiero */}
              <div className="space-y-3">
                <h3 className="font-semibold">Resumen Financiero</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Saldo Inicial</CardTitle>
                      <p className="text-2xl font-bold">S/ {detalle.turno.monto_apertura.toFixed(2)}</p>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Flujo Neto</CardTitle>
                      <p className={`text-2xl font-bold ${detalle.estadisticas.flujo_neto_pen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {detalle.estadisticas.flujo_neto_pen >= 0 ? '+' : ''}S/ {detalle.estadisticas.flujo_neto_pen.toFixed(2)}
                      </p>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        Ingresos: S/ {detalle.estadisticas.total_ingresos_pen.toFixed(2)}
                      </div>
                      <div className="flex items-center gap-1 text-red-600">
                        <TrendingDown className="h-3 w-3" />
                        Egresos: S/ {detalle.estadisticas.total_egresos_pen.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Total Esperado</CardTitle>
                      <p className="text-2xl font-bold text-green-700">
                        S/ {detalle.estadisticas.total_esperado_pen.toFixed(2)}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">Lo que debería haber</p>
                    </CardContent>
                  </Card>

                  <Card className={
                    Math.abs(detalle.estadisticas.diferencia_pen || 0) < 0.01 
                      ? 'border-green-200 bg-green-50/50' 
                      : (detalle.estadisticas.diferencia_pen || 0) < 0 
                        ? 'border-red-200 bg-red-50/50' 
                        : 'border-blue-200 bg-blue-50/50'
                  }>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Diferencia</CardTitle>
                      <p className={`text-2xl font-bold ${
                        Math.abs(detalle.estadisticas.diferencia_pen || 0) < 0.01 
                          ? 'text-green-700' 
                          : (detalle.estadisticas.diferencia_pen || 0) < 0 
                            ? 'text-red-700' 
                            : 'text-blue-700'
                      }`}>
                        {(detalle.estadisticas.diferencia_pen || 0) >= 0 ? '+' : ''}S/ {(detalle.estadisticas.diferencia_pen || 0).toFixed(2)}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs">
                        Real: S/ {(detalle.turno.monto_cierre_declarado || 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Lista de Movimientos */}
              <div className="space-y-3">
                <h3 className="font-semibold">Movimientos ({detalle.movimientos.length})</h3>
                {detalle.movimientos.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No hay movimientos registrados</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hora</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalle.movimientos.map((mov) => (
                          <TableRow key={mov.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(mov.created_at), 'HH:mm', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={mov.tipo === 'INGRESO' ? 'default' : 'destructive'}
                                className={mov.tipo === 'INGRESO' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                              >
                                {mov.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{mov.motivo}</p>
                                {mov.categoria && (
                                  <p className="text-xs text-muted-foreground">{mov.categoria}</p>
                                )}
                                {mov.comprobante_referencia && (
                                  <p className="text-xs text-blue-600">Ref: {mov.comprobante_referencia}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {mov.tipo === 'INGRESO' ? '+' : '-'}{mov.moneda === 'PEN' ? 'S/' : '$'} {mov.monto.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Info de apertura */}
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-sm">Información del Turno</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Apertura:</span>
                    <span className="font-medium">
                      {format(new Date(detalle.turno.fecha_apertura), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cierre:</span>
                    <span className="font-medium">
                      {format(new Date(detalle.turno.fecha_cierre!), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Responsable:</span>
                    <span className="font-medium">{detalle.turno.usuario_nombre}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No se pudo cargar el detalle
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
