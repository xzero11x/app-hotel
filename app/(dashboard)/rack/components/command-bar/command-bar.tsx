'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Plus, LayoutGrid, LayoutList, User, DoorOpen, Hotel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KpiChips } from './kpi-chips'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { buscarGlobal } from '@/lib/actions/rack'
import { cn } from '@/lib/utils'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// Definimos el tipo localmente para evitar problemas de exportación
export type RackKPIs = {
  llegadas: number
  salidas: number
  sucias: number
  ocupadas: number
}

type Props = {
  kpis: RackKPIs
  viewMode: 'rack' | 'cards'
  onViewModeChange: (mode: 'rack' | 'cards') => void
  onSearchSelect?: (type: 'reserva' | 'huesped' | 'habitacion', id: string) => void
  onNewReservation?: () => void
}

export function CommandBar({ kpis, viewMode, onViewModeChange, onSearchSelect, onNewReservation }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Cerrar resultados al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Búsqueda con debounce y aplanado de resultados
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const data = await buscarGlobal(searchQuery)

        // Aplanar resultados para la lista unificada
        const flatResults = [
          ...data.reservas.map((r: any) => ({
            type: 'reserva',
            title: `Reserva ${r.codigo_reserva}`,
            subtitle: `Hab: ${r.habitaciones?.numero} - ${new Date(r.fecha_entrada).toLocaleDateString()}`,
            data: r
          })),
          ...data.huespedes.map((h: any) => ({
            type: 'huesped',
            title: `${h.nombres} ${h.apellidos}`,
            subtitle: `Doc: ${h.numero_documento}`,
            data: h
          })),
          ...data.habitaciones.map((h: any) => ({
            type: 'habitacion',
            title: `Habitación ${h.numero}`,
            subtitle: h.estado_ocupacion,
            data: h
          }))
        ]

        setSearchResults(flatResults)
        setShowResults(true)
      } catch (error) {
        console.error('Error en búsqueda:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const getIconForType = (type: string) => {
    if (type === 'huesped') return <User className="h-4 w-4 text-blue-500" />
    if (type === 'reserva') return <DoorOpen className="h-4 w-4 text-green-500" />
    if (type === 'habitacion') return <Hotel className="h-4 w-4 text-purple-500" />
    return null
  }

  return (
    <div className="border-b bg-background">
      <div className="flex h-14 sm:h-16 items-center px-2 sm:px-3 md:px-4 gap-2 sm:gap-3 md:gap-4">

        {/* Left: Trigger + Breadcrumb */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-fit">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 sm:mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList className="text-xs sm:text-sm">
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Rack</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Center: Search Box */}
        <div className="flex-1 max-w-md mx-auto hidden md:block">
          <div className="relative" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar huésped, reserva, habitación..."
              className="pl-9 h-9 bg-muted/40 border-muted-foreground/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
            />

            {/* Resultados flotantes */}
            {showResults && (
              <div className="absolute top-full mt-1 w-full bg-popover border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-sm text-center text-muted-foreground">
                    Buscando...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-sm text-center text-muted-foreground">
                    No se encontraron resultados
                  </div>
                ) : (
                  <div className="py-2">
                    {searchResults.map((result: any, index: number) => (
                      <button
                        key={index}
                        className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors"
                        onClick={() => {
                          if (onSearchSelect && result.data?.id) {
                            onSearchSelect(result.type, result.data.id)
                          }
                          setShowResults(false)
                          setSearchQuery('')
                        }}
                      >
                        {getIconForType(result.type)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {result.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side: KPIs + Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* View Toggle - OCULTO EN MÓVIL (siempre cards en mobile) */}
          <div className="hidden md:flex">
            <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && onViewModeChange(value as 'rack' | 'cards')}>
              <ToggleGroupItem value="rack" aria-label="Vista Rack" size="sm" className="h-8 w-8 p-0">
                <LayoutList className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="cards" aria-label="Vista Tarjetas" size="sm" className="h-8 w-8 p-0">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="h-4 w-px bg-border mx-1 sm:mx-2 hidden md:block" />

          <div className="hidden lg:block">
            <KpiChips kpis={kpis} />
          </div>

          <div className="h-4 w-px bg-border mx-1 sm:mx-2 hidden lg:block" />

          {/* New Reservation */}
          <Button size="sm" className="h-8 text-xs sm:text-sm" onClick={onNewReservation}>
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nueva Reserva</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
