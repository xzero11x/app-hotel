'use client'

import { useState, useEffect } from 'react'
import { getHistorialComprobantes, reenviarComprobanteNubefact } from '@/lib/actions/comprobantes'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Eye, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ComprobanteDetailSheet } from '@/components/facturacion/comprobante-detail-sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

type Comprobante = {
  id: string
  fecha_emision: string
  tipo_comprobante: string
  numero_completo: string
  cliente_nombre: string
  cliente_doc: string
  contexto: string
  estado_sunat: string
  total_venta: number
  moneda: string
  emisor_nombre: string
}

export function HistorialVentasTable() {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<'TODAS' | 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO'>('TODAS')
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'ANULADO'>('TODOS')
  const [busqueda, setBusqueda] = useState('')

  // Sheet
  const [selectedComprobanteId, setSelectedComprobanteId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Reenvío
  const [reenviandoId, setReenviandoId] = useState<string | null>(null)

  useEffect(() => {
    cargarComprobantes()
  }, [filtroTipo, filtroEstado, busqueda])

  async function cargarComprobantes() {
    try {
      setLoading(true)
      const data = await getHistorialComprobantes({
        tipo_comprobante: filtroTipo,
        estado_sunat: filtroEstado,
        busqueda: busqueda || undefined
      })
      setComprobantes(data as Comprobante[])
    } catch (error) {
      console.error('Error al cargar comprobantes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleReenviar(comprobanteId: string) {
    setReenviandoId(comprobanteId)
    try {
      const result = await reenviarComprobanteNubefact(comprobanteId)
      if (result.success) {
        toast.success('Comprobante enviado exitosamente a SUNAT')
        cargarComprobantes() // Recargar lista
      } else {
        toast.error(result.error || 'Error al reenviar')
      }
    } catch (error) {
      toast.error('Error al reintentar envío')
    } finally {
      setReenviandoId(null)
    }
  }

  function handleVerDetalle(comprobanteId: string) {
    setSelectedComprobanteId(comprobanteId)
    setSheetOpen(true)
  }

  function getEstadoBadge(estado: string) {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
      'PENDIENTE': { variant: 'secondary', label: 'Pendiente' },
      'ACEPTADO': { variant: 'secondary', className: 'bg-blue-500 text-white dark:bg-blue-600', label: 'Aceptado' },
      'RECHAZADO': { variant: 'destructive', label: 'Rechazado' },
      'ANULADO': { variant: 'outline', label: 'Anulado' }
    }

    const config = variants[estado] || { variant: 'outline' as const, label: estado }

    return (
      <Badge variant={config.variant} className={config.className || ''}>
        {config.label}
      </Badge>
    )
  }

  function getTipoBadge(tipo: string) {
    const variants: Record<string, string> = {
      'BOLETA': 'outline',
      'FACTURA': 'default',
      'NOTA_CREDITO': 'destructive',
      'TICKET_INTERNO': 'secondary'
    }

    return (
      <Badge variant={variants[tipo] as any || 'outline'}>
        {tipo.replace('_', ' ')}
      </Badge>
    )
  }

  // Detectar pendientes con más de 5 minutos
  function isPendienteAntiguo(fecha_emision: string, estado: string): boolean {
    if (estado !== 'PENDIENTE') return false
    const ahora = new Date()
    const emision = new Date(fecha_emision)
    const diffMinutos = (ahora.getTime() - emision.getTime()) / (1000 * 60)
    return diffMinutos > 5
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="filtro-tipo">Tipo de Comprobante</Label>
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
            <SelectTrigger id="filtro-tipo">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todos</SelectItem>
              <SelectItem value="BOLETA">Boletas</SelectItem>
              <SelectItem value="FACTURA">Facturas</SelectItem>
              <SelectItem value="NOTA_CREDITO">Notas de Crédito</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="filtro-estado">Estado SUNAT</Label>
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as any)}>
            <SelectTrigger id="filtro-estado">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="PENDIENTE">Pendientes</SelectItem>
              <SelectItem value="ACEPTADO">Aceptados</SelectItem>
              <SelectItem value="RECHAZADO">Rechazados</SelectItem>
              <SelectItem value="ANULADO">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="busqueda">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="busqueda"
              placeholder="Cliente, documento, número..."
              className="pl-8"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emisión</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Contexto</TableHead>
              <TableHead>Estado SUNAT</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : comprobantes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No se encontraron comprobantes
                </TableCell>
              </TableRow>
            ) : (
              comprobantes.map((comp) => (
                <TableRow key={comp.id}>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{format(new Date(comp.fecha_emision), 'dd MMM yyyy', { locale: es })}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comp.fecha_emision), 'HH:mm', { locale: es })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getTipoBadge(comp.tipo_comprobante)}
                      <span className="font-mono text-sm">{comp.numero_completo}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{comp.cliente_nombre}</span>
                      <span className="text-xs text-muted-foreground">{comp.cliente_doc}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{comp.contexto}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getEstadoBadge(comp.estado_sunat)}
                      {isPendienteAntiguo(comp.fecha_emision, comp.estado_sunat) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Más de 5 minutos pendiente</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {comp.moneda} {comp.total_venta.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Botón Reenviar - solo para PENDIENTE o RECHAZADO */}
                      {(comp.estado_sunat === 'PENDIENTE' || comp.estado_sunat === 'RECHAZADO') && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReenviar(comp.id)}
                                disabled={reenviandoId === comp.id}
                              >
                                {reenviandoId === comp.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Reintentar envío a SUNAT</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVerDetalle(comp.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sheet de detalle */}
      {selectedComprobanteId && (
        <ComprobanteDetailSheet
          comprobanteId={selectedComprobanteId}
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open)
            if (!open) {
              setSelectedComprobanteId(null)
              cargarComprobantes() // Recargar por si hubo cambios
            }
          }}
        />
      )}
    </div>
  )
}
