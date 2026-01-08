'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Plus, PanelRight, LayoutGrid, LayoutList, User, DoorOpen, Hotel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KpiChips } from './kpi-chips'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { buscarGlobal } from '@/lib/actions/rack'
import { cn } from '@/lib/utils'
import type { RackKPIs } from '@/lib/actions/rack'

type Props = {
  onToggleSidebar: () => void
  kpis: RackKPIs
  viewMode: 'rack' | 'cards'
  onViewModeChange: (mode: 'rack' | 'cards') => void
}

export function CommandBar({ onToggleSidebar, kpis, viewMode, onViewModeChange }: Props) {
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

  // Búsqueda con debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await buscarGlobal(searchQuery)
        setSearchResults(results)
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
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        {/* Left side: Logo + Search */}
        <div className="flex items-center gap-4">
          {/* Logo/Title */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Rack</h1>
          </div>

          {/* Omnibox - Buscador Global */}
          <div className="relative w-96" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar huésped, reserva o habitación..."
              className="pl-9"
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
                    {searchResults.map((result, index) => (
                      <button
                        key={index}
                        className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors"
                        onClick={() => {
                          // TODO: Implementar acción de click (scroll al elemento, abrir detalle)
                          setShowResults(false)
                          setSearchQuery('')
                        }}
                      >
                        {getIconForType(result.type)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {result.titulo}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {result.subtitulo}
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
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && onViewModeChange(value as 'rack' | 'cards')}>
            <ToggleGroupItem value="rack" aria-label="Vista Rack" size="sm">
              <LayoutList className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="cards" aria-label="Vista Tarjetas" size="sm">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* KPI Chips */}
          <KpiChips kpis={kpis} />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onToggleSidebar}>
              <PanelRight className="h-4 w-4" />
            </Button>
            <Button>
              <Plus className="h-4 w-4" />
              Nueva Reserva
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
