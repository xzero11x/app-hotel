'use client'

import { useState, useEffect } from 'react'
import { getHistorialComprobantes, actualizarEstadoComprobante } from '@/lib/actions/comprobantes'
import { DataTable } from '@/components/tables/data-table'
import { comprobantesColumns, type Comprobante } from './columns'
import { ComprobanteDetailSheet } from '@/components/facturacion/comprobante-detail-sheet'
import { ReservationDetailSheet } from '@/components/reservas/reservation-detail-sheet'
import { EmitirNotaCreditoDialog } from './components/emitir-nota-credito-dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export function FacturacionClient() {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<Date>()
  const [filtroTipo, setFiltroTipo] = useState<'TODAS' | 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO'>('TODAS')
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'ANULADO'>('TODOS')
  const [selectedComprobanteId, setSelectedComprobanteId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Sheet para ver reserva
  const [selectedReservaId, setSelectedReservaId] = useState<string | null>(null)
  const [reservaSheetOpen, setReservaSheetOpen] = useState(false)

  // Dialog para emitir Nota de Crédito
  const [ncDialogOpen, setNcDialogOpen] = useState(false)
  const [comprobanteParaNC, setComprobanteParaNC] = useState<Comprobante | null>(null)

  useEffect(() => {
    cargarComprobantes()
  }, [filtroTipo, filtroEstado])

  async function cargarComprobantes() {
    try {
      setLoading(true)
      const data = await getHistorialComprobantes({
        tipo_comprobante: filtroTipo,
        estado_sunat: filtroEstado
      })
      setComprobantes(data as Comprobante[])
    } catch (error) {
      console.error('Error al cargar comprobantes:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleVerDetalle(comprobanteId: string) {
    setSelectedComprobanteId(comprobanteId)
    setSheetOpen(true)
  }

  function handleVerReserva(reservaId: string) {
    setSelectedReservaId(reservaId)
    setReservaSheetOpen(true)
  }

  function handleDescargarPDF(comprobanteId: string) {
    const comprobante = comprobantes.find(c => c.id === comprobanteId)
    if (comprobante?.pdf_url) {
      window.open(comprobante.pdf_url, '_blank')
    } else {
      // Si no tiene PDF URL (ej. pendiente antiguo), intentamos obtener actualizar primero
      if (comprobante?.estado_sunat === 'PENDIENTE') {
        alert('El comprobante está PENDIENTE. Intente actualizar el estado primero.')
      } else {
        alert('No hay PDF disponible para este comprobante.')
      }
    }
  }

  function handleAnular(comprobanteId: string) {
    const comprobante = comprobantes.find(c => c.id === comprobanteId)
    if (comprobante && comprobante.tipo_comprobante !== 'NOTA_CREDITO') {
      setComprobanteParaNC(comprobante)
      setNcDialogOpen(true)
    }
  }

  async function handleActualizarEstado(comprobanteId: string) {
    // No activamos loading global para no parpadear toda la tabla
    // Idealmente usaríamos un estado de carga por fila o toast
    const res = await actualizarEstadoComprobante(comprobanteId)
    if (res.success) {
      await cargarComprobantes()
    } else {
      // Fallback simple si no hay toast
      alert(res.message || 'Error al actualizar estado')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-muted-foreground">Cargando comprobantes...</div>
      </div>
    )
  }

  return (
    <>
      <DataTable
        columns={comprobantesColumns}
        data={comprobantes}
        searchKey="comprobante"
        searchPlaceholder="Buscar por comprobante o fecha..."
        meta={{
          onVerDetalle: handleVerDetalle,
          onVerReserva: handleVerReserva,
          onDescargarPDF: handleDescargarPDF,
          onAnular: handleAnular,
          onActualizarEstado: handleActualizarEstado,
        }}
        toolbar={
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-[120px] sm:w-[180px] justify-start text-left font-normal h-8 text-xs sm:text-sm',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {date ? format(date, 'dd/MM/yy', { locale: es }) : 'Fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
              <SelectTrigger className="w-[100px] sm:w-[150px] h-8 text-xs sm:text-sm">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todos</SelectItem>
                <SelectItem value="BOLETA">Boletas</SelectItem>
                <SelectItem value="FACTURA">Facturas</SelectItem>
                <SelectItem value="NOTA_CREDITO">N. Crédito</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as any)}>
              <SelectTrigger className="w-[100px] sm:w-[150px] h-8 text-xs sm:text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                <SelectItem value="ACEPTADO">Aceptados</SelectItem>
                <SelectItem value="RECHAZADO">Rechazados</SelectItem>
                <SelectItem value="ANULADO">Anulados</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={cargarComprobantes}
              size="icon"
              className="h-8 w-8"
            >
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        }
      />

      {/* Sheet de detalle de comprobante */}
      {selectedComprobanteId && (
        <ComprobanteDetailSheet
          comprobanteId={selectedComprobanteId}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      )}

      {/* Sheet de detalle de reserva */}
      {selectedReservaId && (
        <ReservationDetailSheet
          reservaId={selectedReservaId}
          open={reservaSheetOpen}
          onOpenChange={(open) => {
            setReservaSheetOpen(open)
            if (!open) {
              setSelectedReservaId(null)
            }
          }}
          onUpdate={() => { }}
        />
      )}

      {/* Dialog para emitir Nota de Crédito */}
      <EmitirNotaCreditoDialog
        comprobante={comprobanteParaNC}
        open={ncDialogOpen}
        onOpenChange={(open) => {
          setNcDialogOpen(open)
          if (!open) setComprobanteParaNC(null)
        }}
        onSuccess={cargarComprobantes}
      />
    </>
  )
}
