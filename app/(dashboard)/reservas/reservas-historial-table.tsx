'use client'

import { useState, useEffect } from 'react'
import { getReservasHistorial, type OcupacionReserva } from '@/lib/actions/ocupaciones'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { ReservationDetailSheet } from '@/components/reservas/reservation-detail-sheet'
import { RegistrarPagoDialog } from '@/components/cajas/registrar-pago-dialog'
import { DataTable } from '@/components/tables/data-table'
import { columns } from './columns'
import { OnChangeFn, PaginationState } from '@tanstack/react-table'

// Hook simple para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  return debouncedValue
}

export function ReservasHistorialTable() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('search') || searchParams.get('q') || ''

  const [reservas, setReservas] = useState<OcupacionReserva[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Filtros
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(initialQuery)
  const [estado, setEstado] = useState('TODAS')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')

  // Búsqueda automática con debounce
  const debouncedSearch = useDebounce(search, 500)

  // Sheet
  const [selectedReservaId, setSelectedReservaId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Pagos
  const [pagoReservaData, setPagoReservaData] = useState<any | null>(null)

  // Efecto principal de carga
  useEffect(() => {
    cargarDatos()
  }, [page, estado, fechaInicio, fechaFin, debouncedSearch])

  async function cargarDatos() {
    try {
      setLoading(true)
      const result = await getReservasHistorial({
        page,
        pageSize: 10,
        search: debouncedSearch || undefined, // Usar el valor o undefined
        estado,
        dateStart: fechaInicio ? new Date(fechaInicio) : undefined,
        dateEnd: fechaFin ? new Date(fechaFin) : undefined
      })

      setReservas(result.data)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (error) {
      console.error('Error al cargar historial:', error)
    } finally {
      setLoading(false)
    }
  }

  // DataTable handlers via meta
  function handleVerDetalle(reservaId: string) {
    setSelectedReservaId(reservaId)
    setSheetOpen(true)
  }

  function handleCobrar(reserva: OcupacionReserva) {
    setPagoReservaData({
      id: reserva.id,
      saldo_pendiente: reserva.saldo_pendiente,
      titular_nombre: reserva.titular_nombre,
      titular_tipo_doc: reserva.titular_tipo_doc,
      titular_numero_doc: reserva.titular_numero_doc,
      habitacion_numero: reserva.habitacion_numero,
      precio_pactado: reserva.precio_pactado
    })
  }

  function handlePagoSuccess() {
    cargarDatos() // Recargar para ver el nuevo saldo
  }

  const handlePaginationChange: OnChangeFn<PaginationState> = (updaterOrValue) => {
    if (typeof updaterOrValue === 'function') {
      const newState = updaterOrValue({
        pageIndex: page - 1,
        pageSize: 10
      })
      setPage(newState.pageIndex + 1)
    } else {
      setPage(updaterOrValue.pageIndex + 1)
    }
  }

  // Reset page when filters change (except pagination itself)
  useEffect(() => {
    setPage(1)
  }, [estado, fechaInicio, fechaFin, debouncedSearch])


  return (
    <div className="space-y-6">
      {/* DataTable Server Side con Toolbar integrado */}
      <DataTable
        columns={columns}
        data={reservas}
        manualPagination={true}
        pageCount={totalPages}
        state={{
          pagination: { pageIndex: page - 1, pageSize: 10 }
        }}
        onPaginationChange={handlePaginationChange}
        meta={{
          onVerDetalle: handleVerDetalle,
          onCobrar: handleCobrar
        }}
        toolbar={
          <div className="flex items-center gap-2 w-full overflow-x-auto scrollbar-hide">
            {/* Tabs integrados como filtro principal */}
            <Tabs value={estado} onValueChange={setEstado} className="flex-shrink-0">

              <TabsList className="h-8 bg-muted/60 p-0.5">
                <TabsTrigger value="TODAS" className="h-7 text-sm px-3">Todas</TabsTrigger>
                <TabsTrigger value="CHECKED_IN" className="h-7 text-sm px-3">En Casa</TabsTrigger>
                <TabsTrigger value="CHECKED_OUT" className="h-7 text-sm px-3">Salidas</TabsTrigger>
                <TabsTrigger value="RESERVADA" className="h-7 text-sm px-3">Futuras</TabsTrigger>
                <TabsTrigger value="CANCELADA" className="h-7 text-sm px-3">Cancel</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-[350px] flex-shrink-0">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar huésped, código o habitación..."
                className="pl-8 h-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1 ml-auto md:ml-0 flex-shrink-0">
              <Input
                type="date"
                placeholder="Desde"
                className="h-8 w-auto min-w-[110px]"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                title="Fecha de inicio del rango"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                placeholder="Hasta"
                className="h-8 w-auto min-w-[110px]"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                title="Fecha de fin del rango"
              />
            </div>
          </div>
        }
      />

      {/* Sheet de detalle */}
      {selectedReservaId && (
        <ReservationDetailSheet
          reservaId={selectedReservaId}
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open)
            if (!open) {
              setSelectedReservaId(null)
            }
          }}
          readonly={true}
        />
      )}

      {/* Modal de Cobro */}
      {pagoReservaData && (
        <RegistrarPagoDialog
          reserva={pagoReservaData}
          open={!!pagoReservaData}
          onOpenChange={(open) => {
            if (!open) setPagoReservaData(null)
          }}
          onSuccess={handlePagoSuccess}
        />
      )}
    </div>
  )
}
