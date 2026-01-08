'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  getDetalleReserva, 
  getHuespedesDeReserva,
  type OcupacionReserva 
} from '@/lib/actions/ocupaciones'
import { getPagosByReserva } from '@/lib/actions/pagos'
import { realizarCheckin } from '@/lib/actions/checkin'
import { 
  realizarCheckout,
  validarCheckout
} from '@/lib/actions/checkout'
import { registrarPago, getTotalPagado, getSaldoPendiente } from '@/lib/actions/pagos'
import { 
  DoorOpen, 
  DoorClosed, 
  CreditCard, 
  Receipt, 
  Calendar,
  User,
  Hotel,
  AlertCircle,
  CheckCircle,
  Loader2
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ReservationDetailSheetProps = {
  reservaId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReservationDetailSheet({ reservaId, open, onOpenChange }: ReservationDetailSheetProps) {
  const [reserva, setReserva] = useState<OcupacionReserva | null>(null)
  const [huespedes, setHuespedes] = useState<any[]>([])
  const [pagos, setPagos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Dialogs
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [forceCheckout, setForceCheckout] = useState(false)
  
  // Form pago
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [referenciaPago, setReferenciaPago] = useState('')
  const [notaPago, setNotaPago] = useState('')

  useEffect(() => {
    if (open && reservaId) {
      cargarDatos()
    }
  }, [open, reservaId])

  async function cargarDatos() {
    try {
      setLoading(true)
      const [detalleData, huespedesData, pagosData] = await Promise.all([
        getDetalleReserva(reservaId),
        getHuespedesDeReserva(reservaId),
        getPagosByReserva(reservaId)
      ])
      
      setReserva(detalleData)
      setHuespedes(huespedesData)
      setPagos(pagosData)
    } catch (error) {
      console.error('Error al cargar datos:', error)
      toast.error('Error al cargar los detalles de la reserva')
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckin() {
    if (!reserva) return
    
    try {
      setActionLoading(true)
      await realizarCheckin(reserva.id)
      toast.success('Check-in realizado exitosamente')
      await cargarDatos()
      setCheckinDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Error al realizar check-in')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCheckout() {
    if (!reserva) return
    
    try {
      setActionLoading(true)
      
      // Validar si tiene deuda
      const validation = await validarCheckout(reserva.id)
      
      if (!validation.puede_checkout && !forceCheckout) {
        // Mostrar confirmación si tiene deuda
        setForceCheckout(true)
        setCheckoutDialogOpen(true)
        setActionLoading(false)
        return
      }
      
      await realizarCheckout({ 
        reserva_id: reserva.id, 
        forzar_checkout: forceCheckout 
      })
      toast.success('Check-out realizado exitosamente')
      await cargarDatos()
      setCheckoutDialogOpen(false)
      setForceCheckout(false)
    } catch (error: any) {
      toast.error(error.message || 'Error al realizar check-out')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRegistrarPago() {
    if (!reserva || !montoPago) {
      toast.error('Ingrese el monto del pago')
      return
    }

    const monto = parseFloat(montoPago)
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingrese un monto válido')
      return
    }

    try {
      setActionLoading(true)
      await registrarPago({
        reserva_id: reserva.id,
        caja_turno_id: '', // Se obtendrá automáticamente
        monto,
        metodo_pago: metodoPago as 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'YAPE' | 'PLIN' | 'OTRO',
        referencia_pago: referenciaPago || undefined,
        nota: notaPago || undefined
      })
      
      toast.success('Pago registrado exitosamente')
      
      // Limpiar formulario
      setMontoPago('')
      setMetodoPago('EFECTIVO')
      setReferenciaPago('')
      setNotaPago('')
      
      // Recargar datos
      await cargarDatos()
      setPagoDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar el pago')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !reserva) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const esReservada = reserva.estado === 'RESERVADA'
  const esCheckedIn = reserva.estado === 'CHECKED_IN'
  const esCheckedOut = reserva.estado === 'CHECKED_OUT'
  const tieneDeuda = reserva.saldo_pendiente > 0

  const titular = huespedes.find(h => h.es_titular)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-3xl flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-2xl">Detalle de Reserva</SheetTitle>
            <SheetDescription>
              {reserva.codigo_reserva} • Habitación {reserva.habitacion_numero}
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="general" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="cuenta">Estado de Cuenta</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 -mx-6 px-6">
              {/* TAB: GENERAL */}
              <TabsContent value="general" className="space-y-4 mt-4">
                {/* Estado actual */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Estado Actual</CardTitle>
                      <Badge variant={esCheckedIn ? 'default' : esReservada ? 'outline' : 'secondary'}>
                        {reserva.estado.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Información de habitación */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <Hotel className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Habitación</p>
                          <p className="text-lg font-bold">{reserva.habitacion_numero}</p>
                          <p className="text-sm text-muted-foreground">
                            Piso {reserva.habitacion_piso} • {reserva.tipo_habitacion}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Fechas</p>
                          <p className="text-sm">
                            {format(new Date(reserva.fecha_entrada), 'dd MMM yyyy', { locale: es })}
                          </p>
                          <p className="text-sm">
                            {format(new Date(reserva.fecha_salida), 'dd MMM yyyy', { locale: es })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {reserva.total_noches} {reserva.total_noches === 1 ? 'noche' : 'noches'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Huésped titular */}
                    {titular && (
                      <div>
                        <Separator className="my-4" />
                        <div className="flex items-start gap-3">
                          <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Huésped Titular</p>
                            <p className="font-semibold">{reserva.titular_nombre}</p>
                            <p className="text-sm text-muted-foreground">
                              {reserva.titular_tipo_doc} {reserva.titular_numero_doc}
                            </p>
                            {reserva.titular_correo && (
                              <p className="text-sm text-muted-foreground">{reserva.titular_correo}</p>
                            )}
                            {reserva.titular_telefono && (
                              <p className="text-sm text-muted-foreground">{reserva.titular_telefono}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Acompañantes */}
                    {huespedes.length > 1 && (
                      <div>
                        <Separator className="my-4" />
                        <p className="text-sm font-medium mb-2">Acompañantes ({huespedes.length - 1})</p>
                        <div className="space-y-2">
                          {huespedes
                            .filter(h => !h.es_titular)
                            .map((h, idx) => (
                              <div key={idx} className="text-sm flex items-center gap-2 p-2 bg-muted/50 rounded">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {h.huespedes.nombres} {h.huespedes.apellidos} • {h.huespedes.tipo_documento} {h.huespedes.numero_documento}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Acciones según estado */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Acciones Disponibles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {esReservada && (
                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={() => setCheckinDialogOpen(true)}
                        disabled={actionLoading}
                      >
                        <DoorOpen className="h-5 w-5 mr-2" />
                        Hacer Check-in
                      </Button>
                    )}

                    {esCheckedIn && (
                      <>
                        {tieneDeuda && (
                          <Button 
                            className="w-full" 
                            size="lg"
                            variant="default"
                            onClick={() => setPagoDialogOpen(true)}
                            disabled={actionLoading}
                          >
                            <CreditCard className="h-5 w-5 mr-2" />
                            Registrar Pago (Debe S/ {reserva.saldo_pendiente.toFixed(2)})
                          </Button>
                        )}
                        
                        <Button 
                          className="w-full" 
                          size="lg"
                          variant={tieneDeuda ? 'outline' : 'default'}
                          onClick={() => setCheckoutDialogOpen(true)}
                          disabled={actionLoading}
                        >
                          <DoorClosed className="h-5 w-5 mr-2" />
                          Hacer Check-out
                          {tieneDeuda && ' (con deuda)'}
                        </Button>
                      </>
                    )}

                    {esCheckedOut && (
                      <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">Check-out Completado</p>
                          <p className="text-sm text-muted-foreground">
                            {reserva.check_out_real && format(new Date(reserva.check_out_real), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: ESTADO DE CUENTA */}
              <TabsContent value="cuenta" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Resumen Financiero</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Estimado</p>
                        <p className="text-2xl font-bold">S/ {reserva.total_estimado.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          S/ {reserva.precio_pactado.toFixed(2)} × {reserva.total_noches} {reserva.total_noches === 1 ? 'noche' : 'noches'}
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Pagado</p>
                        <p className="text-2xl font-bold text-green-600">S/ {reserva.total_pagado.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {pagos.length} {pagos.length === 1 ? 'pago' : 'pagos'} registrado{pagos.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="p-4 bg-primary/5 border-2 border-primary rounded-lg">
                      <p className="text-sm font-medium">SALDO PENDIENTE</p>
                      <p className={`text-3xl font-bold ${tieneDeuda ? 'text-destructive' : 'text-green-600'}`}>
                        S/ {reserva.saldo_pendiente.toFixed(2)}
                      </p>
                      {tieneDeuda && (
                        <div className="flex items-center gap-2 mt-2">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <p className="text-sm text-destructive">Pendiente de pago</p>
                        </div>
                      )}
                      {!tieneDeuda && (
                        <div className="flex items-center gap-2 mt-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <p className="text-sm text-green-600">Completamente pagado</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Historial de Pagos</CardTitle>
                      <CardDescription>{pagos.length} pagos registrados</CardDescription>
                    </div>
                    {esCheckedIn && (
                      <Button onClick={() => setPagoDialogOpen(true)} size="sm">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Agregar Pago
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {pagos.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No hay pagos registrados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pagos.map((pago) => (
                          <div key={pago.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <CreditCard className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">S/ {pago.monto.toFixed(2)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {pago.metodo_pago} 
                                  {pago.referencia_pago && ` • ${pago.referencia_pago}`}
                                </p>
                                {pago.nota && (
                                  <p className="text-xs text-muted-foreground italic">{pago.nota}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">
                                {format(new Date(pago.fecha_pago), 'dd MMM yyyy', { locale: es })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(pago.fecha_pago), 'HH:mm', { locale: es })}
                              </p>
                              {pago.comprobantes && (
                                <Badge variant="outline" className="mt-1">
                                  {pago.comprobantes.tipo_comprobante} {pago.comprobantes.numero_completo}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: HISTORIAL */}
              <TabsContent value="historial" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Auditoría de Cambios</CardTitle>
                    <CardDescription>Próximamente: registro de todas las modificaciones</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Esta funcionalidad estará disponible pronto</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Dialog: Check-in */}
      <AlertDialog open={checkinDialogOpen} onOpenChange={setCheckinDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Check-in</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Desea realizar el check-in de <strong>{reserva.titular_nombre}</strong> en la habitación <strong>{reserva.habitacion_numero}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCheckin} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Check-in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Check-out */}
      <AlertDialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tieneDeuda && !forceCheckout ? '⚠️ Check-out con Deuda' : 'Confirmar Check-out'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tieneDeuda && !forceCheckout ? (
                <>
                  El huésped tiene un saldo pendiente de <strong className="text-destructive">S/ {reserva.saldo_pendiente.toFixed(2)}</strong>.
                  <br /><br />
                  ¿Desea forzar el check-out de todas formas?
                </>
              ) : (
                <>
                  ¿Desea realizar el check-out de <strong>{reserva.titular_nombre}</strong> de la habitación <strong>{reserva.habitacion_numero}</strong>?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setForceCheckout(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCheckout} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tieneDeuda && !forceCheckout ? 'Forzar Check-out' : 'Confirmar Check-out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Registrar Pago */}
      <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Saldo pendiente: <strong className="text-destructive">S/ {reserva.saldo_pendiente.toFixed(2)}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="monto">Monto (S/)</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="metodo">Método de Pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger id="metodo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TARJETA">Tarjeta</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="YAPE">Yape</SelectItem>
                  <SelectItem value="PLIN">Plin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {metodoPago !== 'EFECTIVO' && (
              <div>
                <Label htmlFor="referencia">Número de Operación</Label>
                <Input
                  id="referencia"
                  placeholder="Ej: 1234567890"
                  value={referenciaPago}
                  onChange={(e) => setReferenciaPago(e.target.value)}
                />
              </div>
            )}

            <div>
              <Label htmlFor="nota">Nota (opcional)</Label>
              <Input
                id="nota"
                placeholder="Ej: Adelanto, Pago parcial..."
                value={notaPago}
                onChange={(e) => setNotaPago(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarPago} disabled={actionLoading || !montoPago}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
