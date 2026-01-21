'use client'

import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FilterX, CalendarIcon } from 'lucide-react'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { RackHabitacion } from '@/lib/actions/rack'

export type FilterState = {
  tipoId: string
  categoriaId: string
  estadoLimpieza: string
  estadoOcupacion: string
  estadoServicio: string
  // Nuevo: Filtro de disponibilidad por fechas
  fechaDisponibilidadDesde: string | null
  fechaDisponibilidadHasta: string | null
}

export const initialFilters: FilterState = {
  tipoId: 'all',
  categoriaId: 'all',
  estadoLimpieza: 'all',
  estadoOcupacion: 'all',
  estadoServicio: 'all',
  fechaDisponibilidadDesde: null,
  fechaDisponibilidadHasta: null
}

type Props = {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  habitaciones: RackHabitacion[]
}

export function FiltersTab({ filters, onFilterChange, habitaciones }: Props) {
  // Extraer opciones únicas
  const tipos = Array.from(new Set(habitaciones.map(h => JSON.stringify({ id: h.tipo_id, nombre: h.tipos_habitacion.nombre }))))
    .map(s => JSON.parse(s))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const categorias = Array.from(new Set(habitaciones.map(h => JSON.stringify({ id: h.categoria_id, nombre: h.categorias_habitacion.nombre }))))
    .map(s => JSON.parse(s))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const handleReset = () => {
    onFilterChange(initialFilters)
  }

  const updateFilter = (key: keyof FilterState, value: string) => {
    // ToggleGroup returns undefined if unselected (when clicking active item), treat as 'all' or keep current logic
    if (!value) return
    onFilterChange({ ...filters, [key]: value })
  }

  const updateDateFilter = (key: 'fechaDisponibilidadDesde' | 'fechaDisponibilidadHasta', value: string | null) => {
    onFilterChange({ ...filters, [key]: value || null })
  }

  const clearDateFilters = () => {
    onFilterChange({
      ...filters,
      fechaDisponibilidadDesde: null,
      fechaDisponibilidadHasta: null
    })
  }

  // Contar filtros activos (excluyendo fechas null)
  const activeFiltersCount = Object.entries(filters).filter(([key, v]) => {
    if (key === 'fechaDisponibilidadDesde' || key === 'fechaDisponibilidadHasta') {
      return v !== null
    }
    return v !== 'all'
  }).length

  const hasDateFilter = filters.fechaDisponibilidadDesde || filters.fechaDisponibilidadHasta

  return (
    <div className="space-y-5">
      {/* Header Minimalista */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Filtros Activos</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px] font-medium">
              {activeFiltersCount}
            </Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-xs"
          >
            <FilterX className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {/* Buscar Disponibilidad por Fechas */}
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <Label className="text-xs font-semibold">Buscar Disponibilidad</Label>
            </div>
            {hasDateFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateFilters}
                className="h-6 px-2 text-xs"
              >
                <FilterX className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Desde */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Desde</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-8 justify-start text-left font-normal text-xs",
                      !filters.fechaDisponibilidadDesde && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {filters.fechaDisponibilidadDesde
                      ? format(parse(filters.fechaDisponibilidadDesde, 'yyyy-MM-dd', new Date()), 'dd MMM', { locale: es })
                      : 'Seleccionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.fechaDisponibilidadDesde ? parse(filters.fechaDisponibilidadDesde, 'yyyy-MM-dd', new Date()) : undefined}
                    onSelect={(date) => updateDateFilter('fechaDisponibilidadDesde', date ? format(date, 'yyyy-MM-dd') : null)}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Hasta */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Hasta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-8 justify-start text-left font-normal text-xs",
                      !filters.fechaDisponibilidadHasta && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {filters.fechaDisponibilidadHasta
                      ? format(parse(filters.fechaDisponibilidadHasta, 'yyyy-MM-dd', new Date()), 'dd MMM', { locale: es })
                      : 'Seleccionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.fechaDisponibilidadHasta ? parse(filters.fechaDisponibilidadHasta, 'yyyy-MM-dd', new Date()) : undefined}
                    onSelect={(date) => updateDateFilter('fechaDisponibilidadHasta', date ? format(date, 'yyyy-MM-dd') : null)}
                    locale={es}
                    disabled={filters.fechaDisponibilidadDesde ? (date) => date < parse(filters.fechaDisponibilidadDesde!, 'yyyy-MM-dd', new Date()) : undefined}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {hasDateFilter && (
            <p className="text-[10px] text-muted-foreground">
              Mostrando habitaciones disponibles en el rango seleccionado
            </p>
          )}
        </div>

        <Separator />

        {/* Selects: Tipo, Categoría, Estado Servicio */}
        <div className="space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tipo</Label>
            <Select value={filters.tipoId} onValueChange={(v) => updateFilter('tipoId', v)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {tipos.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Categoría</Label>
            <Select value={filters.categoriaId} onValueChange={(v) => updateFilter('categoriaId', v)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categorias.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado Servicio */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado Servicio</Label>
            <Select value={filters.estadoServicio} onValueChange={(v) => updateFilter('estadoServicio', v)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="OPERATIVA">Operativa</SelectItem>
                <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                <SelectItem value="FUERA_SERVICIO">Fuera de Servicio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-1" />

        {/* Estado de Ocupación - Toggle Group */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ocupación</Label>
          <ToggleGroup
            type="single"
            value={filters.estadoOcupacion}
            onValueChange={(v) => v && updateFilter('estadoOcupacion', v)}
            className="justify-start w-full"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="all" className="flex-1">Todas</ToggleGroupItem>
            <ToggleGroupItem value="LIBRE" className="flex-1 data-[state=on]:bg-green-100 data-[state=on]:text-green-700 data-[state=on]:border-green-200 dark:data-[state=on]:bg-green-900/20 dark:data-[state=on]:text-green-400">Libres</ToggleGroupItem>
            <ToggleGroupItem value="OCUPADA" className="flex-1 data-[state=on]:bg-red-100 data-[state=on]:text-red-700 data-[state=on]:border-red-200 dark:data-[state=on]:bg-red-900/20 dark:data-[state=on]:text-red-400">Ocupadas</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Estado de Limpieza - Grid Vertical */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Limpieza</Label>
          <ToggleGroup
            type="single"
            value={filters.estadoLimpieza}
            onValueChange={(v) => v && updateFilter('estadoLimpieza', v)}
            className="grid grid-cols-2 gap-2 w-full"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="all" className="w-full">Todas</ToggleGroupItem>
            <ToggleGroupItem value="LIMPIA" className="w-full data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700 data-[state=on]:border-blue-200 dark:data-[state=on]:bg-blue-900/20 dark:data-[state=on]:text-blue-400">Limpias</ToggleGroupItem>
            <ToggleGroupItem value="SUCIA" className="w-full data-[state=on]:bg-amber-100 data-[state=on]:text-amber-700 data-[state=on]:border-amber-200 dark:data-[state=on]:bg-amber-900/20 dark:data-[state=on]:text-amber-400">Sucias</ToggleGroupItem>
            <ToggleGroupItem value="EN_LIMPIEZA" className="w-full data-[state=on]:bg-indigo-100 data-[state=on]:text-indigo-700 data-[state=on]:border-indigo-200 dark:data-[state=on]:bg-indigo-900/20 dark:data-[state=on]:text-indigo-400">Limpiando</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </div>
  )
}
