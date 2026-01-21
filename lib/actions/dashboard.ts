'use server'

import { createClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths, format } from 'date-fns'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'

// ========================================
// TYPES
// ========================================

export type DashboardMetrics = {
  // Ingresos
  ingresos_hoy: number
  ingresos_periodo: number
  ingresos_periodo_anterior: number
  crecimiento_ingresos: number // Porcentaje

  // Ocupación
  habitaciones_ocupadas: number
  habitaciones_totales: number
  tasa_ocupacion: number // Porcentaje HOY
  tasa_ocupacion_periodo: number

  // Revenue Metrics
  adr: number // Average Daily Rate (Tarifa Promedio Diaria)
  revpar: number // Revenue Per Available Room

  // Pendientes
  total_por_cobrar: number
  reservas_con_deuda: number

  // Actividad
  checkins_hoy: number
  checkouts_hoy: number
  reservas_futuras: number

  // Metadata
  periodo_label: string
}

export type IngresosPorMetodoPago = {
  metodo: string
  monto: number
  transacciones: number
  porcentaje: number
}

export type TendenciaIngresos = {
  fecha: string
  ingresos: number
  ocupacion: number
}

export type ResumenFacturacion = {
  total_facturado: number
  total_boletas: number
  total_facturas: number
  pendientes_sunat: number
}

export type DashboardFilters = {
  fechaInicio?: string // ISO string
  fechaFin?: string // ISO string
}

// ========================================
// OBTENER MÉTRICAS PRINCIPALES (CON FILTROS)
// ========================================

export async function getDashboardMetrics(filters?: DashboardFilters): Promise<DashboardMetrics> {
  const supabase = await createClient()

  try {
    const hoy = new Date()
    const inicioHoy = startOfDay(hoy)
    const finHoy = endOfDay(hoy)

    // Determinar período según filtros
    let inicioPeriodo: Date
    let finPeriodo: Date
    let inicioPeriodoAnterior: Date
    let finPeriodoAnterior: Date
    let periodoLabel: string

    if (filters?.fechaInicio && filters?.fechaFin) {
      // Rango personalizado
      inicioPeriodo = startOfDay(new Date(filters.fechaInicio))
      finPeriodo = endOfDay(new Date(filters.fechaFin))

      // Calcular período anterior del mismo tamaño
      const diasPeriodo = Math.ceil((finPeriodo.getTime() - inicioPeriodo.getTime()) / (1000 * 60 * 60 * 24))
      finPeriodoAnterior = new Date(inicioPeriodo)
      finPeriodoAnterior.setDate(finPeriodoAnterior.getDate() - 1)
      inicioPeriodoAnterior = new Date(finPeriodoAnterior)
      inicioPeriodoAnterior.setDate(inicioPeriodoAnterior.getDate() - diasPeriodo + 1)

      periodoLabel = `${format(inicioPeriodo, 'dd/MM/yyyy')} - ${format(finPeriodo, 'dd/MM/yyyy')}`
    } else {
      // Mes actual por defecto
      inicioPeriodo = startOfMonth(hoy)
      finPeriodo = endOfMonth(hoy)
      inicioPeriodoAnterior = startOfMonth(subMonths(hoy, 1))
      finPeriodoAnterior = endOfMonth(subMonths(hoy, 1))
      periodoLabel = format(hoy, 'MMMM yyyy')
    }

    // 1. Habitaciones totales y ocupadas (siempre HOY)
    const { count: totalHabitaciones } = await supabase
      .from('habitaciones')
      .select('*', { count: 'exact', head: true })
      .eq('estado_servicio', 'OPERATIVA')

    const { count: habitacionesOcupadas } = await supabase
      .from('habitaciones')
      .select('*', { count: 'exact', head: true })
      .eq('estado_ocupacion', 'OCUPADA')
      .eq('estado_servicio', 'OPERATIVA')

    const tasa_ocupacion = totalHabitaciones
      ? Math.round((habitacionesOcupadas! / totalHabitaciones) * 100)
      : 0

    // 2. Ingresos del día (siempre HOY)
    const { data: pagosHoy } = await supabase
      .from('pagos')
      .select('monto')
      .gte('fecha_pago', inicioHoy.toISOString())
      .lte('fecha_pago', finHoy.toISOString())

    const ingresos_hoy = pagosHoy?.reduce((sum, p) => sum + p.monto, 0) || 0

    // 3. Ingresos del período
    const { data: pagosPeriodo } = await supabase
      .from('pagos')
      .select('monto')
      .gte('fecha_pago', inicioPeriodo.toISOString())
      .lte('fecha_pago', finPeriodo.toISOString())

    const ingresos_periodo = pagosPeriodo?.reduce((sum, p) => sum + p.monto, 0) || 0

    // 4. Ingresos del período anterior
    const { data: pagosPeriodoAnterior } = await supabase
      .from('pagos')
      .select('monto')
      .gte('fecha_pago', inicioPeriodoAnterior.toISOString())
      .lte('fecha_pago', finPeriodoAnterior.toISOString())

    const ingresos_periodo_anterior = pagosPeriodoAnterior?.reduce((sum, p) => sum + p.monto, 0) || 0

    // 5. Crecimiento de ingresos
    const crecimiento_ingresos = ingresos_periodo_anterior > 0
      ? Math.round(((ingresos_periodo - ingresos_periodo_anterior) / ingresos_periodo_anterior) * 100)
      : 0

    // 6. Ocupación del período
    const { data: reservasPeriodo } = await supabase
      .from('reservas')
      .select('fecha_entrada, fecha_salida')
      .in('estado', ['CHECKED_IN', 'CHECKED_OUT'])
      .lte('fecha_entrada', finPeriodo.toISOString())
      .gte('fecha_salida', inicioPeriodo.toISOString())

    let diasOcupados = 0
    reservasPeriodo?.forEach(r => {
      const entrada = new Date(r.fecha_entrada) < inicioPeriodo ? inicioPeriodo : new Date(r.fecha_entrada)
      const salida = new Date(r.fecha_salida) > finPeriodo ? finPeriodo : new Date(r.fecha_salida)
      const diff = Math.abs(salida.getTime() - entrada.getTime())
      diasOcupados += Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    })

    const diasDelPeriodo = Math.max(1, Math.ceil((finPeriodo.getTime() - inicioPeriodo.getTime()) / (1000 * 60 * 60 * 24)))
    const habitacionesDia = (totalHabitaciones || 1) * diasDelPeriodo
    const tasa_ocupacion_periodo = habitacionesDia > 0 ? Math.round((diasOcupados / habitacionesDia) * 100) : 0

    // 7. ADR (Average Daily Rate)
    const { data: reservasConPrecio } = await supabase
      .from('reservas')
      .select(`
        fecha_entrada,
        fecha_salida,
        pagos(monto)
      `)
      .in('estado', ['CHECKED_IN', 'CHECKED_OUT'])
      .gte('check_in_real', inicioPeriodo.toISOString())
      .lte('check_in_real', finPeriodo.toISOString())

    let totalNoches = 0
    let totalIngresos = 0

    reservasConPrecio?.forEach((r: any) => {
      const entrada = new Date(r.fecha_entrada)
      const salida = new Date(r.fecha_salida)
      const noches = Math.max(1, Math.ceil((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24)))
      const ingresosReserva = r.pagos?.reduce((sum: number, p: any) => sum + p.monto, 0) || 0

      totalNoches += noches
      totalIngresos += ingresosReserva
    })

    const adr = totalNoches > 0 ? Math.round(totalIngresos / totalNoches) : 0

    // 8. RevPAR
    const revpar = totalHabitaciones
      ? Math.round(ingresos_periodo / (totalHabitaciones * diasDelPeriodo))
      : 0

    // 9. Total por cobrar (siempre actual)
    const { data: reservasConSaldo } = await supabase
      .from('reservas')
      .select(`
        id,
        precio_pactado,
        fecha_entrada,
        fecha_salida,
        pagos(monto)
      `)
      .in('estado', ['RESERVADA', 'CHECKED_IN'])

    let total_por_cobrar = 0
    let reservas_con_deuda = 0

    reservasConSaldo?.forEach((r: any) => {
      const entrada = new Date(r.fecha_entrada)
      const salida = new Date(r.fecha_salida)
      const noches = Math.max(1, Math.ceil((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24)))
      const total = r.precio_pactado * noches
      const pagado = r.pagos?.reduce((sum: number, p: any) => sum + p.monto, 0) || 0
      const saldo = total - pagado

      if (saldo > 0.1) {
        total_por_cobrar += saldo
        reservas_con_deuda++
      }
    })

    // 10. Check-ins y check-outs del día (siempre HOY)
    const { count: checkins_hoy } = await supabase
      .from('reservas')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'CHECKED_IN')
      .gte('check_in_real', inicioHoy.toISOString())
      .lte('check_in_real', finHoy.toISOString())

    const { count: checkouts_hoy } = await supabase
      .from('reservas')
      .select('*', { count: 'exact', head: true })
      .gte('fecha_salida', inicioHoy.toISOString())
      .lte('fecha_salida', finHoy.toISOString())
      .eq('estado', 'CHECKED_IN')

    // 11. Reservas futuras
    const { count: reservas_futuras } = await supabase
      .from('reservas')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'RESERVADA')
      .gte('fecha_entrada', finHoy.toISOString())

    return {
      ingresos_hoy: Math.round(ingresos_hoy),
      ingresos_periodo: Math.round(ingresos_periodo),
      ingresos_periodo_anterior: Math.round(ingresos_periodo_anterior),
      crecimiento_ingresos,
      habitaciones_ocupadas: habitacionesOcupadas || 0,
      habitaciones_totales: totalHabitaciones || 0,
      tasa_ocupacion,
      tasa_ocupacion_periodo,
      adr,
      revpar,
      total_por_cobrar: Math.round(total_por_cobrar),
      reservas_con_deuda,
      checkins_hoy: checkins_hoy || 0,
      checkouts_hoy: checkouts_hoy || 0,
      reservas_futuras: reservas_futuras || 0,
      periodo_label: periodoLabel
    }
  } catch (error) {
    logger.error('Error al obtener métricas del dashboard', {
      action: 'getDashboardMetrics',
      originalError: getErrorMessage(error)
    })

    return {
      ingresos_hoy: 0,
      ingresos_periodo: 0,
      ingresos_periodo_anterior: 0,
      crecimiento_ingresos: 0,
      habitaciones_ocupadas: 0,
      habitaciones_totales: 0,
      tasa_ocupacion: 0,
      tasa_ocupacion_periodo: 0,
      adr: 0,
      revpar: 0,
      total_por_cobrar: 0,
      reservas_con_deuda: 0,
      checkins_hoy: 0,
      checkouts_hoy: 0,
      reservas_futuras: 0,
      periodo_label: 'Error'
    }
  }
}

// ========================================
// INGRESOS POR MÉTODO DE PAGO (CON FILTROS)
// ========================================

export async function getIngresosPorMetodoPago(filters?: DashboardFilters): Promise<IngresosPorMetodoPago[]> {
  const supabase = await createClient()

  try {
    let inicioPeriodo: Date
    let finPeriodo: Date

    if (filters?.fechaInicio && filters?.fechaFin) {
      inicioPeriodo = startOfDay(new Date(filters.fechaInicio))
      finPeriodo = endOfDay(new Date(filters.fechaFin))
    } else {
      inicioPeriodo = startOfMonth(new Date())
      finPeriodo = endOfMonth(new Date())
    }

    const { data: pagos } = await supabase
      .from('pagos')
      .select('monto, metodo_pago')
      .gte('fecha_pago', inicioPeriodo.toISOString())
      .lte('fecha_pago', finPeriodo.toISOString())

    const metodosMap: Record<string, { monto: number, transacciones: number }> = {}

    pagos?.forEach((p: any) => {
      const metodo = p.metodo_pago || 'EFECTIVO'

      if (!metodosMap[metodo]) {
        metodosMap[metodo] = { monto: 0, transacciones: 0 }
      }

      metodosMap[metodo].monto += p.monto
      metodosMap[metodo].transacciones++
    })

    const totalIngresos = Object.values(metodosMap).reduce((sum, m) => sum + m.monto, 0)

    const resultado: IngresosPorMetodoPago[] = Object.entries(metodosMap).map(([metodo, data]) => ({
      metodo,
      monto: Math.round(data.monto),
      transacciones: data.transacciones,
      porcentaje: totalIngresos > 0 ? Math.round((data.monto / totalIngresos) * 100) : 0
    }))

    return resultado.sort((a, b) => b.monto - a.monto)
  } catch (error) {
    logger.error('Error al obtener ingresos por método de pago', {
      action: 'getIngresosPorMetodoPago',
      originalError: getErrorMessage(error)
    })
    return []
  }
}

// ========================================
// TENDENCIA DE INGRESOS (CON FILTROS)
// ========================================

export async function getTendenciaIngresos(filters?: DashboardFilters): Promise<TendenciaIngresos[]> {
  const supabase = await createClient()

  try {
    let inicioPeriodo: Date
    let finPeriodo: Date

    if (filters?.fechaInicio && filters?.fechaFin) {
      inicioPeriodo = startOfDay(new Date(filters.fechaInicio))
      finPeriodo = endOfDay(new Date(filters.fechaFin))
    } else {
      // Por defecto últimos 30 días
      finPeriodo = endOfDay(new Date())
      inicioPeriodo = new Date(finPeriodo)
      inicioPeriodo.setDate(inicioPeriodo.getDate() - 30)
    }

    const { data: pagos } = await supabase
      .from('pagos')
      .select('fecha_pago, monto')
      .gte('fecha_pago', inicioPeriodo.toISOString())
      .lte('fecha_pago', finPeriodo.toISOString())
      .order('fecha_pago', { ascending: true })

    const { data: reservas } = await supabase
      .from('reservas')
      .select('fecha_entrada, fecha_salida')
      .in('estado', ['CHECKED_IN', 'CHECKED_OUT'])
      .gte('fecha_entrada', inicioPeriodo.toISOString())

    const { count: totalHabitaciones } = await supabase
      .from('habitaciones')
      .select('*', { count: 'exact', head: true })
      .eq('estado_servicio', 'OPERATIVA')

    // Calcular días del período
    const diasPeriodo = Math.ceil((finPeriodo.getTime() - inicioPeriodo.getTime()) / (1000 * 60 * 60 * 24))
    const diasMap: Record<string, { ingresos: number, ocupacion: number }> = {}

    // Inicializar días
    for (let i = 0; i <= diasPeriodo; i++) {
      const fecha = new Date(inicioPeriodo)
      fecha.setDate(fecha.getDate() + i)
      const key = format(fecha, 'yyyy-MM-dd')
      diasMap[key] = { ingresos: 0, ocupacion: 0 }
    }

    // Llenar ingresos
    pagos?.forEach(p => {
      const key = format(new Date(p.fecha_pago), 'yyyy-MM-dd')
      if (diasMap[key]) {
        diasMap[key].ingresos += p.monto
      }
    })

    // Calcular ocupación diaria
    reservas?.forEach(r => {
      const entrada = new Date(r.fecha_entrada)
      const salida = new Date(r.fecha_salida)

      let currentDate = new Date(entrada)
      while (currentDate <= salida) {
        const key = format(currentDate, 'yyyy-MM-dd')
        if (diasMap[key]) {
          diasMap[key].ocupacion++
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
    })

    const resultado: TendenciaIngresos[] = Object.entries(diasMap).map(([fecha, data]) => ({
      fecha: format(new Date(fecha), 'dd/MM'),
      ingresos: Math.round(data.ingresos),
      ocupacion: totalHabitaciones
        ? Math.round((data.ocupacion / totalHabitaciones) * 100)
        : 0
    }))

    return resultado
  } catch (error) {
    logger.error('Error al obtener tendencia de ingresos', {
      action: 'getTendenciaIngresos',
      originalError: getErrorMessage(error)
    })
    return []
  }
}

// ========================================
// RESUMEN DE FACTURACIÓN SUNAT (CON FILTROS)
// ========================================

export async function getResumenFacturacion(filters?: DashboardFilters): Promise<ResumenFacturacion> {
  const supabase = await createClient()

  try {
    let inicioPeriodo: Date
    let finPeriodo: Date

    if (filters?.fechaInicio && filters?.fechaFin) {
      inicioPeriodo = startOfDay(new Date(filters.fechaInicio))
      finPeriodo = endOfDay(new Date(filters.fechaFin))
    } else {
      inicioPeriodo = startOfMonth(new Date())
      finPeriodo = endOfMonth(new Date())
    }

    const { data: comprobantes } = await supabase
      .from('comprobantes')
      .select('tipo_comprobante, total_venta, estado_sunat')
      .gte('fecha_emision', inicioPeriodo.toISOString())
      .lte('fecha_emision', finPeriodo.toISOString())

    let total_facturado = 0
    let total_boletas = 0
    let total_facturas = 0
    let pendientes_sunat = 0

    comprobantes?.forEach(c => {
      total_facturado += c.total_venta

      if (c.tipo_comprobante === 'BOLETA') {
        total_boletas += c.total_venta
      } else if (c.tipo_comprobante === 'FACTURA') {
        total_facturas += c.total_venta
      }

      if (c.estado_sunat === 'PENDIENTE') {
        pendientes_sunat++
      }
    })

    return {
      total_facturado: Math.round(total_facturado),
      total_boletas: Math.round(total_boletas),
      total_facturas: Math.round(total_facturas),
      pendientes_sunat
    }
  } catch (error) {
    logger.error('Error al obtener resumen de facturación', {
      action: 'getResumenFacturacion',
      originalError: getErrorMessage(error)
    })
    return {
      total_facturado: 0,
      total_boletas: 0,
      total_facturas: 0,
      pendientes_sunat: 0
    }
  }
}
