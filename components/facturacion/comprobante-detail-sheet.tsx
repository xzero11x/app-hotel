'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getDetalleComprobante } from '@/lib/actions/comprobantes'
import { 
  FileText, 
  User, 
  Calendar,
  Printer,
  XCircle,
  Loader2,
  CheckCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type ComprobanteDetailSheetProps = {
  comprobanteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComprobanteDetailSheet({ comprobanteId, open, onOpenChange }: ComprobanteDetailSheetProps) {
  const [comprobante, setComprobante] = useState<any>(null)
  const [detalles, setDetalles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [anularDialogOpen, setAnularDialogOpen] = useState(false)

  useEffect(() => {
    if (open && comprobanteId) {
      cargarDatos()
    }
  }, [open, comprobanteId])

  async function cargarDatos() {
    try {
      setLoading(true)
      const { comprobante: comp, detalles: dets } = await getDetalleComprobante(comprobanteId)
      setComprobante(comp)
      setDetalles(dets)
    } catch (error) {
      console.error('Error al cargar comprobante:', error)
      toast.error('Error al cargar el detalle del comprobante')
    } finally {
      setLoading(false)
    }
  }

  function getEstadoBadge(estado: string) {
    const variants: Record<string, { color: string; label: string }> = {
      'PENDIENTE': { color: 'bg-yellow-500 text-white', label: 'Pendiente SUNAT' },
      'ACEPTADO': { color: 'bg-green-500 text-white', label: 'Aceptado SUNAT' },
      'RECHAZADO': { color: 'bg-red-500 text-white', label: 'Rechazado SUNAT' },
      'ANULADO': { color: 'bg-gray-500 text-white', label: 'Anulado' }
    }

    const config = variants[estado] || { color: 'bg-gray-400 text-white', label: estado }

    return (
      <Badge className={`${config.color} text-base`}>
        {config.label}
      </Badge>
    )
  }

  async function handleImprimir() {
    toast.info('Función de impresión en desarrollo')
    // TODO: Implementar generación de PDF
  }

  async function handleAnular() {
    setActionLoading(true)
    try {
      // TODO: Llamar a anularComprobante()
      toast.success('Comprobante anulado correctamente')
      await cargarDatos()
      setAnularDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Error al anular el comprobante')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !comprobante) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-3xl">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const puedeAnular = comprobante.estado_sunat === 'ACEPTADO'
  const esAnulado = comprobante.estado_sunat === 'ANULADO'
  const numero_completo = `${comprobante.serie}-${comprobante.numero.toString().padStart(8, '0')}`

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-3xl flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-2xl">Detalle de Comprobante</SheetTitle>
            <SheetDescription>
              {comprobante.tipo_comprobante} {numero_completo}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 py-4">
              {/* Cabecera del Comprobante */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Información General</CardTitle>
                    {getEstadoBadge(comprobante.estado_sunat)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Tipo de Documento</p>
                        <p className="text-lg font-bold">{comprobante.tipo_comprobante}</p>
                        <p className="text-sm text-muted-foreground">{numero_completo}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Fecha de Emisión</p>
                        <p className="text-base">
                          {format(new Date(comprobante.fecha_emision), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(comprobante.fecha_emision), 'HH:mm', { locale: es })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Datos del Cliente */}
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Cliente</p>
                      <p className="font-semibold text-base">{comprobante.receptor_razon_social}</p>
                      <p className="text-sm text-muted-foreground">
                        {comprobante.receptor_tipo_doc}: {comprobante.receptor_nro_doc}
                      </p>
                      {comprobante.receptor_direccion && (
                        <p className="text-sm text-muted-foreground">{comprobante.receptor_direccion}</p>
                      )}
                    </div>
                  </div>

                  {/* Contexto de Venta */}
                  {comprobante.reservas && (
                    <div>
                      <Separator className="my-3" />
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm font-medium mb-1">Contexto de Venta</p>
                        <p className="text-sm">
                          Reserva: <span className="font-mono">{comprobante.reservas.codigo_reserva}</span>
                        </p>
                        {comprobante.reservas.habitaciones && (
                          <p className="text-sm">
                            Habitación {comprobante.reservas.habitaciones.numero} - Piso {comprobante.reservas.habitaciones.piso}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Items del Comprobante */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalle de Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">P. Unitario</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No hay items registrados
                          </TableCell>
                        </TableRow>
                      ) : (
                        detalles.map((detalle, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{detalle.cantidad}</TableCell>
                            <TableCell>{detalle.descripcion}</TableCell>
                            <TableCell className="text-right">
                              {comprobante.moneda} {detalle.precio_unitario.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {comprobante.moneda} {detalle.subtotal.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Totales Tributarios */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumen Tributario</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Op. Gravadas:</span>
                    <span className="font-medium">{comprobante.moneda} {comprobante.op_gravadas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Op. Exoneradas:</span>
                    <span className="font-medium">{comprobante.moneda} {comprobante.op_exoneradas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Op. Inafectas:</span>
                    <span className="font-medium">{comprobante.moneda} {comprobante.op_inafectas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IGV (18%):</span>
                    <span className="font-medium">{comprobante.moneda} {comprobante.monto_igv.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>TOTAL:</span>
                    <span className="text-primary">{comprobante.moneda} {comprobante.total_venta.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Información SUNAT */}
              {comprobante.hash_cpe && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Información SUNAT</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Hash CPE:</span>
                      <p className="font-mono text-xs break-all mt-1">{comprobante.hash_cpe}</p>
                    </div>
                    {comprobante.xml_url && (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <a href={comprobante.xml_url} target="_blank" rel="noopener noreferrer">
                          Descargar XML
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Botonera de Acciones */}
              <div className="flex gap-3">
                <Button className="flex-1" variant="outline" onClick={handleImprimir}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                {puedeAnular && (
                  <Button 
                    className="flex-1" 
                    variant="destructive"
                    onClick={() => setAnularDialogOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Anular
                  </Button>
                )}
              </div>

              {esAnulado && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Comprobante Anulado</p>
                    <p className="text-sm text-red-600">Este documento ha sido anulado y no tiene validez fiscal</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Dialog de Anulación */}
      <AlertDialog open={anularDialogOpen} onOpenChange={setAnularDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Anular Comprobante</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de anular el comprobante <strong>{numero_completo}</strong>.
              <br /><br />
              Esta acción generará una Nota de Crédito en SUNAT y el comprobante quedará sin validez fiscal.
              <br /><br />
              ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnular} disabled={actionLoading} className="bg-red-600 hover:bg-red-700">
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Anulación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
