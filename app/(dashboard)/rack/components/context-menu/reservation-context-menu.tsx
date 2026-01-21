'use client'

import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogIn, CreditCard, XCircle, Loader2, LogOut, CalendarDays, ArrowRight, ArrowLeft, Clock } from 'lucide-react'
import { RegistrarPagoDialog } from '@/components/cajas/registrar-pago-dialog'
import { LateCheckoutDialog } from '../dialogs/late-checkout-dialog'
import { RefundMethodDialog, type MetodoDevolucion } from '@/components/rack/refund-method-dialog'
import { realizarCheckin } from '@/lib/actions/checkin'
import { realizarCheckout, validarCheckout } from '@/lib/actions/checkout'
import { cancelarReserva } from '@/lib/actions/reservas'
import { calcularResumenCambio, redimensionarEstadia } from '@/lib/actions/estadias'
import { getEfectivoDisponibleTurno } from '@/lib/actions/cajas'
import { format, isToday, addDays, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import type { RackReserva, RackHabitacion } from '@/types/rack'

type Props = {
  children: React.ReactNode
  reserva: RackReserva
  onUpdate: () => void
  // Función para actualización optimista de habitación
  updateHabitacionOptimistic?: (habitacionId: string, updates: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>) => void
  // Función para eliminar reserva del estado local
  removeReservaOptimistic?: (reservaId: string) => void
}

export function ReservationContextMenu({ children, reserva, onUpdate, updateHabitacionOptimistic, removeReservaOptimistic }: Props) {
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [cancelarDialogOpen, setCancelarDialogOpen] = useState(false)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [estadiaDialogOpen, setEstadiaDialogOpen] = useState(false)
  const [lateCheckoutDialogOpen, setLateCheckoutDialogOpen] = useState(false)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false) // Nuevo
  const [procesando, setProcesando] = useState(false)

  // Estados para modificar estadía
  const [nuevaFechaSalida, setNuevaFechaSalida] = useState('')
  const [resumenCambio, setResumenCambio] = useState<{
    diasOriginales: number
    diasNuevos: number
    diferenciaDias: number
    diferenciaMonto: number
    requiereFacturaExtra: boolean
    requiereNotaCredito: boolean
  } | null>(null)

  // Estados para checkout con deuda
  const [forceCheckoutNeeded, setForceCheckoutNeeded] = useState(false)
  const [deudaPendiente, setDeudaPendiente] = useState(0)

  // Estados para devolución
  const [efectivoDisponible, setEfectivoDisponible] = useState(0)

  const fechaEntrada = new Date(reserva.fecha_entrada)
  const puedeHacerCheckin = isToday(fechaEntrada) && reserva.estado === 'RESERVADA'
  const puedeHacerCheckout = reserva.estado === 'CHECKED_IN'

  const handleCheckInRapido = async () => {
    if (!puedeHacerCheckin) return

    setProcesando(true)

    // OPTIMISTIC UPDATE: Actualizar habitación a OCUPADA inmediatamente
    if (updateHabitacionOptimistic && reserva.habitacion_id) {
      updateHabitacionOptimistic(reserva.habitacion_id, {
        estado_ocupacion: 'OCUPADA'
      })
    }

    try {
      const result = await realizarCheckin(reserva.id)

      if (result.error) {
        // ROLLBACK si falla
        if (updateHabitacionOptimistic && reserva.habitacion_id) {
          updateHabitacionOptimistic(reserva.habitacion_id, {
            estado_ocupacion: 'LIBRE'
          })
        }
        toast.error('Error en Check-in', {
          description: result.message || result.error
        })
      } else {
        toast.success('Check-in realizado', {
          description: `Habitación ${reserva.habitaciones?.numero} ocupada`
        })
      }
    } catch (error) {
      console.error('Error en check-in:', error)
      // ROLLBACK si hay error
      if (updateHabitacionOptimistic && reserva.habitacion_id) {
        updateHabitacionOptimistic(reserva.habitacion_id, {
          estado_ocupacion: 'LIBRE'
        })
      }
      toast.error('Error al hacer check-in')
    } finally {
      setProcesando(false)
    }
  }

  const handleCancelarReserva = async () => {
    setProcesando(true)
    try {
      const result = await cancelarReserva(reserva.id)

      if (result.error) {
        toast.error('Error al cancelar', {
          description: result.message || result.error
        })
      } else {
        toast.success('Reserva cancelada', {
          description: `Reserva ${reserva.codigo_reserva} ha sido cancelada`
        })
        setCancelarDialogOpen(false)
        onUpdate()
      }
    } catch (error) {
      console.error('Error al cancelar:', error)
      toast.error('Error al cancelar la reserva')
    } finally {
      setProcesando(false)
    }
  }

  const iniciarCheckout = async () => {
    setProcesando(true)
    try {
      const validacion = await validarCheckout(reserva.id)
      if (!validacion.puede_checkout) {
        setDeudaPendiente(validacion.saldo_pendiente || 0)
        setForceCheckoutNeeded(true)
        setCheckoutDialogOpen(true)
      } else {
        setForceCheckoutNeeded(false)
        setCheckoutDialogOpen(true)
      }
    } catch (error) {
      console.error('Error validando checkout:', error)
      toast.error('Error al validar checkout')
    } finally {
      setProcesando(false)
    }
  }

  const confirmarCheckout = async (forzar = false) => {
    setProcesando(true)

    // OPTIMISTIC UPDATE: Actualizar habitación a LIBRE y SUCIA inmediatamente
    if (updateHabitacionOptimistic && reserva.habitacion_id) {
      updateHabitacionOptimistic(reserva.habitacion_id, {
        estado_ocupacion: 'LIBRE',
        estado_limpieza: 'SUCIA'
      })
    }

    // OPTIMISTIC UPDATE: Eliminar reserva del rack inmediatamente
    if (removeReservaOptimistic) {
      removeReservaOptimistic(reserva.id)
    }

    try {
      const result = await realizarCheckout({
        reserva_id: reserva.id,
        forzar_checkout: forzar
      })

      if (!result.success) {
        // ROLLBACK si falla: volver a OCUPADA
        if (updateHabitacionOptimistic && reserva.habitacion_id) {
          updateHabitacionOptimistic(reserva.habitacion_id, {
            estado_ocupacion: 'OCUPADA'
          })
        }
        toast.error('Error en check-out', {
          description: result.message || 'No se pudo completar el checkout'
        })
        return
      }

      setCheckoutDialogOpen(false)
      setForceCheckoutNeeded(false)
      toast.success('Check-out completado', {
        description: `Habitación ${reserva.habitaciones?.numero} liberada`
      })
    } catch (error) {
      console.error('Error en checkout:', error)
      // ROLLBACK si hay error
      if (updateHabitacionOptimistic && reserva.habitacion_id) {
        updateHabitacionOptimistic(reserva.habitacion_id, {
          estado_ocupacion: 'OCUPADA'
        })
      }
      toast.error('Error en check-out', {
        description: error instanceof Error ? error.message : 'Error al hacer check-out'
      })
    } finally {
      setProcesando(false)
    }
  }

  // Funciones para modificar estadía
  const abrirDialogEstadia = () => {
    setNuevaFechaSalida(reserva.fecha_salida.split('T')[0])  // Solo la fecha
    setResumenCambio(null)
    setEstadiaDialogOpen(true)
  }

  const calcularCambio = async () => {
    if (!nuevaFechaSalida) return

    setProcesando(true)
    try {
      const result = await calcularResumenCambio(reserva.id, nuevaFechaSalida)
      if (result.success && result.resumen) {
        setResumenCambio(result.resumen)
      } else {
        toast.error('Error al calcular', {
          description: result.error || 'No se pudo calcular el cambio'
        })
      }
    } catch (error) {
      console.error('Error calculando cambio:', error)
      toast.error('Error al calcular el cambio')
    } finally {
      setProcesando(false)
    }
  }

  const confirmarCambioEstadia = async () => {
    if (!nuevaFechaSalida || !resumenCambio) return

    // Si es acortamiento con NC, mostrar diálogo de selección de método de devolución
    if (resumenCambio.diferenciaDias < 0 && resumenCambio.requiereNotaCredito) {
      // Obtener efectivo disponible antes de mostrar el diálogo
      setProcesando(true)
      try {
        const resultado = await getEfectivoDisponibleTurno()
        if (resultado.success) {
          setEfectivoDisponible(resultado.efectivo_disponible || 0)
        } else {
          setEfectivoDisponible(0)
        }
        setEstadiaDialogOpen(false) // Cerrar diálogo de estadía
        setRefundDialogOpen(true) // Abrir diálogo de método de devolución
      } catch (error) {
        console.error('Error obteniendo efectivo disponible:', error)
        setEfectivoDisponible(0)
        setRefundDialogOpen(true)
      } finally {
        setProcesando(false)
      }
      return
    }

    // Para extensiones o acortamientos sin NC, proceder normalmente
    setProcesando(true)
    try {
      const result = await redimensionarEstadia(reserva.id, nuevaFechaSalida)
      if (result.success) {
        setEstadiaDialogOpen(false)
        setResumenCambio(null)
        onUpdate()

        // Mensaje claro según tipo de operación
        if (result.tipo === 'extension') {
          toast.success(`Estadía extendida +${resumenCambio.diferenciaDias} noche(s)`, {
            description: `Nuevo saldo pendiente: S/${resumenCambio.diferenciaMonto.toFixed(2)}. Cobrar al huésped.`
          })
        } else {
          toast.success(`Estadía reducida ${Math.abs(resumenCambio.diferenciaDias)} noche(s)`, {
            description: 'La fecha de salida ha sido actualizada.'
          })
        }
      } else {
        toast.error('Error al modificar estadía', {
          description: result.error || 'No se pudo completar la operación'
        })
      }
    } catch (error) {
      console.error('Error modificando estadía:', error)
      toast.error('Error al modificar la estadía')
    } finally {
      setProcesando(false)
    }
  }

  // Nueva función para confirmar devolución con método seleccionado
  const confirmarDevolucion = async (metodo: MetodoDevolucion) => {
    if (!nuevaFechaSalida || !resumenCambio) return

    setProcesando(true)
    try {
      const result = await redimensionarEstadia(reserva.id, nuevaFechaSalida, metodo)
      if (result.success) {
        setRefundDialogOpen(false)
        setResumenCambio(null)
        onUpdate()

        const metodoLabel = metodo === 'EFECTIVO' ? 'en efectivo' :
          metodo === 'CREDITO_FAVOR' ? 'como crédito a favor' :
            'pendiente al método original'

        toast.success(`Estadía reducida ${Math.abs(resumenCambio.diferenciaDias)} noche(s)`, {
          description: `✅ NC emitida por S/${Math.abs(resumenCambio.diferenciaMonto).toFixed(2)}. Devolución ${metodoLabel}.`
        })
      } else {
        toast.error('Error al modificar estadía', {
          description: result.error || 'No se pudo completar la operación'
        })
      }
    } catch (error) {
      console.error('Error procesando devolución:', error)
      toast.error('Error al procesar la devolución')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {puedeHacerCheckin && (
            <>
              <ContextMenuItem
                onClick={handleCheckInRapido}
                disabled={procesando}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Check-in Rápido
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}

          {puedeHacerCheckout && (
            <>
              <ContextMenuItem
                onClick={iniciarCheckout}
                disabled={procesando}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Check-out
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}

          <ContextMenuItem onClick={() => setPagoDialogOpen(true)}>
            <CreditCard className="mr-2 h-4 w-4" />
            Cobrar Rápido
          </ContextMenuItem>

          {/* Late Check-out solo visible cuando está en CHECKED_IN */}
          {puedeHacerCheckout && (
            <ContextMenuItem onClick={() => setLateCheckoutDialogOpen(true)}>
              <Clock className="mr-2 h-4 w-4" />
              Late Check-out
            </ContextMenuItem>
          )}

          <ContextMenuItem onClick={abrirDialogEstadia}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Modificar Estadía
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => setCancelarDialogOpen(true)}
            className="text-red-600 focus:text-red-600"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancelar Reserva
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Dialog de Pago Rápido */}
      <RegistrarPagoDialog
        open={pagoDialogOpen}
        onOpenChange={setPagoDialogOpen}
        reserva={{
          id: reserva.id,
          saldo_pendiente: reserva.saldo_pendiente || 0,
          titular_nombre: `${reserva.huespedes?.nombres || ''} ${reserva.huespedes?.apellidos || ''}`,
          titular_tipo_doc: reserva.huespedes?.tipo_documento || 'DNI',
          titular_numero_doc: reserva.huespedes?.numero_documento || '',
          habitacion_numero: reserva.habitaciones?.numero || '...',
          precio_pactado: reserva.precio_pactado || 0,
          fecha_entrada: reserva.fecha_entrada,
          fecha_salida: reserva.fecha_salida
        }}
        onSuccess={onUpdate}
      />

      {/* Dialog de Checkout */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {forceCheckoutNeeded ? '⚠️ Deuda Pendiente' : 'Confirmar Check-out'}
            </DialogTitle>
            <DialogDescription>
              {reserva.codigo_reserva}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {forceCheckoutNeeded ? (
              <div className="space-y-4">
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  El huésped tiene un saldo pendiente de <strong>S/ {deudaPendiente.toFixed(2)}</strong>.
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setCheckoutDialogOpen(false)
                    setPagoDialogOpen(true)
                  }}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pagar Deuda Ahora
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  O puedes forzar la salida dejando la deuda:
                </p>
              </div>
            ) : (
              <p className="text-sm">
                ¿Confirmar check-out para {reserva.huespedes?.nombres} {reserva.huespedes?.apellidos}?
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCheckoutDialogOpen(false)
                setForceCheckoutNeeded(false)
              }}
              disabled={procesando}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => confirmarCheckout(forceCheckoutNeeded)}
              disabled={procesando}
              variant={forceCheckoutNeeded ? "destructive" : "default"}
            >
              {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {forceCheckoutNeeded ? 'Forzar Check-out' : 'Confirmar Salida'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmación de Cancelación */}
      <Dialog open={cancelarDialogOpen} onOpenChange={setCancelarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar Reserva?</DialogTitle>
            <DialogDescription>
              Esta acción cancelará la reserva {reserva.codigo_reserva} de{' '}
              {reserva.huespedes?.nombres} {reserva.huespedes?.apellidos}.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelarDialogOpen(false)}
              disabled={procesando}
            >
              No, mantener
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelarReserva}
              disabled={procesando}
            >
              {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Modificar Estadía */}
      <Dialog open={estadiaDialogOpen} onOpenChange={setEstadiaDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modificar Estadía</DialogTitle>
            <DialogDescription>
              {reserva.codigo_reserva} • {reserva.huespedes?.apellidos}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Fechas actuales */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Entrada</Label>
                <div className="font-medium">
                  {format(new Date(reserva.fecha_entrada.split('T')[0] + 'T12:00:00'), 'dd/MM/yyyy')}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Salida actual</Label>
                <div className="font-medium">
                  {format(new Date(reserva.fecha_salida.split('T')[0] + 'T12:00:00'), 'dd/MM/yyyy')}
                </div>
              </div>
            </div>

            {/* Nueva fecha de salida */}
            <div className="space-y-2">
              <Label htmlFor="nuevaFecha">Nueva fecha de salida</Label>
              <div className="flex gap-2">
                <Input
                  id="nuevaFecha"
                  type="date"
                  value={nuevaFechaSalida}
                  onChange={(e) => {
                    setNuevaFechaSalida(e.target.value)
                    setResumenCambio(null)
                  }}
                  min={reserva.fecha_entrada.split('T')[0]}
                />
                <Button
                  variant="outline"
                  onClick={calcularCambio}
                  disabled={procesando || !nuevaFechaSalida}
                >
                  {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
                </Button>
              </div>
            </div>

            {/* Resumen del cambio */}
            {resumenCambio && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Noches</span>
                  <div className="flex items-center gap-2">
                    <span>{resumenCambio.diasOriginales}</span>
                    {resumenCambio.diferenciaDias > 0 ? (
                      <ArrowRight className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowLeft className="h-4 w-4 text-orange-500" />
                    )}
                    <span className="font-bold">{resumenCambio.diasNuevos}</span>
                    <span className={`text-xs ${resumenCambio.diferenciaDias > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      ({resumenCambio.diferenciaDias > 0 ? '+' : ''}{resumenCambio.diferenciaDias})
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Diferencia</span>
                  <span className={`font-bold ${resumenCambio.diferenciaMonto > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {resumenCambio.diferenciaMonto > 0 ? '+' : ''}S/{resumenCambio.diferenciaMonto.toFixed(2)}
                  </span>
                </div>

                {/* Alertas fiscales */}
                {resumenCambio.requiereFacturaExtra && (
                  <div className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 text-xs p-2 rounded flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Se emitirá factura adicional por S/{resumenCambio.diferenciaMonto.toFixed(2)}
                  </div>
                )}

                {resumenCambio.requiereNotaCredito && (
                  <div className="bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 text-xs p-2 rounded flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Se emitirá Nota de Crédito + devolución de S/{Math.abs(resumenCambio.diferenciaMonto).toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEstadiaDialogOpen(false)
                setResumenCambio(null)
              }}
              disabled={procesando}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarCambioEstadia}
              disabled={procesando || !resumenCambio}
            >
              {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Late Checkout */}
      <LateCheckoutDialog
        open={lateCheckoutDialogOpen}
        onOpenChange={setLateCheckoutDialogOpen}
        reserva={{
          id: reserva.id,
          habitacion_id: reserva.habitacion_id,
          habitacion_numero: reserva.habitaciones?.numero || '',
          precio_pactado: reserva.precio_pactado || 0,
          fecha_salida: reserva.fecha_salida,
          titular_nombre: `${reserva.huespedes?.nombres || ''} ${reserva.huespedes?.apellidos || ''}`.trim(),
          titular_tipo_doc: reserva.huespedes?.tipo_documento || 'DNI',
          titular_numero_doc: reserva.huespedes?.numero_documento || ''
        }}
        onSuccess={onUpdate}
      />

      {/* Dialog de Método de Devolución */}
      <RefundMethodDialog
        open={refundDialogOpen}
        onOpenChange={(open) => {
          setRefundDialogOpen(open)
          if (!open) {
            setResumenCambio(null) // Limpiar si se cancela
          }
        }}
        monto={Math.abs(resumenCambio?.diferenciaMonto || 0)}
        moneda={(reserva as any).moneda_pactada || 'PEN'}
        efectivoDisponible={efectivoDisponible}
        onConfirm={confirmarDevolucion}
        loading={procesando}
      />
    </>
  )
}
