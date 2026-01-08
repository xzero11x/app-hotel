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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LogIn, CreditCard, XCircle, Loader2, LogOut } from 'lucide-react'
import { realizarCheckin } from '@/lib/actions/checkin'
import { realizarCheckout, validarCheckout } from '@/lib/actions/checkout'
import { cancelarReserva } from '@/lib/actions/reservas'
import { registrarPago } from '@/lib/actions/pagos'
import { format, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import type { RackReserva } from '@/lib/actions/rack'

type Props = {
  children: React.ReactNode
  reserva: RackReserva
  onUpdate: () => void
}

export function ReservationContextMenu({ children, reserva, onUpdate }: Props) {
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [cancelarDialogOpen, setCancelarDialogOpen] = useState(false)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [procesando, setProcesando] = useState(false)
  
  // Datos del pago
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [numeroOperacion, setNumeroOperacion] = useState('')

  const fechaEntrada = new Date(reserva.fecha_entrada)
  const puedeHacerCheckin = isToday(fechaEntrada) && reserva.estado === 'RESERVADA'
  const puedeHacerCheckout = reserva.estado === 'CHECKED_IN'

  const handleCheckInRapido = async () => {
    if (!puedeHacerCheckin) return
    
    setProcesando(true)
    try {
      const result = await realizarCheckin(reserva.id)
      
      if (result.error) {
        alert(`Error: ${result.message || result.error}`)
      } else {
        onUpdate()
      }
    } catch (error) {
      console.error('Error en check-in:', error)
      alert('Error al hacer check-in')
    } finally {
      setProcesando(false)
    }
  }

  const handleCancelarReserva = async () => {
    setProcesando(true)
    try {
      const result = await cancelarReserva(reserva.id)
      
      if (result.error) {
        alert(`Error: ${result.message || result.error}`)
      } else {
        setCancelarDialogOpen(false)
        onUpdate()
      }
    } catch (error) {
      console.error('Error al cancelar:', error)
      alert('Error al cancelar la reserva')
    } finally {
      setProcesando(false)
    }
  }

  const handleRegistrarPago = async () => {
    if (!montoPago || parseFloat(montoPago) <= 0) {
      alert('Ingresa un monto válido')
      return
    }

    setProcesando(true)
    try {
      // Usar la nueva función de pagos
      await registrarPago({
        reserva_id: reserva.id,
        caja_turno_id: '', // Se obtendrá automáticamente
        metodo_pago: metodoPago as any,
        monto: parseFloat(montoPago),
        referencia_pago: numeroOperacion || undefined
      })

      setPagoDialogOpen(false)
      setMontoPago('')
      setMetodoPago('EFECTIVO')
      setNumeroOperacion('')
      onUpdate()
    } catch (error) {
      console.error('Error al registrar pago:', error)
      alert(error instanceof Error ? error.message : 'Error al registrar el pago')
    } finally {
      setProcesando(false)
    }
  }

  const handleCheckout = async () => {
    setProcesando(true)
    try {
      // Primero validar
      const validacion = await validarCheckout(reserva.id)
      
      if (!validacion.puede_checkout) {
        const mensaje = validacion.saldo_pendiente 
          ? `${validacion.motivo}. Saldo pendiente: S/ ${validacion.saldo_pendiente.toFixed(2)}`
          : validacion.motivo
        
        if (!confirm(`${mensaje}\n\n¿Desea realizar checkout de todos modos? (Forzar checkout)`)) {
          setProcesando(false)
          return
        }
        
        // Check-out forzado
        await realizarCheckout({
          reserva_id: reserva.id,
          forzar_checkout: true
        })
      } else {
        // Check-out normal
        await realizarCheckout({
          reserva_id: reserva.id
        })
      }

      setCheckoutDialogOpen(false)
      onUpdate()
      alert('Check-out realizado exitosamente')
    } catch (error) {
      console.error('Error en checkout:', error)
      alert(error instanceof Error ? error.message : 'Error al hacer check-out')
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
                onClick={() => setCheckoutDialogOpen(true)}
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
      <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {reserva.codigo_reserva} - {reserva.huespedes?.nombres} {reserva.huespedes?.apellidos}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="monto">Monto a cobrar</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodo">Método de Pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger>
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
              <div className="space-y-2">
                <Label htmlFor="operacion">Número de Operación</Label>
                <Input
                  id="operacion"
                  placeholder="Opcional"
                  value={numeroOperacion}
                  onChange={(e) => setNumeroOperacion(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPagoDialogOpen(false)}
              disabled={procesando}
            >
              Cancelar
            </Button>
            <Button onClick={handleRegistrarPago} disabled={procesando}>
              {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Checkout */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Check-out</DialogTitle>
            <DialogDescription>
              {reserva.codigo_reserva} - Hab. {(reserva as any).habitaciones?.numero}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm">
              ¿Confirmar check-out para {reserva.huespedes?.nombres} {reserva.huespedes?.apellidos}?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Se validará el saldo pendiente antes de realizar el check-out.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCheckoutDialogOpen(false)}
              disabled={procesando}
            >
              Cancelar
            </Button>
            <Button onClick={handleCheckout} disabled={procesando}>
              {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Check-out
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
    </>
  )
}
