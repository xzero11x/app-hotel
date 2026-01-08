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
import { Sparkles, Wrench, Ban, Info } from 'lucide-react'
import { marcarHabitacionLimpia, cambiarEstadoHabitacion } from '@/lib/actions/rack'
import type { RackHabitacion } from '@/lib/actions/rack'

type Props = {
  children: React.ReactNode
  habitacion: RackHabitacion
  onUpdate: () => void
}

export function RoomContextMenu({ children, habitacion, onUpdate }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'limpiar' | 'mantenimiento' | 'bloquear' | null>(null)
  const [nota, setNota] = useState('')
  const [procesando, setProcesando] = useState(false)

  const handleMarcarLimpia = async () => {
    if (habitacion.estado_limpieza === 'LIMPIA') return
    
    setProcesando(true)
    try {
      await marcarHabitacionLimpia(habitacion.id)
      onUpdate()
    } catch (error) {
      console.error('Error al marcar limpia:', error)
      alert('Error al actualizar habitación')
    } finally {
      setProcesando(false)
    }
  }

  const handleCambiarEstado = async (nuevoEstado: string) => {
    setProcesando(true)
    try {
      await cambiarEstadoHabitacion(habitacion.id, nuevoEstado, nota)
      setDialogOpen(false)
      setNota('')
      onUpdate()
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      alert('Error al actualizar habitación')
    } finally {
      setProcesando(false)
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
      handleMarcarLimpia()
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
        <ContextMenuContent className="w-56">
          {habitacion.estado_limpieza === 'SUCIA' && (
            <>
              <ContextMenuItem
                onClick={() => abrirDialog('limpiar')}
                disabled={procesando}
              >
                <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
                Marcar como Limpia
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}

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
