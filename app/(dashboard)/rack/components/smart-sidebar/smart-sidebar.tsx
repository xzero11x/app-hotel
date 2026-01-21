'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { TodayTab } from './today-tab'
import { AlertsTab } from './alerts-tab'
import { FiltersTab, type FilterState } from './filters-tab'
import { cn } from '@/lib/utils'
import { getAlertasRack } from '@/lib/actions/rack'
import type { RackHabitacion } from '@/lib/actions/rack'

type Tareas = {
  checkins: any[]
  checkouts: any[]
}

type Props = {
  open: boolean
  onClose: () => void
  onReservationClick: (id: string) => void
  tareas: Tareas
  habitaciones?: RackHabitacion[]
  filters?: FilterState
  onFilterChange?: (filters: FilterState) => void
}

export function SmartSidebar({ open, onClose, onReservationClick, tareas, habitaciones = [], filters, onFilterChange }: Props) {
  const [alertasCount, setAlertasCount] = useState(0)

  // Calcular conteo de tareas del día
  const tareasCount = (tareas.checkins?.length || 0) + (tareas.checkouts?.length || 0)

  // Cargar conteo de alertas al montar
  useEffect(() => {
    async function cargarConteoAlertas() {
      try {
        const data = await getAlertasRack()
        const totalAlertas = (data.checkoutsTarde?.length || 0) +
          (data.mantenimiento?.length || 0) +
          (data.sinHuespedes?.length || 0)
        setAlertasCount(totalAlertas)
      } catch (error) {
        console.error('Error al cargar conteo de alertas:', error)
      }
    }
    if (open) {
      cargarConteoAlertas()
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Overlay para móvil */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar con comportamiento responsive */}
      <div className={cn(
        "fixed md:relative right-0 top-0 bottom-0 z-50",
        "w-full sm:w-96 md:w-80 border-l bg-background flex flex-col flex-shrink-0",
        "transition-transform duration-300 md:transition-none",
        "shadow-2xl md:shadow-none"
      )}>
        {/* Header */}
        <div className="flex-shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 border-b">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base sm:text-lg font-semibold">Gestión Operativa</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-4">
        <Tabs defaultValue="filters" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-9 sm:h-10">
            <TabsTrigger value="filters" className="text-xs sm:text-sm">Filtros</TabsTrigger>
            <TabsTrigger value="today" className="relative text-xs sm:text-sm">
              Hoy
              {tareasCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-1 sm:ml-1.5 h-4 sm:h-5 min-w-[16px] sm:min-w-[20px] px-1 sm:px-1.5 text-[9px] sm:text-[10px] bg-blue-500 hover:bg-blue-500"
                >
                  {tareasCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="alerts" className="relative text-xs sm:text-sm">
              Alertas
              {alertasCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 sm:ml-1.5 h-4 sm:h-5 min-w-[16px] sm:min-w-[20px] px-1 sm:px-1.5 text-[9px] sm:text-[10px]"
                >
                  {alertasCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="filters" className="mt-3 sm:mt-4">
            {filters && onFilterChange && (
              <FiltersTab
                filters={filters}
                onFilterChange={onFilterChange}
                habitaciones={habitaciones}
              />
            )}
          </TabsContent>

          <TabsContent value="today" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            <TodayTab
              onReservationClick={onReservationClick}
              checkins={tareas.checkins}
              checkouts={tareas.checkouts}
            />
          </TabsContent>

          <TabsContent value="alerts" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            <AlertsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </>
  )
}

