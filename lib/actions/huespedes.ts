'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ========================================
// TIPOS
// ========================================

export type HuespedData = {
  nombres: string
  apellidos: string
  tipo_documento: 'DNI' | 'PASAPORTE' | 'CE' | 'OTRO'
  numero_documento: string
  nacionalidad: string
  correo?: string | null
  telefono?: string | null
  fecha_nacimiento?: string | null
}

export type HuespedConRelacion = HuespedData & {
  es_titular: boolean
}

// ========================================
// CREAR/BUSCAR HUÉSPED
// ========================================

/**
 * Crear o actualizar un huésped
 * Si ya existe (por documento), lo actualiza
 */
export async function upsertHuesped(data: HuespedData) {
  const supabase = await createClient()

  const { data: existing, error: searchError } = await supabase
    .from('huespedes')
    .select('id')
    .eq('tipo_documento', data.tipo_documento)
    .eq('numero_documento', data.numero_documento)
    .maybeSingle()

  if (searchError) {
    console.error('Error al buscar huésped:', searchError)
    return { success: false, error: searchError.message }
  }

  // Si existe, actualizar
  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from('huespedes')
      .update({
        nombres: data.nombres,
        apellidos: data.apellidos,
        nacionalidad: data.nacionalidad,
        correo: data.correo,
        telefono: data.telefono,
        fecha_nacimiento: data.fecha_nacimiento,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true, data: updated }
  }

  // Si no existe, crear
  const { data: created, error: createError } = await supabase
    .from('huespedes')
    .insert(data)
    .select()
    .single()

  if (createError) {
    return { success: false, error: createError.message }
  }

  return { success: true, data: created }
}

/**
 * Buscar huésped por documento
 */
export async function buscarHuespedPorDocumento(
  tipo: string,
  numero: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('huespedes')
    .select('*')
    .eq('tipo_documento', tipo)
    .eq('numero_documento', numero)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

// ========================================
// VINCULAR HUÉSPEDES A RESERVA
// ========================================

/**
 * Registrar múltiples huéspedes y vincularlos a una reserva
 * - Crea/actualiza todos los huéspedes
 * - Los vincula a la reserva en reserva_huespedes
 * - Marca uno como titular
 */
export async function registrarHuespedesEnReserva(
  reservaId: string,
  huespedes: HuespedConRelacion[]
) {
  const supabase = await createClient()

  try {
    // 1. Validar que haya al menos un huésped
    if (huespedes.length === 0) {
      return { success: false, error: 'Debe registrar al menos un huésped' }
    }

    // 2. Validar que haya exactamente un titular
    const titulares = huespedes.filter((h) => h.es_titular)
    if (titulares.length !== 1) {
      return {
        success: false,
        error: 'Debe haber exactamente un huésped titular',
      }
    }

    // 3. Crear/actualizar cada huésped y obtener sus IDs
    const huespedesIds: Array<{ id: string; es_titular: boolean }> = []

    for (const huesped of huespedes) {
      const result = await upsertHuesped({
        nombres: huesped.nombres,
        apellidos: huesped.apellidos,
        tipo_documento: huesped.tipo_documento,
        numero_documento: huesped.numero_documento,
        nacionalidad: huesped.nacionalidad,
        correo: huesped.correo,
        telefono: huesped.telefono,
        fecha_nacimiento: huesped.fecha_nacimiento,
      })

      if (!result.success || !result.data) {
        return {
          success: false,
          error: `Error al registrar huésped ${huesped.nombres}: ${result.error}`,
        }
      }

      huespedesIds.push({
        id: result.data.id,
        es_titular: huesped.es_titular,
      })
    }

    // 4. Limpiar vínculos anteriores de esta reserva
    const { error: deleteError } = await supabase
      .from('reserva_huespedes')
      .delete()
      .eq('reserva_id', reservaId)

    if (deleteError) {
      return {
        success: false,
        error: `Error al limpiar vínculos anteriores: ${deleteError.message}`,
      }
    }

    // 5. Crear los nuevos vínculos
    const vinculos = huespedesIds.map((h) => ({
      reserva_id: reservaId,
      huesped_id: h.id,
      es_titular: h.es_titular,
    }))

    const { error: insertError } = await supabase
      .from('reserva_huespedes')
      .insert(vinculos)

    if (insertError) {
      return {
        success: false,
        error: `Error al vincular huéspedes: ${insertError.message}`,
      }
    }

    revalidatePath('/rack')
    return { success: true, huespedesIds }
  } catch (error: any) {
    console.error('Error en registrarHuespedesEnReserva:', error)
    return { success: false, error: error.message }
  }
}

// ========================================
// OBTENER HUÉSPEDES DE UNA RESERVA
// ========================================

/**
 * Obtener todos los huéspedes vinculados a una reserva
 */
export async function getHuespedesByReserva(reservaId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reserva_huespedes')
    .select(
      `
      id,
      es_titular,
      huespedes (
        id,
        nombres,
        apellidos,
        tipo_documento,
        numero_documento,
        nacionalidad,
        correo,
        telefono,
        fecha_nacimiento
      )
    `
    )
    .eq('reserva_id', reservaId)
    .order('es_titular', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

// ========================================
// LISTADO GENERAL
// ========================================

/**
 * Obtener todos los huéspedes registrados
 */
export async function getAllHuespedes() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('huespedes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

/**
 * Buscar huéspedes por nombre o documento
 */
export async function searchHuespedes(query: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('huespedes')
    .select('*')
    .or(
      `nombres.ilike.%${query}%,apellidos.ilike.%${query}%,numero_documento.ilike.%${query}%`
    )
    .limit(10)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

// ========================================
// MÓDULO DIRECTORIO DE HUÉSPEDES
// ========================================
// MÓDULO DIRECTORIO DE HUÉSPEDES (OPTIMIZADO)
// ========================================

export type DirectorioHuesped = {
  id: string
  nombres: string
  apellidos: string
  tipo_documento: string
  numero_documento: string
  nacionalidad: string | null
  correo: string | null
  telefono: string | null
  notas_internas: string | null
  es_frecuente: boolean
  created_at: string
  total_visitas: number
  ultima_visita: string | null
  ultima_habitacion: string | null
}

export type FiltrosDirectorio = {
  busqueda?: string
  solo_frecuentes?: boolean
  con_alertas?: boolean
}

/**
 * Obtener lista de huéspedes con estadísticas básicas (OPTIMIZADO)
 * Solo carga datos esenciales para la tabla. Detalles pesados se cargan bajo demanda.
 */
export async function getDirectorioHuespedes(filtros?: FiltrosDirectorio) {
  const supabase = await createClient()

  // Query base: datos del huésped + agregación simple de visitas
  let query = supabase
    .from('huespedes')
    .select(`
      id,
      nombres,
      apellidos,
      tipo_documento,
      numero_documento,
      nacionalidad,
      correo,
      telefono,
      notas_internas,
      es_frecuente,
      created_at
    `)
    .order('created_at', { ascending: false })

  // Filtro de búsqueda (nombre, apellido, documento, teléfono)
  if (filtros?.busqueda && filtros.busqueda.length > 0) {
    query = query.or(
      `nombres.ilike.%${filtros.busqueda}%,apellidos.ilike.%${filtros.busqueda}%,numero_documento.ilike.%${filtros.busqueda}%,telefono.ilike.%${filtros.busqueda}%`
    )
  }

  // Solo clientes frecuentes (VIP)
  if (filtros?.solo_frecuentes) {
    query = query.eq('es_frecuente', true)
  }

  // Solo con alertas/notas
  if (filtros?.con_alertas) {
    query = query.not('notas_internas', 'is', null)
  }

  const { data: huespedes, error } = await query

  if (error) {
    console.error('[getDirectorioHuespedes] Error:', error)
    return []
  }

  if (!huespedes || huespedes.length === 0) return []

  // Obtener estadísticas de visitas en una sola query (eficiente)
  const huespedIds = huespedes.map(h => h.id)
  
  const { data: estadisticas } = await supabase
    .from('reserva_huespedes')
    .select(`
      huesped_id,
      reservas!inner (
        id,
        fecha_salida,
        habitaciones (numero)
      )
    `)
    .in('huesped_id', huespedIds)
    .order('reservas(fecha_salida)', { ascending: false })

  // Mapear estadísticas a cada huésped
  const estadisticasPorHuesped = new Map<string, any>()
  
  estadisticas?.forEach(({ huesped_id, reservas }) => {
    if (!estadisticasPorHuesped.has(huesped_id)) {
      estadisticasPorHuesped.set(huesped_id, {
        total_visitas: 0,
        ultima_visita: null,
        ultima_habitacion: null
      })
    }
    
    const stats = estadisticasPorHuesped.get(huesped_id)
    stats.total_visitas++
    
    // Guardar solo la última visita (ya viene ordenada DESC)
    if (!stats.ultima_visita && reservas) {
      const reservaArray = Array.isArray(reservas) ? reservas : [reservas]
      const primeraReserva = reservaArray[0]
      stats.ultima_visita = primeraReserva?.fecha_salida || null
      
      if (primeraReserva?.habitaciones) {
        const hab = Array.isArray(primeraReserva.habitaciones) 
          ? primeraReserva.habitaciones[0] 
          : primeraReserva.habitaciones
        stats.ultima_habitacion = hab?.numero || null
      }
    }
  })

  // Combinar datos base + estadísticas
  return huespedes.map(h => ({
    ...h,
    total_visitas: estadisticasPorHuesped.get(h.id)?.total_visitas || 0,
    ultima_visita: estadisticasPorHuesped.get(h.id)?.ultima_visita || null,
    ultima_habitacion: estadisticasPorHuesped.get(h.id)?.ultima_habitacion || null
  })) as DirectorioHuesped[]
}

/**
 * Obtener detalle completo de un huésped con historial (OPTIMIZADO)
 * Solo calcula estadísticas específicas para este huésped.
 */
export async function getDetalleHuesped(huesped_id: string) {
  const supabase = await createClient()

  // 1. Datos básicos del huésped
  const { data: huesped, error: huespedError } = await supabase
    .from('huespedes')
    .select('*')
    .eq('id', huesped_id)
    .single()

  if (huespedError || !huesped) {
    console.error('[getDetalleHuesped] Error:', huespedError)
    return null
  }

  // 2. Historial de estadías (con habitación)
  const { data: estadias, error: estadiasError } = await supabase
    .from('reservas')
    .select(`
      id,
      codigo_reserva,
      estado,
      fecha_entrada,
      fecha_salida,
      check_in_real,
      check_out_real,
      precio_pactado,
      habitaciones (
        numero,
        piso
      ),
      reserva_huespedes!inner (
        es_titular
      )
    `)
    .eq('reserva_huespedes.huesped_id', huesped_id)
    .order('fecha_entrada', { ascending: false })

  // 3. Calcular estadísticas a partir de las estadías
  const total_visitas = estadias?.length || 0
  const visitas_completadas = estadias?.filter(e => e.estado === 'CHECKED_OUT').length || 0
  const reservas_canceladas = estadias?.filter(e => e.estado === 'CANCELADA').length || 0
  const no_shows = estadias?.filter(e => e.estado === 'NO_SHOW').length || 0
  const ultima_visita = estadias?.[0]?.fecha_salida || null
  
  let ultima_habitacion = null
  if (estadias && estadias.length > 0 && estadias[0].habitaciones) {
    const hab = Array.isArray(estadias[0].habitaciones) 
      ? estadias[0].habitaciones[0] 
      : estadias[0].habitaciones
    ultima_habitacion = (hab as any)?.numero || null
  }

  // 4. Pagos realizados (últimos 20)
  const { data: pagos, error: pagosError } = await supabase
    .from('pagos')
    .select(`
      id,
      monto,
      metodo_pago,
      fecha_pago,
      reservas!inner (
        codigo_reserva,
        reserva_huespedes!inner (
          huesped_id,
          es_titular
        )
      )
    `)
    .eq('reservas.reserva_huespedes.huesped_id', huesped_id)
    .order('fecha_pago', { ascending: false })
    .limit(20)

  // 5. Calcular gasto total histórico (solo pagos de reservas donde es titular)
  const gasto_total_historico = pagos?.reduce((sum, pago) => {
    const reservaArray = Array.isArray(pago.reservas) ? pago.reservas : [pago.reservas]
    const reserva = reservaArray[0]
    const rh = Array.isArray(reserva?.reserva_huespedes) ? reserva.reserva_huespedes[0] : reserva?.reserva_huespedes
    
    return rh?.es_titular ? sum + pago.monto : sum
  }, 0) || 0

  return {
    ...huesped,
    total_visitas,
    visitas_completadas,
    reservas_canceladas,
    no_shows,
    ultima_visita,
    ultima_habitacion,
    gasto_total_historico,
    estadias: estadias || [],
    pagos: pagos || []
  }
}

/**
 * Actualizar notas internas de un huésped
 */
export async function actualizarNotasHuesped(huesped_id: string, notas: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('huespedes')
    .update({ notas_internas: notas })
    .eq('id', huesped_id)

  if (error) {
    console.error('[actualizarNotasHuesped] Error:', error)
    throw new Error('Error al actualizar notas')
  }

  revalidatePath('/huespedes')
  return { success: true }
}

/**
 * Marcar/Desmarcar como cliente frecuente (VIP)
 */
export async function toggleClienteFrecuente(huesped_id: string, es_frecuente: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('huespedes')
    .update({ es_frecuente })
    .eq('id', huesped_id)

  if (error) {
    console.error('[toggleClienteFrecuente] Error:', error)
    throw new Error('Error al actualizar estado VIP')
  }

  revalidatePath('/huespedes')
  return { success: true }
}

/**
 * Obtener estadísticas generales del directorio (OPTIMIZADO)
 * Usa agregaciones simples en lugar de vista compleja.
 */
export async function getEstadisticasDirectorio() {
  const supabase = await createClient()

  // Query simple: solo campos necesarios
  const { data: huespedes, error } = await supabase
    .from('huespedes')
    .select('id, es_frecuente, notas_internas')

  if (error || !huespedes) {
    console.error('[getEstadisticasDirectorio] Error:', error)
    return {
      total_huespedes: 0,
      clientes_vip: 0,
      con_alertas: 0,
      promedio_visitas: 0
    }
  }

  const total_huespedes = huespedes.length
  const clientes_vip = huespedes.filter(h => h.es_frecuente).length
  const con_alertas = huespedes.filter(h => h.notas_internas).length

  // Calcular promedio de visitas con una query agregada
  const { data: visitasData } = await supabase
    .from('reserva_huespedes')
    .select('huesped_id')

  const promedio_visitas = total_huespedes > 0 && visitasData
    ? visitasData.length / total_huespedes
    : 0

  return {
    total_huespedes,
    clientes_vip,
    con_alertas,
    promedio_visitas: Math.round(promedio_visitas * 10) / 10
  }
}
