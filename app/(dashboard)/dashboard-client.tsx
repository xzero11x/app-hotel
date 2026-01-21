'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Hotel,
  Calendar as CalendarIcon,
  AlertCircle,
  FileText,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Loader2
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import type {
  DashboardMetrics,
  IngresosPorMetodoPago,
  TendenciaIngresos,
  ResumenFacturacion,
  DashboardFilters
} from '@/lib/actions/dashboard'
import {
  getDashboardMetrics,
  getIngresosPorMetodoPago,
  getTendenciaIngresos,
  getResumenFacturacion
} from '@/lib/actions/dashboard'
import { DevolucionesPendientesAlert } from '@/components/dashboard/devoluciones-pendientes-alert'

type Props = {
  metrics: DashboardMetrics
  ingresosPorMetodoPago: IngresosPorMetodoPago[]
  tendencia: TendenciaIngresos[]
  facturacion: ResumenFacturacion
  devolucionesPendientes?: any[]
}

type FilterMode = 'mes' | 'anterior' | 'trimestre' | 'custom'

export function DashboardClient({
  metrics: initialMetrics,
  ingresosPorMetodoPago: initialMetodosPago,
  tendencia: initialTendencia,
  facturacion: initialFacturacion,
  devolucionesPendientes
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [filterMode, setFilterMode] = useState<FilterMode>('mes')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [showCalendar, setShowCalendar] = useState(false)

  // Datos actuales
  const [metrics, setMetrics] = useState(initialMetrics)
  const [ingresosPorMetodoPago, setIngresosPorMetodoPago] = useState(initialMetodosPago)
  const [tendencia, setTendencia] = useState(initialTendencia)
  const [facturacion, setFacturacion] = useState(initialFacturacion)

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(value)
  }

  // Obtener filtros según el modo seleccionado
  const getFiltersFromMode = (mode: FilterMode): DashboardFilters | undefined => {
    const hoy = new Date()

    switch (mode) {
      case 'mes':
        return undefined // Sin filtros = mes actual por defecto
      case 'anterior':
        return {
          fechaInicio: startOfMonth(subMonths(hoy, 1)).toISOString(),
          fechaFin: endOfMonth(subMonths(hoy, 1)).toISOString()
        }
      case 'trimestre':
        return {
          fechaInicio: startOfMonth(subMonths(hoy, 2)).toISOString(),
          fechaFin: endOfMonth(hoy).toISOString()
        }
      case 'custom':
        if (dateRange?.from && dateRange?.to) {
          return {
            fechaInicio: dateRange.from.toISOString(),
            fechaFin: dateRange.to.toISOString()
          }
        }
        return undefined
      default:
        return undefined
    }
  }

  // Cargar datos con filtros
  const loadData = (mode: FilterMode) => {
    startTransition(async () => {
      const filters = getFiltersFromMode(mode)

      const [newMetrics, newMetodosPago, newTendencia, newFacturacion] = await Promise.all([
        getDashboardMetrics(filters),
        getIngresosPorMetodoPago(filters),
        getTendenciaIngresos(filters),
        getResumenFacturacion(filters)
      ])

      setMetrics(newMetrics)
      setIngresosPorMetodoPago(newMetodosPago)
      setTendencia(newTendencia)
      setFacturacion(newFacturacion)
    })
  }

  // Manejar cambio de modo de filtro
  const handleModeChange = (value: string) => {
    if (!value) return
    const mode = value as FilterMode
    setFilterMode(mode)
    if (mode === 'custom') {
      setShowCalendar(true)
    } else {
      setShowCalendar(false)
      loadData(mode)
    }
  }

  // Manejar selección de rango personalizado - NO cerrar hasta que haya ambas fechas
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range)
    // Solo cerrar y cargar cuando ambas fechas estén seleccionadas
  }

  // Aplicar rango manualmente
  const handleApplyRange = () => {
    if (dateRange?.from && dateRange?.to) {
      setShowCalendar(false)
      loadData('custom')
    }
  }

  // Label del rango personalizado
  const customLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`
    : 'Rango'

  return (
    <TooltipProvider>
      <div className="space-y-4 sm:space-y-6">
        {/* Alerta de Devoluciones Pendientes */}
        {devolucionesPendientes && devolucionesPendientes.length > 0 && (
          <DevolucionesPendientesAlert devoluciones={devolucionesPendientes} />
        )}

        {/* Header: Título + Filtro en la misma fila */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Dashboard Ejecutivo
            </h1>
            <p className="text-sm text-muted-foreground">
              {metrics.periodo_label}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={filterMode}
              onValueChange={handleModeChange}
              className="bg-muted p-0.5 rounded-lg"
            >
              <ToggleGroupItem
                value="mes"
                className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md"
              >
                Este mes
              </ToggleGroupItem>
              <ToggleGroupItem
                value="anterior"
                className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md"
              >
                Anterior
              </ToggleGroupItem>
              <ToggleGroupItem
                value="trimestre"
                className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md"
              >
                3 meses
              </ToggleGroupItem>
              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <ToggleGroupItem
                    value="custom"
                    className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md"
                  >
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {filterMode === 'custom' ? customLabel : 'Rango'}
                  </ToggleGroupItem>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={handleDateRangeSelect}
                    locale={es}
                    numberOfMonths={2}
                  />
                  <div className="p-3 border-t flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCalendar(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApplyRange}
                      disabled={!dateRange?.from || !dateRange?.to}
                    >
                      Aplicar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </ToggleGroup>

            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* KPIs Principales */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ingresos del Período */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos del Período</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(metrics.ingresos_periodo)}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {metrics.crecimiento_ingresos >= 0 ? (
                  <>
                    <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                    <span className="text-green-500 font-medium">
                      +{metrics.crecimiento_ingresos}%
                    </span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
                    <span className="text-red-500 font-medium">
                      {metrics.crecimiento_ingresos}%
                    </span>
                  </>
                )}
                <span className="ml-1">vs período anterior</span>
              </div>
            </CardContent>
          </Card>

          {/* Ocupación */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ocupación Actual</CardTitle>
              <Hotel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.tasa_ocupacion}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.habitaciones_ocupadas} de {metrics.habitaciones_totales} habitaciones
              </p>
            </CardContent>
          </Card>

          {/* ADR */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm font-medium">ADR</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs font-semibold mb-1">Average Daily Rate</p>
                    <p className="text-xs">Tarifa promedio por noche vendida.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(metrics.adr)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Por noche vendida
              </p>
            </CardContent>
          </Card>

          {/* RevPAR */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm font-medium">RevPAR</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs font-semibold mb-1">Revenue Per Available Room</p>
                    <p className="text-xs">Ingreso por habitación disponible.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(metrics.revpar)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Ingreso por hab. disponible
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Segunda Fila de KPIs */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ingresos del Día */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(metrics.ingresos_hoy)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Pagos recibidos hoy
              </p>
            </CardContent>
          </Card>

          {/* Por Cobrar */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Por Cobrar</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatMoney(metrics.total_por_cobrar)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.reservas_con_deuda} reservas con saldo
              </p>
            </CardContent>
          </Card>

          {/* Actividad del Día */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actividad Hoy</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-600">{metrics.checkins_hoy}</span>
                <span className="text-sm text-muted-foreground">Check-ins</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-blue-600">{metrics.checkouts_hoy}</span>
                <span className="text-xs text-muted-foreground">Check-outs</span>
              </div>
            </CardContent>
          </Card>

          {/* Reservas Futuras */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.reservas_futuras}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Reservas confirmadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficas */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
          {/* Tendencia de Ingresos */}
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle>Tendencia de Ingresos</CardTitle>
              <CardDescription>Ingresos diarios y ocupación</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={tendencia}>
                  <defs>
                    <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="fecha"
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="left"
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `S/ ${value}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'ingresos') return [formatMoney(value), 'Ingresos']
                      return [`${value}%`, 'Ocupación']
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="ingresos"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorIngresos)"
                    name="Ingresos"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="ocupacion"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="none"
                    strokeDasharray="5 5"
                    name="Ocupación %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Ingresos por Método de Pago */}
          <Card>
            <CardHeader>
              <CardTitle>Ingresos por Método de Pago</CardTitle>
              <CardDescription>Distribución de pagos</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ingresosPorMetodoPago}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="metodo"
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `S/ ${value}`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any, name: string, props: any) => [
                      formatMoney(value),
                      `${props.payload.transacciones} transacciones (${props.payload.porcentaje}%)`
                    ]}
                  />
                  <Bar
                    dataKey="monto"
                    fill="hsl(var(--primary))"
                    radius={[8, 8, 0, 0]}
                    name="Ingresos"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Resumen Facturación SUNAT */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Facturación</CardTitle>
              <CardDescription>Comprobantes emitidos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Total Facturado</span>
                  </div>
                  <span className="text-lg font-bold">
                    {formatMoney(facturacion.total_facturado)}
                  </span>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Boletas</span>
                    <span className="text-sm font-medium">
                      {formatMoney(facturacion.total_boletas)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Facturas</span>
                    <span className="text-sm font-medium">
                      {formatMoney(facturacion.total_facturas)}
                    </span>
                  </div>

                  {facturacion.pendientes_sunat > 0 && (
                    <>
                      <div className="h-px bg-border" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-orange-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Pendientes SUNAT
                        </span>
                        <span className="text-sm font-medium text-orange-500">
                          {facturacion.pendientes_sunat}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2">
                  <div className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Ocupación del período</span>
                      <span className="font-semibold">{metrics.tasa_ocupacion_periodo}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  )
}
