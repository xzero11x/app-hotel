'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// =============================================
// TIPOS
// =============================================

export type Caja = {
  id: string
  nombre: string
  estado: boolean
  created_at: string
}

export type CajaWithStats = Caja & {
  total_series: number
  turno_activo: boolean
  ultimo_cierre?: string
}

type Result<T = any> = 
  | { success: true; data: T }
  | { success: false; error: string }

// =============================================
// FUNCIONES CRUD
// =============================================

/**
 * Obtener todas las cajas
 */
export async function getCajas(): Promise<Result<Caja[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('cajas')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('Error al obtener cajas:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtener cajas con estadísticas
 */
export async function getCajasWithStats(): Promise<Result<CajaWithStats[]>> {
  try {
    const supabase = await createClient()

    // Obtener cajas
    const { data: cajas, error: cajasError } = await supabase
      .from('cajas')
      .select('*')
      .order('created_at', { ascending: true })

    if (cajasError) throw cajasError

    // Por cada caja, obtener estadísticas
    const cajasWithStats = await Promise.all(
      (cajas || []).map(async (caja) => {
        // Contar series
        const { count: seriesCount } = await supabase
          .from('series_comprobante')
          .select('*', { count: 'exact', head: true })
          .eq('caja_id', caja.id)

        // Verificar turno activo
        const { data: turnoActivo } = await supabase
          .from('caja_turnos')
          .select('id')
          .eq('caja_id', caja.id)
          .eq('estado', 'ABIERTA')
          .single()

        // Último cierre
        const { data: ultimoCierre } = await supabase
          .from('caja_turnos')
          .select('fecha_cierre')
          .eq('caja_id', caja.id)
          .eq('estado', 'CERRADA')
          .order('fecha_cierre', { ascending: false })
          .limit(1)
          .single()

        return {
          ...caja,
          total_series: seriesCount || 0,
          turno_activo: !!turnoActivo,
          ultimo_cierre: ultimoCierre?.fecha_cierre
        }
      })
    )

    return { success: true, data: cajasWithStats }
  } catch (error: any) {
    console.error('Error al obtener cajas con stats:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtener caja por ID
 */
export async function getCajaById(id: string): Promise<Result<Caja>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('cajas')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error al obtener caja:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtener caja con sus series
 */
export async function getCajaWithSeries(id: string): Promise<Result<any>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('cajas')
      .select(`
        *,
        series:series_comprobante(
          id,
          tipo_comprobante,
          serie,
          correlativo_actual
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error al obtener caja con series:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Crear nueva caja
 */
export async function createCaja(data: {
  nombre: string
}): Promise<Result<Caja>> {
  try {
    const supabase = await createClient()

    // Validar que el usuario sea ADMIN
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (usuario?.rol !== 'ADMIN') {
      return { success: false, error: 'Solo administradores pueden crear cajas' }
    }

    // Validar nombre
    if (!data.nombre || data.nombre.trim().length === 0) {
      return { success: false, error: 'El nombre de la caja es obligatorio' }
    }

    // Verificar que no exista una caja con el mismo nombre
    const { data: existente } = await supabase
      .from('cajas')
      .select('id')
      .ilike('nombre', data.nombre.trim())
      .single()

    if (existente) {
      return { success: false, error: 'Ya existe una caja con ese nombre' }
    }

    // Crear caja
    const { data: nuevaCaja, error } = await supabase
      .from('cajas')
      .insert({
        nombre: data.nombre.trim(),
        estado: true
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/configuracion/cajas')
    return { success: true, data: nuevaCaja }
  } catch (error: any) {
    console.error('Error al crear caja:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Actualizar caja
 */
export async function updateCaja(
  id: string,
  data: {
    nombre?: string
    estado?: boolean
  }
): Promise<Result<Caja>> {
  try {
    const supabase = await createClient()

    // Validar que el usuario sea ADMIN
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (usuario?.rol !== 'ADMIN') {
      return { success: false, error: 'Solo administradores pueden editar cajas' }
    }

    // Validar que la caja existe
    const { data: cajaExistente } = await supabase
      .from('cajas')
      .select('id')
      .eq('id', id)
      .single()

    if (!cajaExistente) {
      return { success: false, error: 'Caja no encontrada' }
    }

    // Preparar datos a actualizar
    const updateData: any = {}

    if (data.nombre !== undefined) {
      if (data.nombre.trim().length === 0) {
        return { success: false, error: 'El nombre no puede estar vacío' }
      }

      // Verificar nombre único (excluyendo la caja actual)
      const { data: duplicado } = await supabase
        .from('cajas')
        .select('id')
        .ilike('nombre', data.nombre.trim())
        .neq('id', id)
        .single()

      if (duplicado) {
        return { success: false, error: 'Ya existe otra caja con ese nombre' }
      }

      updateData.nombre = data.nombre.trim()
    }

    if (data.estado !== undefined) {
      updateData.estado = data.estado
    }

    // Actualizar
    const { data: cajaActualizada, error } = await supabase
      .from('cajas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/configuracion/cajas')
    return { success: true, data: cajaActualizada }
  } catch (error: any) {
    console.error('Error al actualizar caja:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Eliminar caja (soft delete)
 */
export async function deleteCaja(id: string): Promise<Result<void>> {
  try {
    const supabase = await createClient()

    // Validar que el usuario sea ADMIN
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (usuario?.rol !== 'ADMIN') {
      return { success: false, error: 'Solo administradores pueden eliminar cajas' }
    }

    // Verificar que no tenga turnos activos
    const { data: turnoActivo } = await supabase
      .from('caja_turnos')
      .select('id')
      .eq('caja_id', id)
      .eq('estado', 'ABIERTA')
      .single()

    if (turnoActivo) {
      return { 
        success: false, 
        error: 'No se puede eliminar una caja con turnos activos. Cierra el turno primero.' 
      }
    }

    // Soft delete: marcar como inactiva
    const { error } = await supabase
      .from('cajas')
      .update({ estado: false })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/configuracion/cajas')
    return { success: true, data: undefined }
  } catch (error: any) {
    console.error('Error al eliminar caja:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtener cajas disponibles (activas sin turno abierto)
 */
export async function getCajasDisponibles(): Promise<Result<Caja[]>> {
  try {
    const supabase = await createClient()

    // Obtener todas las cajas activas
    const { data: cajas, error } = await supabase
      .from('cajas')
      .select('*')
      .eq('estado', true)
      .order('nombre')

    if (error) throw error

    // Filtrar las que NO tienen turno activo
    const cajasDisponibles = await Promise.all(
      (cajas || []).map(async (caja) => {
        const { data: turnoActivo } = await supabase
          .from('caja_turnos')
          .select('id')
          .eq('caja_id', caja.id)
          .eq('estado', 'ABIERTA')
          .single()

        return turnoActivo ? null : caja
      })
    )

    const filtered = cajasDisponibles.filter((c): c is Caja => c !== null)

    return { success: true, data: filtered }
  } catch (error: any) {
    console.error('Error al obtener cajas disponibles:', error)
    return { success: false, error: error.message }
  }
}

// =============================================
// MÓDULO: HISTORIAL Y SESIÓN ACTIVA
// =============================================

export type EstadoCierre = 'CUADRADA' | 'FALTANTE' | 'SOBRANTE'

export interface CierrePasado {
  id: string
  fecha_cierre: string
  caja_nombre: string
  usuario_nombre: string
  monto_apertura: number
  monto_cierre_sistema: number
  monto_cierre_declarado: number
  diferencia: number
  estado: EstadoCierre
}

export interface MovimientoCaja {
  id: string
  tipo: 'INGRESO' | 'EGRESO'
  categoria: string | null
  moneda: 'PEN' | 'USD'
  monto: number
  motivo: string
  comprobante_referencia: string | null
  usuario_nombre: string
  created_at: string
}

export interface DetalleTurno {
  turno: {
    id: string
    caja_nombre: string
    usuario_nombre: string
    fecha_apertura: string
    fecha_cierre: string | null
    monto_apertura: number
    monto_apertura_usd: number
    monto_cierre_sistema: number | null
    monto_cierre_declarado: number | null
    monto_cierre_sistema_usd: number | null
    monto_cierre_declarado_usd: number | null
    estado: 'ABIERTA' | 'CERRADA'
  }
  movimientos: MovimientoCaja[]
  estadisticas: {
    total_ingresos_pen: number
    total_ingresos_usd: number
    total_egresos_pen: number
    total_egresos_usd: number
    flujo_neto_pen: number
    flujo_neto_usd: number
    total_esperado_pen: number
    total_esperado_usd: number
    diferencia_pen?: number
    diferencia_usd?: number
  }
}

/**
 * Obtener historial de cierres pasados
 */
export async function getCierresPasados(filtros?: {
  fecha_desde?: string
  fecha_hasta?: string
  caja_id?: string
  usuario_id?: string
}): Promise<CierrePasado[]> {
  const supabase = await createClient()

  let query = supabase
    .from('caja_turnos')
    .select(`
      id,
      fecha_cierre,
      monto_apertura,
      monto_cierre_sistema,
      monto_cierre_declarado,
      cajas!inner(nombre),
      usuarios!inner(nombres, apellidos)
    `)
    .eq('estado', 'CERRADA')
    .order('fecha_cierre', { ascending: false })

  if (filtros?.fecha_desde) {
    query = query.gte('fecha_cierre', filtros.fecha_desde)
  }
  if (filtros?.fecha_hasta) {
    query = query.lte('fecha_cierre', filtros.fecha_hasta)
  }
  if (filtros?.caja_id) {
    query = query.eq('caja_id', filtros.caja_id)
  }
  if (filtros?.usuario_id) {
    query = query.eq('usuario_id', filtros.usuario_id)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error al obtener cierres pasados:', error)
    throw new Error('Error al obtener historial de cierres')
  }

  return data.map((turno: any) => {
    const sistema = turno.monto_cierre_sistema || 0
    const declarado = turno.monto_cierre_declarado || 0
    const diferencia = declarado - sistema

    let estado: EstadoCierre = 'CUADRADA'
    if (diferencia < 0) estado = 'FALTANTE'
    else if (diferencia > 0) estado = 'SOBRANTE'

    return {
      id: turno.id,
      fecha_cierre: turno.fecha_cierre,
      caja_nombre: turno.cajas.nombre,
      usuario_nombre: `${turno.usuarios.nombres} ${turno.usuarios.apellidos || ''}`.trim(),
      monto_apertura: turno.monto_apertura,
      monto_cierre_sistema: sistema,
      monto_cierre_declarado: declarado,
      diferencia,
      estado,
    }
  })
}

/**
 * Obtener turno activo del usuario actual
 */
export async function getTurnoActivo(userId?: string): Promise<DetalleTurno | null> {
  const supabase = await createClient()

  // Si no se proporciona userId, obtener el del usuario actual
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')
    userId = user.id
    console.log('[getTurnoActivo] Usuario detectado:', userId)
  }

  // Buscar turno abierto
  const { data: turno, error: turnoError } = await supabase
    .from('caja_turnos')
    .select(`
      id,
      fecha_apertura,
      fecha_cierre,
      monto_apertura,
      monto_apertura_usd,
      monto_cierre_sistema,
      monto_cierre_declarado,
      monto_cierre_sistema_usd,
      monto_cierre_declarado_usd,
      estado,
      cajas!inner(nombre),
      usuarios!inner(nombres, apellidos)
    `)
    .eq('usuario_id', userId)
    .eq('estado', 'ABIERTA')
    .single()

  if (turnoError) {
    console.log('[getTurnoActivo] Error al buscar turno:', turnoError.message)
    return null
  }

  if (!turno) {
    console.log('[getTurnoActivo] No se encontró turno abierto para usuario:', userId)
    return null
  }

  console.log('[getTurnoActivo] Turno encontrado:', turno.id)

  // Obtener movimientos del turno
  const { data: movimientos, error: movError } = await supabase
    .from('caja_movimientos')
    .select(`
      id,
      tipo,
      categoria,
      moneda,
      monto,
      motivo,
      comprobante_referencia,
      created_at,
      usuarios!inner(nombres, apellidos)
    `)
    .eq('caja_turno_id', turno.id)
    .order('created_at', { ascending: false })

  if (movError) {
    console.error('Error al obtener movimientos:', movError)
    throw new Error('Error al obtener movimientos de caja')
  }

  // Calcular estadísticas usando la función SQL
  const { data: stats } = await supabase.rpc('calcular_movimientos_turno', {
    p_turno_id: turno.id
  })

  const estadisticas = stats?.[0] || {
    total_ingresos_pen: 0,
    total_ingresos_usd: 0,
    total_egresos_pen: 0,
    total_egresos_usd: 0,
  }

  const flujo_neto_pen = estadisticas.total_ingresos_pen - estadisticas.total_egresos_pen
  const flujo_neto_usd = estadisticas.total_ingresos_usd - estadisticas.total_egresos_usd
  const total_esperado_pen = turno.monto_apertura + flujo_neto_pen
  const total_esperado_usd = turno.monto_apertura_usd + flujo_neto_usd

  return {
    turno: {
      id: turno.id,
      caja_nombre: turno.cajas.nombre,
      usuario_nombre: `${turno.usuarios.nombres} ${turno.usuarios.apellidos || ''}`.trim(),
      fecha_apertura: turno.fecha_apertura,
      fecha_cierre: turno.fecha_cierre,
      monto_apertura: turno.monto_apertura,
      monto_apertura_usd: turno.monto_apertura_usd,
      monto_cierre_sistema: turno.monto_cierre_sistema,
      monto_cierre_declarado: turno.monto_cierre_declarado,
      monto_cierre_sistema_usd: turno.monto_cierre_sistema_usd,
      monto_cierre_declarado_usd: turno.monto_cierre_declarado_usd,
      estado: turno.estado,
    },
    movimientos: movimientos.map((m: any) => ({
      id: m.id,
      tipo: m.tipo,
      categoria: m.categoria,
      moneda: m.moneda,
      monto: m.monto,
      motivo: m.motivo,
      comprobante_referencia: m.comprobante_referencia,
      usuario_nombre: `${m.usuarios.nombres} ${m.usuarios.apellidos || ''}`.trim(),
      created_at: m.created_at,
    })),
    estadisticas: {
      ...estadisticas,
      flujo_neto_pen,
      flujo_neto_usd,
      total_esperado_pen,
      total_esperado_usd,
      ...(turno.estado === 'CERRADA' && {
        diferencia_pen: (turno.monto_cierre_declarado || 0) - (turno.monto_cierre_sistema || 0),
        diferencia_usd: (turno.monto_cierre_declarado_usd || 0) - (turno.monto_cierre_sistema_usd || 0),
      }),
    },
  }
}

/**
 * Obtener todos los turnos activos (SOLO ADMIN)
 */
export async function getTodosLosTurnosActivos(): Promise<DetalleTurno[]> {
  const supabase = await createClient()

  // Verificar que el usuario sea ADMIN
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuario || usuario.rol !== 'ADMIN') {
    throw new Error('Acceso denegado: Se requiere rol ADMIN')
  }

  // Obtener todos los turnos abiertos
  const { data: turnos, error } = await supabase
    .from('caja_turnos')
    .select(`
      id,
      usuario_id,
      fecha_apertura,
      monto_apertura,
      monto_apertura_usd,
      estado,
      cajas!inner(nombre),
      usuarios!inner(nombres, apellidos)
    `)
    .eq('estado', 'ABIERTA')
    .order('fecha_apertura', { ascending: false })

  if (error) {
    console.error('Error al obtener turnos activos:', error)
    throw new Error('Error al obtener turnos activos')
  }

  // Obtener detalles de cada turno
  const detalles = await Promise.all(
    turnos.map(async (turno: any) => {
      const detalle = await getTurnoActivo(turno.usuario_id)
      return detalle
    })
  )

  return detalles.filter((d): d is DetalleTurno => d !== null)
}

/**
 * Obtener detalle de un turno cerrado por ID
 */
export async function getDetalleTurnoCerrado(turnoId: string): Promise<DetalleTurno> {
  const supabase = await createClient()

  const { data: turno, error: turnoError } = await supabase
    .from('caja_turnos')
    .select(`
      id,
      fecha_apertura,
      fecha_cierre,
      monto_apertura,
      monto_apertura_usd,
      monto_cierre_sistema,
      monto_cierre_declarado,
      monto_cierre_sistema_usd,
      monto_cierre_declarado_usd,
      estado,
      cajas!inner(nombre),
      usuarios!inner(nombres, apellidos)
    `)
    .eq('id', turnoId)
    .eq('estado', 'CERRADA')
    .single()

  if (turnoError || !turno) {
    throw new Error('Turno no encontrado')
  }

  const { data: movimientos, error: movError } = await supabase
    .from('caja_movimientos')
    .select(`
      id,
      tipo,
      categoria,
      moneda,
      monto,
      motivo,
      comprobante_referencia,
      created_at,
      usuarios!inner(nombres, apellidos)
    `)
    .eq('caja_turno_id', turno.id)
    .order('created_at', { ascending: false })

  if (movError) {
    console.error('Error al obtener movimientos:', movError)
    throw new Error('Error al obtener movimientos')
  }

  const { data: stats } = await supabase.rpc('calcular_movimientos_turno', {
    p_turno_id: turno.id
  })

  const estadisticas = stats?.[0] || {
    total_ingresos_pen: 0,
    total_ingresos_usd: 0,
    total_egresos_pen: 0,
    total_egresos_usd: 0,
  }

  const flujo_neto_pen = estadisticas.total_ingresos_pen - estadisticas.total_egresos_pen
  const flujo_neto_usd = estadisticas.total_ingresos_usd - estadisticas.total_egresos_usd

  return {
    turno: {
      id: turno.id,
      caja_nombre: turno.cajas.nombre,
      usuario_nombre: `${turno.usuarios.nombres} ${turno.usuarios.apellidos || ''}`.trim(),
      fecha_apertura: turno.fecha_apertura,
      fecha_cierre: turno.fecha_cierre,
      monto_apertura: turno.monto_apertura,
      monto_apertura_usd: turno.monto_apertura_usd,
      monto_cierre_sistema: turno.monto_cierre_sistema,
      monto_cierre_declarado: turno.monto_cierre_declarado,
      monto_cierre_sistema_usd: turno.monto_cierre_sistema_usd,
      monto_cierre_declarado_usd: turno.monto_cierre_declarado_usd,
      estado: turno.estado,
    },
    movimientos: movimientos.map((m: any) => ({
      id: m.id,
      tipo: m.tipo,
      categoria: m.categoria,
      moneda: m.moneda,
      monto: m.monto,
      motivo: m.motivo,
      comprobante_referencia: m.comprobante_referencia,
      usuario_nombre: `${m.usuarios.nombres} ${m.usuarios.apellidos || ''}`.trim(),
      created_at: m.created_at,
    })),
    estadisticas: {
      ...estadisticas,
      flujo_neto_pen,
      flujo_neto_usd,
      total_esperado_pen: turno.monto_apertura + flujo_neto_pen,
      total_esperado_usd: turno.monto_apertura_usd + flujo_neto_usd,
      diferencia_pen: (turno.monto_cierre_declarado || 0) - (turno.monto_cierre_sistema || 0),
      diferencia_usd: (turno.monto_cierre_declarado_usd || 0) - (turno.monto_cierre_sistema_usd || 0),
    },
  }
}

/**
 * Abrir caja (crear nuevo turno)
 */
export async function abrirCaja(input: {
  caja_id: string
  monto_apertura: number
  monto_apertura_usd?: number
}): Promise<{ success: boolean; turno_id?: string; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  console.log('[abrirCaja] Intentando abrir caja para usuario:', user.id)

  // Verificar que no tenga turno abierto
  const { data: turnoExistente } = await supabase
    .from('caja_turnos')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('estado', 'ABIERTA')
    .single()

  if (turnoExistente) {
    console.log('[abrirCaja] Usuario ya tiene turno abierto:', turnoExistente.id)
    return { success: false, error: 'Ya tienes un turno abierto' }
  }

  // Crear nuevo turno
  const { data: nuevoTurno, error } = await supabase
    .from('caja_turnos')
    .insert({
      caja_id: input.caja_id,
      usuario_id: user.id,
      monto_apertura: input.monto_apertura,
      monto_apertura_usd: input.monto_apertura_usd || 0,
      estado: 'ABIERTA',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[abrirCaja] Error al crear turno:', error)
    return { success: false, error: 'Error al abrir caja' }
  }

  console.log('[abrirCaja] Turno creado exitosamente:', nuevoTurno.id)
  revalidatePath('/cajas')
  return { success: true, turno_id: nuevoTurno.id }
}

/**
 * Cerrar caja (cerrar turno activo)
 */
export async function cerrarCaja(input: {
  turno_id: string
  monto_declarado_pen: number
  monto_declarado_usd: number
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const detalleTurno = await getTurnoActivo()
  if (!detalleTurno || detalleTurno.turno.id !== input.turno_id) {
    return { success: false, error: 'Turno no encontrado o no es tuyo' }
  }

  const { error } = await supabase
    .from('caja_turnos')
    .update({
      estado: 'CERRADA',
      fecha_cierre: new Date().toISOString(),
      monto_cierre_declarado: input.monto_declarado_pen,
      monto_cierre_declarado_usd: input.monto_declarado_usd,
      monto_cierre_sistema: detalleTurno.estadisticas.total_esperado_pen,
      monto_cierre_sistema_usd: detalleTurno.estadisticas.total_esperado_usd,
    })
    .eq('id', input.turno_id)

  if (error) {
    console.error('Error al cerrar caja:', error)
    return { success: false, error: 'Error al cerrar caja' }
  }

  revalidatePath('/cajas')
  revalidatePath('/cajas/historial')
  return { success: true }
}

/**
 * Forzar cierre de caja (SOLO ADMIN)
 */
export async function forzarCierreCaja(input: {
  turno_id: string
  monto_declarado_pen: number
  monto_declarado_usd: number
  observacion?: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuario || usuario.rol !== 'ADMIN') {
    return { success: false, error: 'Acceso denegado: Se requiere rol ADMIN' }
  }

  const { data: turno, error: turnoError } = await supabase
    .from('caja_turnos')
    .select('id, usuario_id')
    .eq('id', input.turno_id)
    .eq('estado', 'ABIERTA')
    .single()

  if (turnoError || !turno) {
    return { success: false, error: 'Turno no encontrado o ya está cerrado' }
  }

  const detalleTurno = await getTurnoActivo(turno.usuario_id)
  if (!detalleTurno) {
    return { success: false, error: 'Error al obtener detalle del turno' }
  }

  const { error } = await supabase
    .from('caja_turnos')
    .update({
      estado: 'CERRADA',
      fecha_cierre: new Date().toISOString(),
      monto_cierre_declarado: input.monto_declarado_pen,
      monto_cierre_declarado_usd: input.monto_declarado_usd,
      monto_cierre_sistema: detalleTurno.estadisticas.total_esperado_pen,
      monto_cierre_sistema_usd: detalleTurno.estadisticas.total_esperado_usd,
    })
    .eq('id', input.turno_id)

  if (error) {
    console.error('Error al forzar cierre:', error)
    return { success: false, error: 'Error al forzar cierre de caja' }
  }

  revalidatePath('/cajas')
  revalidatePath('/cajas/historial')
  return { success: true }
}

/**
 * Registrar movimiento de caja
 */
export async function registrarMovimiento(input: {
  tipo: 'INGRESO' | 'EGRESO'
  categoria?: string
  moneda: 'PEN' | 'USD'
  monto: number
  motivo: string
  comprobante_referencia?: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const turnoActivo = await getTurnoActivo()
  if (!turnoActivo) {
    return { success: false, error: 'No tienes turno abierto' }
  }

  if (input.monto <= 0) {
    return { success: false, error: 'El monto debe ser mayor a 0' }
  }

  if (input.motivo.length < 5) {
    return { success: false, error: 'El motivo debe tener al menos 5 caracteres' }
  }

  const { error } = await supabase
    .from('caja_movimientos')
    .insert({
      caja_turno_id: turnoActivo.turno.id,
      usuario_id: user.id,
      tipo: input.tipo,
      categoria: input.categoria,
      moneda: input.moneda,
      monto: input.monto,
      motivo: input.motivo,
      comprobante_referencia: input.comprobante_referencia,
    })

  if (error) {
    console.error('Error al registrar movimiento:', error)
    return { success: false, error: 'Error al registrar movimiento' }
  }

  revalidatePath('/cajas')
  return { success: true }
}
