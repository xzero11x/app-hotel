'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getDetalleHuesped,
  actualizarNotasHuesped,
  toggleClienteFrecuente
} from '@/lib/actions/huespedes'
import {
  User,
  Star,
  AlertCircle,
  Calendar,
  Hotel,
  CreditCard,
  DollarSign,
  MapPin,
  Mail,
  Phone,
  FileText,
  Loader2,
  Save,
  CheckCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

type Props = {
  huespedId: string
  open: boolean
  onClose: () => void
}

export function HuespedDetailSheet({ huespedId, open, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [huesped, setHuesped] = useState<any>(null)
  const [notas, setNotas] = useState('')
  const [notasOriginales, setNotasOriginales] = useState('')

  useEffect(() => {
    if (open) {
      cargarDatos()
    }
  }, [huespedId, open])

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await getDetalleHuesped(huespedId)
      setHuesped(data)
      setNotas(data?.notas_internas || '')
      setNotasOriginales(data?.notas_internas || '')
    } catch (error) {
      console.error('Error al cargar huésped:', error)
      toast.error('Error al cargar datos del huésped')
    } finally {
      setLoading(false)
    }
  }

  async function handleGuardarNotas() {
    if (notas === notasOriginales) return

    setSaving(true)
    try {
      await actualizarNotasHuesped(huespedId, notas)
      setNotasOriginales(notas)
      toast.success('Notas actualizadas')
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar notas')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleVIP() {
    try {
      await toggleClienteFrecuente(huespedId, !huesped.es_frecuente)
      setHuesped({ ...huesped, es_frecuente: !huesped.es_frecuente })
      toast.success(huesped.es_frecuente ? 'Cliente marcado como Normal' : 'Cliente marcado como VIP')
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar estado')
    }
  }

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  if (!huesped) {
    return null
  }

  const estadoBadge = huesped.es_frecuente ? (
    <Badge className="ml-2">
      <Star className="mr-1 h-3 w-3" />
      VIP
    </Badge>
  ) : (
    <Badge variant="outline" className="ml-2">Normal</Badge>
  )

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center">
              {huesped.nombres} {huesped.apellidos}
              {estadoBadge}
            </SheetTitle>
            <Button
              size="sm"
              variant={huesped.es_frecuente ? 'outline' : 'default'}
              onClick={handleToggleVIP}
            >
              <Star className="mr-2 h-4 w-4" />
              {huesped.es_frecuente ? 'Quitar VIP' : 'Marcar VIP'}
            </Button>
          </div>
          <SheetDescription>
            {huesped.tipo_documento}: {huesped.numero_documento}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="info" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="historial">
              Historial ({huesped.estadias?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="notas">
              Notas
              {huesped.notas_internas && (
                <AlertCircle className="ml-1 h-3 w-3 text-orange-500" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab Información */}
          <TabsContent value="info" className="space-y-4">
            {/* Estadísticas Rápidas */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Hotel className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{huesped.total_visitas}</div>
                  <p className="text-xs text-muted-foreground">Visitas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">{huesped.visitas_completadas}</div>
                  <p className="text-xs text-muted-foreground">Completadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat('es-PE', {
                      style: 'currency',
                      currency: 'PEN',
                      minimumFractionDigits: 0
                    }).format(huesped.gasto_total_historico || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Gastado</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <div className="text-xs font-bold">
                    {huesped.ultima_visita
                      ? format(new Date(huesped.ultima_visita), 'dd MMM yy', { locale: es })
                      : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Última visita</p>
                </CardContent>
              </Card>
            </div>

            {/* Datos Personales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos Personales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {huesped.nacionalidad && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{huesped.nacionalidad}</span>
                  </div>
                )}
                {huesped.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{huesped.telefono}</span>
                  </div>
                )}
                {huesped.correo && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{huesped.correo}</span>
                  </div>
                )}
                {huesped.fecha_nacimiento && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(huesped.fecha_nacimiento), 'dd MMMM yyyy', { locale: es })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Últimos Pagos */}
            {huesped.pagos && huesped.pagos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Últimos Pagos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {huesped.pagos.slice(0, 5).map((pago: any) => (
                      <div key={pago.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(pago.fecha_pago), 'dd MMM yyyy', { locale: es })}</span>
                          <Badge variant="outline" className="text-xs">
                            {pago.metodo_pago}
                          </Badge>
                        </div>
                        <span className="font-semibold">S/ {pago.monto.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab Historial */}
          <TabsContent value="historial">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {huesped.estadias && huesped.estadias.length > 0 ? (
                  huesped.estadias.map((estadia: any) => {
                    const habitacion = Array.isArray(estadia.habitaciones)
                      ? estadia.habitaciones[0]
                      : estadia.habitaciones
                    
                    return (
                      <Card key={estadia.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">
                              {estadia.codigo_reserva}
                            </CardTitle>
                            <Badge variant={getEstadoBadgeVariant(estadia.estado)}>
                              {estadia.estado}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Hotel className="h-4 w-4 text-muted-foreground" />
                            <span>
                              Habitación {habitacion?.numero} (Piso {habitacion?.piso})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {format(new Date(estadia.fecha_entrada), 'dd MMM', { locale: es })} →{' '}
                              {format(new Date(estadia.fecha_salida), 'dd MMM yyyy', { locale: es })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">S/ {estadia.precio_pactado.toFixed(2)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No hay historial de estadías
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tab Notas */}
          <TabsContent value="notas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notas Internas
                </CardTitle>
                <CardDescription>
                  Alertas, preferencias o incidentes. Visible solo para recepción.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ejemplo: Cliente prefiere habitación con vista, siempre pide factura..."
                  rows={8}
                  className="resize-none"
                />
                <Button
                  onClick={handleGuardarNotas}
                  disabled={saving || notas === notasOriginales}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar Notas
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function getEstadoBadgeVariant(estado: string): "default" | "secondary" | "destructive" | "outline" {
  switch (estado) {
    case 'CHECKED_IN':
      return 'default'
    case 'CHECKED_OUT':
      return 'secondary'
    case 'CANCELADA':
      return 'destructive'
    default:
      return 'outline'
  }
}
