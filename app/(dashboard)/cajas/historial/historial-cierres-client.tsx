'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getHistorialTurnos } from '@/lib/actions/cajas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, AlertTriangle, XCircle, User, Eye, ListFilter } from 'lucide-react'
import Link from 'next/link'

type TurnoHistorial = {
  id: string
  fecha_cierre: string | null
  monto_apertura_efectivo: number
  monto_cierre_teorico_efectivo: number | null
  monto_cierre_real_efectivo: number | null
  caja: { nombre: string }
  usuario: { nombres: string; apellidos: string }
}

export function HistorialCierresClient() {
  const [turnos, setTurnos] = useState<TurnoHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    usuario_id: '',
    caja_id: '',
    solo_descuadres: false
  })

  const cargarHistorial = async () => {
    setLoading(true)
    const result = await getHistorialTurnos(filtros)
    if (result.success && result.data) {
      setTurnos(result.data as TurnoHistorial[])
    }
    setLoading(false)
  }

  useEffect(() => {
    cargarHistorial()
  }, [filtros.solo_descuadres])

  const getEstadoCuadreInfo = (turno: TurnoHistorial) => {
    const diferencia = (turno.monto_cierre_real_efectivo || 0) - (turno.monto_cierre_teorico_efectivo || 0)
    const tolerancia = 0.50

    if (Math.abs(diferencia) <= tolerancia) {
      return {
        label: 'Cuadrado',
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />
      }
    } else if (diferencia > 0) {
      return {
        label: 'Sobrante',
        color: 'text-amber-600 bg-amber-50 border-amber-200',
        icon: <AlertTriangle className="h-3 w-3 mr-1" />
      }
    } else {
      return {
        label: 'Faltante',
        color: 'text-rose-600 bg-rose-50 border-rose-200',
        icon: <XCircle className="h-3 w-3 mr-1" />
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Contenedor Unificado (Filtros + Tabla) */}
      <Card className="bg-white dark:bg-card border shadow-sm rounded-xl overflow-hidden">

        {/* Barra de Filtros Minimalista */}
        <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800">

          {/* Izquierda: Selector de Usuarios */}
          <div className="flex items-center gap-3">
            <div className="flex items-center text-muted-foreground">
              <ListFilter className="w-4 h-4 mr-2" />
              <span className="text-sm">Filtros:</span>
            </div>

            <Select
              value={filtros.usuario_id || 'todos'}
              onValueChange={(value) => setFiltros((prev) => ({ ...prev, usuario_id: value === 'todos' ? '' : value }))}
            >
              <SelectTrigger className="w-[200px] h-9 text-sm border-gray-200 bg-gray-50/50 focus:bg-white transition-colors">
                <SelectValue placeholder="Todos los usuarios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los usuarios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Derecha: Toggle Descuadres */}
          <div className="flex items-center gap-2">
            <Switch
              id="solo-descuadres"
              checked={filtros.solo_descuadres}
              onCheckedChange={(checked) => setFiltros(prev => ({ ...prev, solo_descuadres: checked }))}
            />
            <Label htmlFor="solo-descuadres" className="text-sm font-normal text-muted-foreground cursor-pointer select-none">
              Solo descuadres
            </Label>
          </div>
        </div>

        {/* Tabla Limpia */}
        <div className="relative w-full overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground opacity-60">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-sm">Cargando datos...</span>
            </div>
          ) : turnos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No se encontraron registros de cierres
            </div>
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-gray-100">
                  <TableHead className="pl-6 h-12 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha Cierre</TableHead>
                  <TableHead className="h-12 text-xs font-medium text-muted-foreground uppercase tracking-wide">Cajero</TableHead>
                  <TableHead className="h-12 text-xs font-medium text-muted-foreground uppercase tracking-wide">Caja</TableHead>
                  <TableHead className="h-12 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Inicial</TableHead>
                  <TableHead className="h-12 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Ventas</TableHead>
                  <TableHead className="h-12 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Final</TableHead>
                  <TableHead className="h-12 text-xs font-medium text-muted-foreground uppercase tracking-wide pl-8">Estado</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turnos.map((turno) => {
                  const info = getEstadoCuadreInfo(turno)
                  const ventas = (turno.monto_cierre_teorico_efectivo || 0) - turno.monto_apertura_efectivo

                  return (
                    <TableRow key={turno.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                      {/* Fecha */}
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {turno.fecha_cierre ? format(new Date(turno.fecha_cierre), 'dd MMM yyyy', { locale: es }) : '-'}
                          </span>
                          <span className="text-xs text-muted-foreground mt-0.5 font-medium">
                            {turno.fecha_cierre ? format(new Date(turno.fecha_cierre), 'hh:mm a', { locale: es }) : '-'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Cajero */}
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-gray-100 rounded-full text-gray-500">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {turno.usuario.nombres}
                          </span>
                        </div>
                      </TableCell>

                      {/* Caja */}
                      <TableCell className="py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {turno.caja.nombre}
                        </span>
                      </TableCell>

                      {/* Inicial */}
                      <TableCell className="text-right py-4 font-medium text-gray-600">
                        S/ {turno.monto_apertura_efectivo.toFixed(2)}
                      </TableCell>

                      {/* Ventas */}
                      <TableCell className="text-right py-4 font-semibold text-emerald-600">
                        S/ {ventas.toFixed(2)}
                      </TableCell>

                      {/* Final */}
                      <TableCell className="text-right py-4 font-bold text-gray-900 dark:text-white">
                        S/ {(turno.monto_cierre_teorico_efectivo || 0).toFixed(2)}
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="pl-6 py-4">
                        <Badge
                          variant="outline"
                          className={`font-normal px-2.5 py-0.5 text-xs rounded-full border ${info.color}`}
                        >
                          {info.icon}
                          {info.label}
                        </Badge>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="pr-6 py-4 text-right">
                        <Link href={`/cajas/historial/${turno.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900 hover:bg-gray-100">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  )
}
