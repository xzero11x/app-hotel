'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PanelRightOpen, Eye, X } from 'lucide-react'
import { CommandBar } from './components/command-bar/command-bar'
import { SmartSidebar } from './components/smart-sidebar/smart-sidebar'
import { RackGrid } from './components/main-grid/rack-grid'
import { RoomCard } from './components/main-grid/room-card'
import { ReservationDetailSheet } from '@/components/reservas/reservation-detail-sheet'
import { NewReservationDialog } from './components/dialogs/new-reservation-dialog'
import { QuickReservationDialog } from './components/dialogs/quick-reservation-dialog'
import { ModalAperturaTurno } from '@/components/cajas/modal-apertura-turno'
import { useRackData } from '@/hooks/use-rack-data'
import { useTurnoContext } from '@/components/providers/turno-provider'
import { getRoomVisualState } from '@/lib/utils/room-status'
import { type FilterState, initialFilters } from './components/smart-sidebar/filters-tab'
import type { RackHabitacion } from '@/types/rack'

type NewReservationData = {
  habitacion: RackHabitacion
  fecha: Date
  fechaFinal?: Date
}

export function RackContainer() {
  const router = useRouter()
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [newReservation, setNewReservation] = useState<NewReservationData | null>(null)
  const [viewMode, setViewMode] = useState<'rack' | 'cards'>('rack')
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [quickReservationOpen, setQuickReservationOpen] = useState(false)

  // Detectar tamaño de pantalla y forzar vista cards en móviles
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) { // md breakpoint
        setViewMode('cards')
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Check de turno activo (ahora desde contexto global)
  const {
    loading: loadingTurno,
    hasActiveTurno,
    refetchTurno,
    // Datos pre-cargados para el modal (optimización)
    cajasDisponibles,
    loadingCajas,
    userId,
    // Modo observador (solo lectura)
    modoObservador,
    setModoObservador
  } = useTurnoContext()
  // Para recepcionistas, el turno es requerido (a menos que esté en modo observador)
  const turnoRequired = !modoObservador // Admin puede entrar sin turno

  // Cargar datos reales desde Supabase
  const {
    habitaciones,
    reservas,
    kpis,
    tareas,
    startDate,
    endDate,
    isLoading,
    isRefreshing,
    isPending,
    error,
    refetch,
    updateHabitacionOptimistic,
    revertHabitacionOptimistic,
    updateReservaOptimistic,
    removeReservaOptimistic,
  } = useRackData(30)

  // Filtrar habitaciones (memorizado para evitar recálculos innecesarios)
  const filteredHabitaciones = useMemo(() => {
    return habitaciones.filter(h => {
      // Filtros básicos de estado
      if (filters.tipoId !== 'all' && h.tipo_id !== filters.tipoId) return false
      if (filters.categoriaId !== 'all' && h.categoria_id !== filters.categoriaId) return false
      if (filters.estadoLimpieza !== 'all' && h.estado_limpieza !== filters.estadoLimpieza) return false
      if (filters.estadoOcupacion !== 'all' && h.estado_ocupacion !== filters.estadoOcupacion) return false
      if (filters.estadoServicio !== 'all' && h.estado_servicio !== filters.estadoServicio) return false

      // NUEVO: Filtro de disponibilidad por fechas
      if (filters.fechaDisponibilidadDesde && filters.fechaDisponibilidadHasta) {
        const filtroDesde = new Date(filters.fechaDisponibilidadDesde + 'T12:00:00')
        const filtroHasta = new Date(filters.fechaDisponibilidadHasta + 'T12:00:00')

        // Buscar si esta habitación tiene reservas que colisionen con el rango
        const tieneConflicto = reservas.some(r => {
          if (r.habitacion_id !== h.id) return false
          // Solo considerar reservas activas (no CHECKED_OUT o CANCELADA)
          if (r.estado === 'CHECKED_OUT' || r.estado === 'CANCELADA') return false

          const reservaInicio = new Date(r.fecha_entrada)
          const reservaFin = new Date(r.fecha_salida)

          // Hay conflicto si los rangos se solapan
          // (filtroInicio < reservaFin) Y (filtroFin > reservaInicio)
          return filtroDesde < reservaFin && filtroHasta > reservaInicio
        })

        if (tieneConflicto) return false
      }

      return true
    })
  }, [habitaciones, reservas, filters])

  const handleNewReservation = (habitacion: RackHabitacion, fecha: Date, fechaFinal?: Date) => {
    setNewReservation({ habitacion, fecha, fechaFinal })
  }

  const handleReservationCreated = () => {
    // Solo recargamos datos. El modal se encarga de mostrar el paso de éxito/pago
    // y cerrarse cuando el usuario lo decida.
    refetch()
  }

  const handleTurnoAbierto = async () => {
    // Refetch inmediato - el turno ya está guardado en BD
    console.log('[RackContainer] Turno abierto, refetching...')
    await refetchTurno()
    console.log('[RackContainer] refetchTurno completado')
  }

  const handleCancelarApertura = () => {
    router.push('/')
  }

  // Si está cargando el check de turno, mostrar loading
  if (loadingTurno) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-muted-foreground">Verificando turno de caja...</p>
      </div>
    )
  }

  // Si requiere turno pero no lo tiene (y no está en modo observador), mostrar modal bloqueante
  if (turnoRequired && !hasActiveTurno) {
    return (
      <div className="h-full w-full">
        <ModalAperturaTurno
          onSuccess={handleTurnoAbierto}
          onCancel={handleCancelarApertura}
          allowCancel={true}
          onModoObservador={() => setModoObservador(true)}
          cajasIniciales={cajasDisponibles}
          loadingCajasInicial={loadingCajas}
          userIdInicial={userId}
        />
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="sticky top-0 z-50 bg-background">
        <CommandBar
          kpis={kpis}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNewReservation={() => setQuickReservationOpen(true)}
          onSearchSelect={(type, id) => {
            if (type === 'reserva') {
              setSelectedReservationId(id)
            }
            // Para huéspedes, buscar su reserva activa
            // Para habitaciones, podría scrollear al bloque
          }}
        />

        {/* Banner de modo observador */}
        {modoObservador && (
          <div className="border-b bg-muted/50 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Modo observador</span>
              <span className="text-muted-foreground">— Solo lectura, sin operaciones de caja</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModoObservador(false)}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Salir
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* ZONA C: Main Grid */}
        <div className="flex-1 min-w-0 relative flex flex-col">
          {isLoading && habitaciones.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Cargando habitaciones...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{error}</p>
            </div>
          ) : viewMode === 'rack' ? (
            <RackGrid
              habitaciones={filteredHabitaciones}
              reservas={reservas}
              startDate={startDate}
              endDate={endDate}
              onReservationClick={setSelectedReservationId}
              onNewReservation={handleNewReservation}
              onUpdate={refetch}
              clearSelection={!newReservation}
              updateHabitacionOptimistic={updateHabitacionOptimistic}
              revertHabitacionOptimistic={revertHabitacionOptimistic}
              updateReservaOptimistic={updateReservaOptimistic}
              removeReservaOptimistic={removeReservaOptimistic}
            />
          ) : (
            <div className="p-2 sm:p-3 md:p-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredHabitaciones.map((habitacion) => (
                  <RoomCard
                    key={habitacion.id}
                    habitacion={habitacion}
                    reservas={reservas.filter(r => r.habitacion_id === habitacion.id)}
                    onReservationClick={setSelectedReservationId}
                    onNewReservation={handleNewReservation}
                    onUpdate={refetch}
                    updateHabitacionOptimistic={updateHabitacionOptimistic}
                    revertHabitacionOptimistic={revertHabitacionOptimistic}
                    updateReservaOptimistic={updateReservaOptimistic}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Toggle button when sidebar is closed */}
        {!isSidebarOpen && (
          <Button
            variant="outline"
            size="sm"
            className="fixed right-4 top-20 z-30 shadow-lg"
            onClick={() => setIsSidebarOpen(true)}
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        )}

        {/* ZONA B: Smart Sidebar */}
        <SmartSidebar
          open={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onReservationClick={setSelectedReservationId}
          tareas={tareas}
          habitaciones={habitaciones}
          filters={filters}
          onFilterChange={setFilters}
        />
      </div>

      {/* Sheet unificado para detalles de reserva */}
      {selectedReservationId && (
        <ReservationDetailSheet
          reservaId={selectedReservationId}
          open={!!selectedReservationId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedReservationId(null)
              refetch() // Recargar datos por si hubo cambios
            }
          }}
          onUpdate={refetch}
        />
      )}

      {/* Dialog para nueva reserva */}
      {newReservation && (
        <NewReservationDialog
          open={!!newReservation}
          onOpenChange={(open) => !open && setNewReservation(null)}
          habitacion={newReservation.habitacion}
          fechaInicial={newReservation.fecha}
          fechaFinal={newReservation.fechaFinal}
          onSuccess={handleReservationCreated}
        />
      )}

      {/* Dialog de selección rápida (desde botón Nueva Reserva) */}
      <QuickReservationDialog
        open={quickReservationOpen}
        onOpenChange={setQuickReservationOpen}
        onSelectRoom={(habitacion, fechaInicial, fechaFinal) => {
          setNewReservation({
            habitacion,
            fecha: fechaInicial,
            fechaFinal
          })
        }}
      />
    </div>
  )
}
