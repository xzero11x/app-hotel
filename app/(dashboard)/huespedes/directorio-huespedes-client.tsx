'use client'

import { useState } from 'react'
import { DirectorioHuesped } from '@/lib/actions/huespedes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, Star, AlertCircle, Eye, Mail, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { HuespedDetailSheet } from '@/components/huespedes/huesped-detail-sheet'

type Props = {
  huespedes: DirectorioHuesped[]
}

export function DirectorioHuespedesClient({ huespedes: initialHuespedes }: Props) {
  const [huespedes, setHuespedes] = useState(initialHuespedes)
  const [busqueda, setBusqueda] = useState('')
  const [filtroVIP, setFiltroVIP] = useState(false)
  const [filtroAlertas, setFiltroAlertas] = useState(false)
  const [huespedSeleccionado, setHuespedSeleccionado] = useState<string | null>(null)

  // Filtrado local
  const huespedesFiltrados = huespedes.filter(h => {
    const matchBusqueda = busqueda === '' || 
      h.nombres.toLowerCase().includes(busqueda.toLowerCase()) ||
      h.apellidos.toLowerCase().includes(busqueda.toLowerCase()) ||
      h.numero_documento.includes(busqueda) ||
      h.telefono?.includes(busqueda)

    const matchVIP = !filtroVIP || h.es_frecuente
    const matchAlertas = !filtroAlertas || h.notas_internas

    return matchBusqueda && matchVIP && matchAlertas
  })

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Huéspedes</CardTitle>
              <CardDescription>
                {huespedesFiltrados.length} de {huespedes.length} registros
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filtroVIP ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroVIP(!filtroVIP)}
              >
                <Star className="mr-2 h-4 w-4" />
                Solo VIP
              </Button>
              <Button
                variant={filtroAlertas ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroAlertas(!filtroAlertas)}
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                Con Alertas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Buscador */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, documento o teléfono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tabla */}
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium">Huésped</th>
                    <th className="p-3 text-left font-medium">Documento</th>
                    <th className="p-3 text-left font-medium">Contacto</th>
                    <th className="p-3 text-center font-medium">Visitas</th>
                    <th className="p-3 text-left font-medium">Última Visita</th>
                    <th className="p-3 text-left font-medium">Estado</th>
                    <th className="p-3 text-center font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {huespedesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No se encontraron huéspedes
                      </td>
                    </tr>
                  ) : (
                    huespedesFiltrados.map((huesped) => (
                      <tr key={huesped.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {huesped.nombres} {huesped.apellidos}
                            </span>
                            {huesped.nacionalidad && (
                              <span className="text-xs text-muted-foreground">
                                {getNacionalidadFlag(huesped.nacionalidad)} {huesped.nacionalidad}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs">{huesped.numero_documento}</span>
                            <span className="text-xs text-muted-foreground">{huesped.tipo_documento}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {huesped.telefono && (
                              <div className="flex items-center gap-1 text-xs">
                                <Phone className="h-3 w-3" />
                                {huesped.telefono}
                              </div>
                            )}
                            {huesped.correo && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {huesped.correo}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={huesped.total_visitas >= 3 ? 'default' : 'secondary'}>
                            {huesped.total_visitas}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {huesped.ultima_visita ? (
                            <div className="flex flex-col">
                              <span className="text-xs">
                                {format(new Date(huesped.ultima_visita), 'dd MMM yyyy', { locale: es })}
                              </span>
                              {huesped.ultima_habitacion && (
                                <span className="text-xs text-muted-foreground">
                                  Hab. {huesped.ultima_habitacion}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin visitas</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {huesped.es_frecuente && (
                              <Badge variant="default" className="w-fit">
                                <Star className="mr-1 h-3 w-3" />
                                VIP
                              </Badge>
                            )}
                            {huesped.notas_internas && (
                              <Badge variant="destructive" className="w-fit">
                                <AlertCircle className="mr-1 h-3 w-3" />
                                Alerta
                              </Badge>
                            )}
                            {!huesped.es_frecuente && !huesped.notas_internas && (
                              <Badge variant="outline">Normal</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setHuespedSeleccionado(huesped.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sheet de detalle */}
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

function getNacionalidadFlag(nacionalidad: string): string {
  const flags: Record<string, string> = {
    'Perú': '🇵🇪',
    'Argentina': '🇦🇷',
    'Chile': '🇨🇱',
    'Colombia': '🇨🇴',
    'Ecuador': '🇪🇨',
    'Bolivia': '🇧🇴',
    'Brasil': '🇧🇷',
    'Uruguay': '🇺🇾',
    'Paraguay': '🇵🇾',
    'Venezuela': '🇻🇪',
    'México': '🇲🇽',
    'España': '🇪🇸',
    'Estados Unidos': '🇺🇸',
    'Canadá': '🇨🇦'
  }
  return flags[nacionalidad] || '🌍'
}
