"use client"

import { useState, useMemo } from "react"
import { DirectorioHuesped } from "@/lib/actions/huespedes"
import { DataTable } from '@/components/tables/data-table'
import { columns } from "./columns"
import { HuespedDetailSheet } from "@/components/huespedes/huesped-detail-sheet"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Star, AlertCircle, X } from "lucide-react"

type Props = {
  huespedes: DirectorioHuesped[]
}

export function DirectorioHuespedesClient({ huespedes }: Props) {
  const [huespedSeleccionado, setHuespedSeleccionado] = useState<string | null>(null)
  const [filtroVIP, setFiltroVIP] = useState(false)
  const [filtroAlertas, setFiltroAlertas] = useState(false)
  const [filtroTipoDoc, setFiltroTipoDoc] = useState<string>("TODOS")
  const [filtroNacionalidad, setFiltroNacionalidad] = useState<string>("TODOS")

  // Obtener nacionalidades únicas para el selector
  const nacionalidadesUnicas = useMemo(() => {
    const set = new Set<string>()
    huespedes.forEach(h => {
      if (h.nacionalidad) set.add(h.nacionalidad)
    })
    return Array.from(set).sort()
  }, [huespedes])

  // Filtrado combinado
  const huespedesFiltrados = useMemo(() => {
    return huespedes.filter(h => {
      // Filtro VIP
      if (filtroVIP && !h.es_frecuente) return false

      // Filtro Alertas
      if (filtroAlertas && !h.notas_internas) return false

      // Filtro Tipo Documento
      if (filtroTipoDoc !== "TODOS" && h.tipo_documento !== filtroTipoDoc) return false

      // Filtro Nacionalidad
      if (filtroNacionalidad !== "TODOS" && h.nacionalidad !== filtroNacionalidad) return false

      return true
    })
  }, [huespedes, filtroVIP, filtroAlertas, filtroTipoDoc, filtroNacionalidad])

  // Contar filtros activos
  const filtrosActivos = [
    filtroVIP,
    filtroAlertas,
    filtroTipoDoc !== "TODOS",
    filtroNacionalidad !== "TODOS"
  ].filter(Boolean).length

  const limpiarFiltros = () => {
    setFiltroVIP(false)
    setFiltroAlertas(false)
    setFiltroTipoDoc("TODOS")
    setFiltroNacionalidad("TODOS")
  }

  // Componente de filtros que irá en el toolbar del DataTable
  const FiltersToolbar = (
    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
      <Button
        variant={filtroVIP ? "default" : "outline"}
        size="sm"
        className="h-8 px-2 sm:px-3 flex-shrink-0"
        onClick={() => setFiltroVIP(!filtroVIP)}
      >
        <Star className="h-3 w-3 sm:mr-1" />
        <span className="hidden sm:inline">VIP</span>
      </Button>

      <Button
        variant={filtroAlertas ? "default" : "outline"}
        size="sm"
        className="h-8 px-2 sm:px-3 flex-shrink-0"
        onClick={() => setFiltroAlertas(!filtroAlertas)}
      >
        <AlertCircle className="h-3 w-3 sm:mr-1" />
        <span className="hidden sm:inline">Alertas</span>
      </Button>

      <Select value={filtroTipoDoc} onValueChange={setFiltroTipoDoc}>
        <SelectTrigger className="w-[90px] sm:w-[120px] h-8 text-xs sm:text-sm flex-shrink-0">
          <SelectValue placeholder="Doc" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TODOS">Todos</SelectItem>
          <SelectItem value="DNI">DNI</SelectItem>
          <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
          <SelectItem value="CE">C. Ext.</SelectItem>
          <SelectItem value="OTRO">Otro</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filtroNacionalidad} onValueChange={setFiltroNacionalidad}>
        <SelectTrigger className="w-[90px] sm:w-[130px] h-8 text-xs sm:text-sm flex-shrink-0">
          <SelectValue placeholder="País" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TODOS">Todos</SelectItem>
          {nacionalidadesUnicas.map(nac => (
            <SelectItem key={nac} value={nac}>
              {nac}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filtrosActivos > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex-shrink-0"
          onClick={limpiarFiltros}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <span className="text-[10px] sm:text-xs text-muted-foreground ml-1 sm:ml-2">
        {huespedesFiltrados.length}/{huespedes.length}
      </span>
    </div>
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={huespedesFiltrados}
        searchKey="nombres"
        searchPlaceholder="Buscar nombre, documento, teléfono..."
        toolbar={FiltersToolbar}
        meta={{
          onVerDetalle: setHuespedSeleccionado,
        }}
      />

      {huespedSeleccionado && (
        <HuespedDetailSheet
          huespedId={huespedSeleccionado}
          open={!!huespedSeleccionado}
          onClose={() => setHuespedSeleccionado(null)}
        />
      )}
    </>
  )
}
