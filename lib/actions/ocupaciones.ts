'use server'

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'

// ========================================
// TYPES
// ========================================
export type OcupacionReserva = {
  id: string
  codigo_reserva: string
  estado: 'RESERVADA' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELADA' | 'NO_SHOW'
  fecha_entrada: string
  fecha_salida: string
  check_in_real: string | null
  check_out_real: string | null
  precio_pactado: number
  moneda_pactada: 'PEN' | 'USD'
  huesped_presente: boolean

  // Habitación
  habitacion_id: string
  habitacion_numero: string
  habitacion_piso: string
  tipo_habitacion: string
  categoria_habitacion: string

  // Huésped titular
  titular_id: string
  titular_nombre: string
  titular_tipo_doc: string
  titular_numero_doc: string
  titular_correo: string | null
  titular_telefono: string | null
  titular_nacionalidad: string | null

  // Financiero (calculado en backend)
  total_estimado: number
  total_pagado: number
  saldo_pendiente: number
  total_noches: number

  // Metadata
  created_at: string
  updated_at: string
}

export type FiltroOcupaciones = {
  estado?: 'RESERVADA' | 'CHECKED_IN' | 'CHECKED_OUT' | 'TODAS'
  solo_con_deuda?: boolean
  habitacion?: string
  huesped?: string
}

// ========================================
// HELPER: CALCULAR TOTAL ESTIMADO
// ========================================
function calcularTotalEstimado(precio_pactado: number, fecha_entrada: string, fecha_salida: string): number {
  const entrada = new Date(fecha_entrada)
  const salida = new Date(fecha_salida)
  const noches = Math.max(1, Math.floor((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24)))
  return precio_pactado * noches
}

// ========================================
// OBTENER OCUPACIONES ACTUALES
// ========================================
export async function getOcupacionesActuales(filtros?: FiltroOcupaciones) {
  const supabase = await createClient()

  // 1️⃣ Obtener datos básicos de la vista simplificada
  let query = supabase
    .from('vw_reservas_con_datos_basicos')
    .select('*')

  // Aplicar filtros
  if (filtros?.estado && filtros.estado !== 'TODAS') {
    query = query.eq('estado', filtros.estado)
  }

  if (filtros?.habitacion) {
    query = query.ilike('habitacion_numero', `%${filtros.habitacion}%`)
  }

  if (filtros?.huesped) {
    query = query.ilike('titular_nombre', `%${filtros.huesped}%`)
  }

  query = query.order('fecha_entrada', { ascending: false })

  const { data: reservas, error } = await query

  if (error) {
    logger.error('Error al obtener ocupaciones', { action: 'getOcupacionesActuales', originalError: getErrorMessage(error) })
    throw new Error('Error al cargar ocupaciones')
  }

  if (!reservas || reservas.length === 0) {
    return []
  }

  // 2️⃣ Obtener pagos de todas las reservas (batch query)
  const reservasIds = reservas.map(r => r.id)
  const { data: pagos, error: pagosError } = await supabase
    .from('pagos')
    .select('reserva_id, monto')
    .in('reserva_id', reservasIds)

  if (pagosError) {
    logger.warn('Error al obtener pagos de ocupaciones', { action: 'getOcupacionesActuales', originalError: getErrorMessage(pagosError) })
  }

  // 3️⃣ Calcular totales en memoria (batch processing)
  const pagosPorReserva: Record<string, number> = {}
  pagos?.forEach(p => {
    pagosPorReserva[p.reserva_id] = (pagosPorReserva[p.reserva_id] || 0) + p.monto
  })

  // 4️⃣ Mapear reservas con cálculos financieros
  const ocupaciones: OcupacionReserva[] = reservas.map(r => {
    const total_estimado = calcularTotalEstimado(r.precio_pactado, r.fecha_entrada, r.fecha_salida)
    const total_pagado = pagosPorReserva[r.id] || 0
    const saldo_pendiente = total_estimado - total_pagado
    const entrada = new Date(r.fecha_entrada)
    const salida = new Date(r.fecha_salida)
    const total_noches = Math.max(1, Math.floor((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24)))

    return {
      ...r,
      total_estimado,
      total_pagado,
      saldo_pendiente,
      total_noches
    }
  })

  // 5️⃣ Aplicar filtro de deuda (después de calcular)
  let ocupacionesFiltradas = ocupaciones
  if (filtros?.solo_con_deuda) {
    ocupacionesFiltradas = ocupaciones.filter(o => o.saldo_pendiente > 0)
  }

  // 6️⃣ Ordenar: primero deudores, luego por fecha
  ocupacionesFiltradas.sort((a, b) => {
    if (a.saldo_pendiente > 0 && b.saldo_pendiente <= 0) return -1
    if (a.saldo_pendiente <= 0 && b.saldo_pendiente > 0) return 1
    return new Date(b.fecha_entrada).getTime() - new Date(a.fecha_entrada).getTime()
  })

  return ocupacionesFiltradas
}

// ========================================
// OBTENER ESTADÍSTICAS DE OCUPACIONES
// ========================================
export async function getEstadisticasOcupaciones() {
  const supabase = await createClient()

  // Obtener TODAS las reservas del sistema (sin filtros)
  const { data, error } = await supabase
    .from('vw_reservas_con_datos_basicos')
    .select('id, estado, precio_pactado, fecha_entrada, fecha_salida')

  if (error) {
    logger.error('Error al obtener estadísticas de ocupaciones', { action: 'getEstadisticasOcupaciones', originalError: getErrorMessage(error) })
    return {
      total_todas: 0,
      total_reservas: 0,
      total_checkins: 0,
      total_checkouts: 0,
      total_con_deuda: 0,
      monto_total_deuda: 0
    }
  }

  // Obtener todos los pagos
  const reservasIds = data.map(r => r.id)
  const { data: pagos } = await supabase
    .from('pagos')
    .select('reserva_id, monto')
    .in('reserva_id', reservasIds)

  // Calcular pagos por reserva
  const pagosPorReserva: Record<string, number> = {}
  pagos?.forEach(p => {
    pagosPorReserva[p.reserva_id] = (pagosPorReserva[p.reserva_id] || 0) + p.monto
  })

  // Calcular deudas solo de reservas activas (RESERVADA y CHECKED_IN)
  let monto_total_deuda = 0
  let total_con_deuda = 0

  data.forEach(r => {
    // Solo calcular deuda para reservas activas
    if (r.estado === 'RESERVADA' || r.estado === 'CHECKED_IN') {
      const total_estimado = calcularTotalEstimado(r.precio_pactado, r.fecha_entrada, r.fecha_salida)
      const total_pagado = pagosPorReserva[r.id] || 0
      const saldo = total_estimado - total_pagado

      if (saldo > 0.01) { // Tolerancia para decimales
        total_con_deuda++
        monto_total_deuda += saldo
      }
    }
  })

  const stats = {
    total_todas: data.length, // TODAS las reservas (incluye CANCELADA, NO_SHOW, etc.)
    total_reservas: data.filter(r => r.estado === 'RESERVADA').length,
    total_checkins: data.filter(r => r.estado === 'CHECKED_IN').length,
    total_checkouts: data.filter(r => r.estado === 'CHECKED_OUT').length,
    total_con_deuda,
    monto_total_deuda
  }

  return stats
}

// ========================================
// OBTENER DETALLE DE UNA RESERVA
// ========================================
export async function getDetalleReserva(reserva_id: string) {
  const supabase = await createClient()

  // Obtener datos básicos
  const { data: reserva, error } = await supabase
    .from('vw_reservas_con_datos_basicos')
    .select('*')
    .eq('id', reserva_id)
    .single()

  if (error) {
    logger.error('Error al obtener detalle de reserva', { action: 'getDetalleReserva', reservaId: reserva_id, originalError: getErrorMessage(error) })
    throw new Error('Error al cargar detalle de reserva')
  }

  // Obtener pagos
  const { data: pagos } = await supabase
    .from('pagos')
    .select('monto')
    .eq('reserva_id', reserva_id)

  // Calcular totales
  const total_estimado = calcularTotalEstimado(reserva.precio_pactado, reserva.fecha_entrada, reserva.fecha_salida)
  const total_pagado = pagos?.reduce((sum, p) => sum + p.monto, 0) || 0
  const saldo_pendiente = total_estimado - total_pagado
  const entrada = new Date(reserva.fecha_entrada)
  const salida = new Date(reserva.fecha_salida)
  const total_noches = Math.max(1, Math.floor((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24)))

  return {
    ...reserva,
    total_estimado,
    total_pagado,
    saldo_pendiente,
    total_noches
  } as OcupacionReserva
}

// ========================================
// OBTENER HUÉSPEDES DE UNA RESERVA
// ========================================
export async function getHuespedesDeReserva(reserva_id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reserva_huespedes')
    .select(`
      es_titular,
      huespedes (
        id,
        nombres,
        apellidos,
        tipo_documento,
        numero_documento,
        nacionalidad,
        fecha_nacimiento,
        correo,
        telefono
      )
    `)
    .eq('reserva_id', reserva_id)
    .order('es_titular', { ascending: false })

  if (error) {
    logger.error('Error al obtener huéspedes de reserva', { action: 'getHuespedesDeReserva', reservaId: reserva_id, originalError: getErrorMessage(error) })
    return []
  }

  return data
}

// NOTA: getPagosDeReserva ha sido movido a lib/actions/pagos.ts (getPagosByReserva)
// para evitar duplicación. Importar desde allí si se necesita.

// ========================================
// HISTORIAL DE RESERVAS (PAGINADO)
// ========================================
export async function getReservasHistorial(params: {
  page: number
  pageSize: number
  search?: string
  dateStart?: Date
  dateEnd?: Date
  estado?: string
}) {
  const supabase = await createClient()
  const { page, pageSize, search, dateStart, dateEnd, estado } = params

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('vw_reservas_con_datos_basicos')
    .select('*', { count: 'exact' })
    .order('fecha_entrada', { ascending: false })
    .range(from, to)

  if (estado && estado !== 'TODAS') {
    query = query.eq('estado', estado)
  }

  // Filtro de fechas: buscar reservas que se solapen con el rango dado
  // Una reserva se solapa si: fecha_entrada <= dateEnd AND fecha_salida >= dateStart
  if (dateStart && dateEnd) {
    // Rango completo: reservas que se solapan con el período
    query = query.lte('fecha_entrada', dateEnd.toISOString())
    query = query.gte('fecha_salida', dateStart.toISOString())
  } else if (dateStart) {
    // Solo fecha inicio: reservas que salen después de esta fecha
    query = query.gte('fecha_salida', dateStart.toISOString())
  } else if (dateEnd) {
    // Solo fecha fin: reservas que entran antes de esta fecha
    query = query.lte('fecha_entrada', dateEnd.toISOString())
  }

  if (search) {
    query = query.or(`codigo_reserva.ilike.%${search}%,titular_nombre.ilike.%${search}%,titular_numero_doc.ilike.%${search}%,habitacion_numero.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    logger.error('Error al obtener historial de reservas', { action: 'getReservasHistorial', originalError: getErrorMessage(error) })
    throw new Error('Error al cargar el historial de reservas')
  }

  // Nota: Ahora calculamos los datos financieros para dar valor a la tabla de historial
  // Usamos batch processing para los pagos
  const reservasIds = (data || []).map((r: any) => r.id)
  let pagosPorReserva: Record<string, number> = {}

  if (reservasIds.length > 0) {
    const { data: pagos } = await supabase
      .from('pagos')
      .select('reserva_id, monto')
      .in('reserva_id', reservasIds)

    pagos?.forEach(p => {
      pagosPorReserva[p.reserva_id] = (pagosPorReserva[p.reserva_id] || 0) + p.monto
    })
  }

  const dataTransformada = (data || []).map((r: any) => {
    // Reutilizar la lógica de cálculo
    const entrada = new Date(r.fecha_entrada)
    const salida = new Date(r.fecha_salida)
    const total_noches = Math.max(1, Math.floor((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24)))

    // Si la reserva está cancelada o no show, el estimado podría ser 0 o penalidad, 
    // pero para simplificar mantenemos el precio pactado * noches como referencia de "valor de la reserva"
    // salvo que ya esté cancelada, donde la deuda debería ser 0 (o lo pagado).
    // POR AHORA: Calculamos el teórico.

    let total_estimado = calcularTotalEstimado(r.precio_pactado, r.fecha_entrada, r.fecha_salida)
    const total_pagado = pagosPorReserva[r.id] || 0

    // Si está cancelada, la "Deuda" no debería existir a menos que haya penalidad.
    // Asumimos que si está cancelada, el saldo pendiente es 0 (para no alarmar falsamente).
    if (r.estado === 'CANCELADA' || r.estado === 'NO_SHOW') {
      // Saldo pendiente 0
    }

    const saldo_pendiente = total_estimado - total_pagado

    return {
      ...r,

      total_estimado,
      total_pagado,
      saldo_pendiente,
      total_noches
    }
  })

  return {
    data: dataTransformada as OcupacionReserva[],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize)
  }
}

