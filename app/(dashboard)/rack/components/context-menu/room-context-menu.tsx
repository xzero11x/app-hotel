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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Wrench, Ban, Info, Key, UserCheck, UserX, SprayCan } from 'lucide-react'
import { cambiarEstadoHabitacion } from '@/lib/actions/rack'
import { toggleHuespedPresente } from '@/lib/actions/reservas'
import { updateEstadoLimpieza } from '@/lib/actions/habitaciones'
import type { RackHabitacion, RackReserva } from '@/lib/actions/rack'
import { toast } from 'sonner'

type Props = {
  children: React.ReactNode
  habitacion: RackHabitacion
  reservaActiva?: { id: string, huesped_presente: boolean } | null
  onUpdate: () => void
  // Funciones para actualizaciones optimistas
  updateHabitacionOptimistic?: (habitacionId: string, updates: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>) => void
  revertHabitacionOptimistic?: (habitacionId: string, originalData: Partial<Pick<RackHabitacion, 'estado_limpieza' | 'estado_ocupacion' | 'estado_servicio'>>) => void
  updateReservaOptimistic?: (reservaId: string, updates: Partial<Pick<RackReserva, 'huesped_presente'>>) => void
}

export function RoomContextMenu({ 
  children, 
  habitacion, 
  reservaActiva, 
  onUpdate,
  updateHabitacionOptimistic,
  revertHabitacionOptimistic,
  updateReservaOptimistic,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'limpiar' | 'mantenimiento' | 'bloquear' | null>(null)
  const [nota, setNota] = useState('')
  const [procesando, setProcesando] = useState(false)

  // ==========================================
  // ACTUALIZACIÓN OPTIMISTA DE LIMPIEZA
  // La UI cambia INSTANTÁNEAMENTE, luego se confirma con el servidor
  // ==========================================
  const handleUpdateLimpieza = async (estado: 'LIMPIA' | 'SUCIA') => {
    if (habitacion.estado_limpieza === estado) return

    // Guardar estado original para rollback si falla
    const estadoOriginal = habitacion.estado_limpieza

    // 1. ACTUALIZACIÓN OPTIMISTA INMEDIATA (UI cambia al instante)
    if (updateHabitacionOptimistic) {
      updateHabitacionOptimistic(habitacion.id, { estado_limpieza: estado })
    }
    
    // Toast sutil de confirmación visual
    const toastId = toast.loading(
      estado === 'LIMPIA' ? 'Marcando como limpia...' : 'Marcando como sucia...',
      { duration: 1500 }
    )

    try {
      // 2. Enviar al servidor en background
      const result = await updateEstadoLimpieza(habitacion.id, estado)
      
      if (result.success) {
        toast.success(
          estado === 'LIMPIA' ? '✓ Habitación limpia' : '✓ Habitación marcada sucia',
          { id: toastId, duration: 1500 }
        )
        // Realtime se encargará de sincronizar, no necesitamos refetch
      } else {
        // 3. ROLLBACK si falla
        if (revertHabitacionOptimistic) {
          revertHabitacionOptimistic(habitacion.id, { estado_limpieza: estadoOriginal })
        }
        toast.error('Error al actualizar', { id: toastId })
      }
    } catch (error) {
      // 3. ROLLBACK si hay error de red
      console.error('Error limpieza:', error)
      if (revertHabitacionOptimistic) {
        revertHabitacionOptimistic(habitacion.id, { estado_limpieza: estadoOriginal })
      }
      toast.error('Error de conexión', { id: toastId })
    }
  }

  // ==========================================
  // ACTUALIZACIÓN OPTIMISTA DE PRESENCIA (LLAVE)
  // ==========================================
  const handleTogglePresencia = async (presente: boolean) => {
    if (!reservaActiva) return

    // Guardar estado original
    const estadoOriginal = reservaActiva.huesped_presente

    // 1. ACTUALIZACIÓN OPTIMISTA INMEDIATA
    if (updateReservaOptimistic) {
      updateReservaOptimistic(reservaActiva.id, { huesped_presente: presente })
    }

    const toastId = toast.loading(
      presente ? 'Entregando llave...' : 'Recibiendo llave...',
      { duration: 1500 }
    )

    try {
      // 2. Enviar al servidor
      const result = await toggleHuespedPresente(reservaActiva.id, presente)
      
      if (result.success) {
        toast.success(
          presente ? '✓ Llave entregada' : '✓ Llave recibida',
          { id: toastId, duration: 1500 }
        )
      } else {
        // 3. ROLLBACK
        if (updateReservaOptimistic) {
          updateReservaOptimistic(reservaActiva.id, { huesped_presente: estadoOriginal })
        }
        toast.error(result.error || 'Error al actualizar', { id: toastId })
      }
    } catch (error) {
      console.error('Error presencia:', error)
      if (updateReservaOptimistic) {
        updateReservaOptimistic(reservaActiva.id, { huesped_presente: estadoOriginal })
      }
      toast.error('Error de conexión', { id: toastId })
    }
  }

  // ==========================================
  // CAMBIAR ESTADO DE HABITACIÓN (Mantenimiento/Bloqueada)
  // ==========================================
  const handleCambiarEstado = async (nuevoEstado: string) => {
    const estadoOriginal = habitacion.estado_servicio
    
    // Actualización optimista
    if (updateHabitacionOptimistic) {
      updateHabitacionOptimistic(habitacion.id, { 
        estado_servicio: nuevoEstado as RackHabitacion['estado_servicio'] 
      })
    }

    const toastId = toast.loading('Actualizando habitación...', { duration: 2000 })

    try {
      await cambiarEstadoHabitacion(habitacion.id, nuevoEstado, nota)
      setDialogOpen(false)
      setNota('')
      toast.success('✓ Estado actualizado', { id: toastId, duration: 1500 })
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      if (revertHabitacionOptimistic) {
        revertHabitacionOptimistic(habitacion.id, { estado_servicio: estadoOriginal })
      }
      toast.error('Error al actualizar estado', { id: toastId })
    }
  }

  const abrirDialog = (tipo: 'limpiar' | 'mantenimiento' | 'bloquear') => {
    setDialogType(tipo)
    setDialogOpen(true)
  }

  const getDialogTitle = () => {
    if (dialogType === 'limpiar') return `Marcar Hab. ${habitacion.numero} como Limpia`
    if (dialogType === 'mantenimiento') return `Enviar Hab. ${habitacion.numero} a Mantenimiento`
    if (dialogType === 'bloquear') return `Bloquear Hab. ${habitacion.numero}`
    return ''
  }

  const getDialogDescription = () => {
    if (dialogType === 'limpiar') return 'La habitación quedará disponible para check-in'
    if (dialogType === 'mantenimiento') return 'La habitación no estará disponible hasta que se complete el mantenimiento'
    if (dialogType === 'bloquear') return 'La habitación no estará disponible para reservas'
    return ''
  }

  const handleConfirmar = () => {
    if (dialogType === 'limpiar') {
      handleUpdateLimpieza('LIMPIA')
      setDialogOpen(false)
    } else if (dialogType === 'mantenimiento') {
      handleCambiarEstado('MANTENIMIENTO')
    } else if (dialogType === 'bloquear') {
      handleCambiarEstado('FUERA_SERVICIO')
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">

          {/* SECCIÓN 1: CONTROL DE LLAVE (PRESENCIA) */}
          {reservaActiva && (
            <>
              {reservaActiva.huesped_presente ? (
                <ContextMenuItem
                  onClick={() => handleTogglePresencia(false)}
                  className="text-orange-600 focus:text-orange-700"
                >
                  <Key className="mr-2 h-4 w-4" />
                  Recibir Llave (Marcar Fuera)
                </ContextMenuItem>
              ) : (
                <ContextMenuItem
                  onClick={() => handleTogglePresencia(true)}
                  className="text-green-600 focus:text-green-700"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Entregar Llave (Marcar Dentro)
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />
            </>
          )}

          {/* SECCIÓN 2: LIMPIEZA */}
          {habitacion.estado_limpieza === 'SUCIA' ? (
            <ContextMenuItem onClick={() => handleUpdateLimpieza('LIMPIA')}>
              <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
              Marcar como Limpia
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={() => handleUpdateLimpieza('SUCIA')}>
              <SprayCan className="mr-2 h-4 w-4 text-gray-500" />
              Marcar como Sucia
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {/* SECCIÓN 3: MANTENIMIENTO */}
          <ContextMenuItem
            onClick={() => abrirDialog('mantenimiento')}
            disabled={procesando || habitacion.estado_servicio === 'MANTENIMIENTO'}
          >
            <Wrench className="mr-2 h-4 w-4 text-yellow-500" />
            {habitacion.estado_servicio === 'MANTENIMIENTO' ? 'En Mantenimiento' : 'Enviar a Mantenimiento'}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => abrirDialog('bloquear')}
            disabled={procesando || habitacion.estado_servicio === 'FUERA_SERVICIO'}
          >
            <Ban className="mr-2 h-4 w-4 text-red-500" />
            {habitacion.estado_servicio === 'FUERA_SERVICIO' ? 'Ya está bloqueada' : 'Bloquear Habitación'}
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem disabled>
            <Info className="mr-2 h-4 w-4" />
            Ver Detalles
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Dialog de confirmación */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>

          {dialogType !== 'limpiar' && (
            <div className="space-y-2">
              <Label htmlFor="nota">Nota (opcional)</Label>
              <Textarea
                id="nota"
                placeholder="Ej: Reparar aire acondicionado..."
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                setNota('')
              }}
              disabled={procesando}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={procesando}>
              {procesando ? 'Procesando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}