'use server'

import { createClient } from '@/lib/supabase/server'

// ========================================
// TYPES
// ========================================
export type OcupacionReserva = {
  id: string
  codigo_reserva: string
  estado: 'RESERVADA' | 'CHECKED_IN' | 'CHECKED_OUT'
  fecha_entrada: string
  fecha_salida: string
  check_in_real: string | null
  check_out_real: string | null
  precio_pactado: number
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
    console.error('Error al obtener ocupaciones:', error)
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
    console.error('Error al obtener pagos:', pagosError)
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

  // Obtener todas las reservas activas
  const { data, error } = await supabase
    .from('vw_reservas_con_datos_basicos')
    .select('id, estado, precio_pactado, fecha_entrada, fecha_salida')

  if (error) {
    console.error('Error al obtener estadísticas:', error)
    return {
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

  // Calcular estadísticas
  let monto_total_deuda = 0
  let total_con_deuda = 0

  data.forEach(r => {
    const total_estimado = calcularTotalEstimado(r.precio_pactado, r.fecha_entrada, r.fecha_salida)
    const total_pagado = pagosPorReserva[r.id] || 0
    const saldo = total_estimado - total_pagado
    
    if (saldo > 0) {
      total_con_deuda++
      monto_total_deuda += saldo
    }
  })

  const stats = {
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
    console.error('Error al obtener detalle:', error)
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
        correo,
        telefono
      )
    `)
    .eq('reserva_id', reserva_id)
    .order('es_titular', { ascending: false })

  if (error) {
    console.error('Error al obtener huéspedes:', error)
    return []
  }

  return data
}

// NOTA: getPagosDeReserva ha sido movido a lib/actions/pagos.ts (getPagosByReserva)
// para evitar duplicación. Importar desde allí si se necesita.

