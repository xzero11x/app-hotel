'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TurnoDetailSheet } from '@/components/cajas/turno-detail-sheet'
import type { CierrePasado } from '@/lib/actions/cajas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search, Eye } from 'lucide-react'

interface Props {
  cierres: CierrePasado[]
}

export function HistorialCierresTable({ cierres }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<string | null>(null)

  // Filtrar cierres
  const cierresFiltrados = cierres.filter((cierre) => {
    const searchLower = busqueda.toLowerCase()
    return (
      cierre.caja_nombre.toLowerCase().includes(searchLower) ||
      cierre.usuario_nombre.toLowerCase().includes(searchLower) ||
      cierre.estado.toLowerCase().includes(searchLower)
    )
  })

  const getEstadoBadge = (estado: CierrePasado['estado']) => {
    const variants = {
      CUADRADA: { variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-300', icon: '🟢' },
      FALTANTE: { variant: 'destructive' as const, className: 'bg-red-100 text-red-800 border-red-300', icon: '🔴' },
      SOBRANTE: { variant: 'default' as const, className: 'bg-blue-100 text-blue-800 border-blue-300', icon: '🔵' }
    }
    const config = variants[estado]
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.icon} {estado}
      </Badge>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Buscador */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por caja, usuario o estado..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha Cierre</TableHead>
                <TableHead>Caja / Usuario</TableHead>
                <TableHead className="text-right">Apertura</TableHead>
                <TableHead className="text-right">Sistema</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cierresFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {busqueda ? 'No se encontraron resultados' : 'No hay cierres registrados'}
                  </TableCell>
                </TableRow>
              ) : (
                cierresFiltrados.map((cierre) => (
                  <TableRow key={cierre.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {format(new Date(cierre.fecha_cierre), 'dd/MM/yyyy', { locale: es })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(cierre.fecha_cierre), 'HH:mm', { locale: es })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{cierre.caja_nombre}</p>
                        <p className="text-xs text-muted-foreground">{cierre.usuario_nombre}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      S/ {cierre.monto_apertura.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      S/ {cierre.monto_cierre_sistema.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      S/ {cierre.monto_cierre_declarado.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getEstadoBadge(cierre.estado)}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${
                      cierre.diferencia < 0 ? 'text-red-600' : 
                      cierre.diferencia > 0 ? 'text-blue-600' : 
                      'text-green-600'
                    }`}>
                      {cierre.diferencia >= 0 ? '+' : ''}S/ {cierre.diferencia.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTurnoSeleccionado(cierre.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Sheet de detalle */}
      <TurnoDetailSheet
        turnoId={turnoSeleccionado}
        open={!!turnoSeleccionado}
        onClose={() => setTurnoSeleccionado(null)}
      />
    </>
  )
}
