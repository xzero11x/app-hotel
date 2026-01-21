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
 * Abrir nuevo turno
 */
export async function abrirTurno(data: {
  caja_id: string
  monto_apertura_pen: number
  monto_apertura_usd?: number
  usuario_id?: string
}): Promise<Result<{ id: string }>> {
  const supabase = await createClient()

  // Usar usuario_id proporcionado o el del usuario autenticado
  let userId = data.usuario_id
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }
    userId = user.id
  }

  // Verificar si ya tiene turno abierto
  const { data: turnoActivo } = await supabase
    .from('caja_turnos')
    .select('id')
    .eq('usuario_id', userId)
    .eq('estado', 'ABIERTA')
    .maybeSingle() // Usar maybeSingle para evitar error si hay multiples (aunque no deberia)

  if (turnoActivo) {
    return { success: false, error: 'Ya tienes un turno abierto' }
  }

  // Verificar si la caja está ocupada
  const { data: cajaOcupada } = await supabase
    .from('caja_turnos')
    .select('id')
    .eq('caja_id', data.caja_id)
    .eq('estado', 'ABIERTA')
    .maybeSingle()

  if (cajaOcupada) {
    return { success: false, error: 'Esta caja ya está ocupada por otro usuario' }
  }

  // Insertar turno
  const { data: nuevoTurno, error } = await supabase
    .from('caja_turnos')
    .insert({
      caja_id: data.caja_id,
      usuario_id: userId,
      monto_apertura_efectivo: data.monto_apertura_pen,
      monto_apertura_usd: data.monto_apertura_usd || 0,
      fecha_apertura: new Date().toISOString(),
      estado: 'ABIERTA'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error al abrir turno:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/cajas')
  return { success: true, data: { id: nuevoTurno.id } }
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
 * Optimizad: Una sola query con LEFT JOIN en lugar de N+1 queries
 */
export async function getCajasDisponibles(): Promise<Result<Caja[]>> {
  try {
    const supabase = await createClient()

    // Una sola query: cajas activas + sus turnos abiertos (si existen)
    const { data: cajasConTurnos, error } = await supabase
      .from('cajas')
      .select(`
        *,
        caja_turnos!left (
          id,
          estado
        )
      `)
      .eq('estado', true)
      .order('nombre')

    if (error) throw error

    // Filtrar en JavaScript: solo cajas sin turno ABIERTO
    const cajasDisponibles = (cajasConTurnos || []).filter(caja => {
      // caja_turnos es un array. Verificar si hay alguno con estado 'ABIERTA'
      const turnos = caja.caja_turnos as { id: string; estado: string }[] | null
      const tieneTurnoAbierto = turnos?.some(t => t.estado === 'ABIERTA')
      return !tieneTurnoAbierto
    })

    // Limpiar el objeto para no incluir caja_turnos en la respuesta
    const resultado: Caja[] = cajasDisponibles.map(({ caja_turnos, ...caja }) => caja as Caja)

    return { success: true, data: resultado }
  } catch (error: unknown) {
    console.error('Error al obtener cajas disponibles:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
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
  monto_apertura_efectivo: number
  monto_cierre_teorico_efectivo: number
  monto_cierre_real_efectivo: number
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
    monto_apertura_efectivo: number
    monto_apertura_usd: number
    monto_cierre_teorico_efectivo: number | null
    monto_cierre_real_efectivo: number | null
    monto_cierre_teorico_usd: number | null
    monto_cierre_real_usd: number | null
    estado: 'ABIERTA' | 'CERRADA'
    total_efectivo: number | null
    total_tarjeta: number | null
    total_yape: number | null
    total_transferencia: number | null
    total_digital: number | null
    total_vendido: number | null
    descuadre_efectivo: number | null
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
    desglose_metodos_pago?: {
      efectivo: number
      tarjeta: number
      billetera: number
      transferencia: number
      otros: number
    }
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
      monto_apertura_efectivo,
      monto_cierre_teorico_efectivo,
      monto_cierre_real_efectivo,
      cajas!inner(nombre),
      usuarios!caja_turnos_usuario_id_fkey(nombres, apellidos)
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
    const sistema = turno.monto_cierre_teorico_efectivo || 0
    const declarado = turno.monto_cierre_real_efectivo || 0
    const diferencia = declarado - sistema

    let estado: EstadoCierre = 'CUADRADA'
    if (diferencia < 0) estado = 'FALTANTE'
    else if (diferencia > 0) estado = 'SOBRANTE'

    const cajaData = turno.cajas as any
    const usuarioData = turno.usuarios as any

    return {
      id: turno.id,
      fecha_cierre: turno.fecha_cierre,
      caja_nombre: cajaData?.nombre || 'Sin nombre',
      usuario_nombre: `${usuarioData?.nombres || ''} ${usuarioData?.apellidos || ''}`.trim(),
      monto_apertura_efectivo: turno.monto_apertura_efectivo,
      monto_cierre_teorico_efectivo: sistema,
      monto_cierre_real_efectivo: declarado,
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
      monto_apertura_efectivo,
      monto_apertura_usd,
      monto_cierre_teorico_efectivo,
      monto_cierre_real_efectivo,
      monto_cierre_teorico_usd,
      monto_cierre_real_usd,
      total_efectivo,
      total_tarjeta,
      total_yape,
      total_transferencia,
      total_digital,
      total_vendido,
      descuadre_efectivo,
      estado,
      cajas(nombre),
      usuarios!caja_turnos_usuario_id_fkey(nombres, apellidos)
    `)
    .eq('usuario_id', userId)
    .eq('estado', 'ABIERTA')
    .limit(1)
    .maybeSingle()

  if (turnoError) {
    console.log('[getTurnoActivo] Error al buscar turno:', turnoError.message)
    return null
  }

  if (!turno) {
    console.log('[getTurnoActivo] No se encontró turno abierto para usuario:', userId)
    return null
  }

  console.log('[getTurnoActivo] Turno encontrado:', turno.id)

  // OPTIMIZACIÓN: Ejecutar movimientos y estadísticas EN PARALELO
  // Antes: secuencial (~400ms) → Ahora: paralelo (~200ms)
  const [movimientosResult, statsResult, pagosResult] = await Promise.all([
    // Query de movimientos
    supabase
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
        usuarios!caja_movimientos_usuario_id_fkey(nombres, apellidos)
      `)
      .eq('caja_turno_id', turno.id)
      .order('created_at', { ascending: false }),

    // RPC de estadísticas
    supabase.rpc('calcular_movimientos_turno', {
      p_turno_id: turno.id
    }),

    // Query de pagos (para desglose de métodos)
    supabase
      .from('pagos')
      .select('metodo_pago, monto, moneda_pago, tipo_cambio_pago')
      .eq('caja_turno_id', turno.id)
  ])

  const { data: movimientos, error: movError } = movimientosResult
  const { data: stats } = statsResult
  const { data: pagos } = pagosResult

  if (movError) {
    console.error('Error al obtener movimientos:', movError)
    throw new Error('Error al obtener movimientos de caja')
  }

  const estadisticas = stats?.[0] || {
    total_ingresos_pen: 0,
    total_ingresos_usd: 0,
    total_egresos_pen: 0,
    total_egresos_usd: 0,
  }

  // --- LÓGICA DE DESGLOSE DE MÉTODOS DE PAGO Y RECONCILIACIÓN ---
  // Usar helper centralizado para consistencia obsesiva
  const { desglose } = calcularReconciliacionCaja(pagos || [], estadisticas)
  // -------------------------------------------------------------

  const flujo_neto_pen = estadisticas.total_ingresos_pen - estadisticas.total_egresos_pen
  const flujo_neto_usd = estadisticas.total_ingresos_usd - estadisticas.total_egresos_usd
  const total_esperado_pen = turno.monto_apertura_efectivo + flujo_neto_pen
  const total_esperado_usd = turno.monto_apertura_usd + flujo_neto_usd

  // Acceder a las relaciones
  const cajaData = turno.cajas as any
  const usuarioData = turno.usuarios as any

  return {
    turno: {
      id: turno.id,
      caja_nombre: cajaData?.nombre || 'Sin nombre',
      usuario_nombre: `${usuarioData?.nombres || ''} ${usuarioData?.apellidos || ''}`.trim(),
      fecha_apertura: turno.fecha_apertura,
      fecha_cierre: turno.fecha_cierre,
      monto_apertura_efectivo: turno.monto_apertura_efectivo,
      monto_apertura_usd: turno.monto_apertura_usd,
      monto_cierre_teorico_efectivo: turno.monto_cierre_teorico_efectivo,
      monto_cierre_real_efectivo: turno.monto_cierre_real_efectivo,
      monto_cierre_teorico_usd: turno.monto_cierre_teorico_usd,
      monto_cierre_real_usd: turno.monto_cierre_real_usd,
      total_efectivo: turno.total_efectivo,
      total_tarjeta: turno.total_tarjeta,
      total_yape: turno.total_yape,
      total_transferencia: turno.total_transferencia,
      total_digital: turno.total_digital,
      total_vendido: turno.total_vendido,
      descuadre_efectivo: turno.descuadre_efectivo,
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
      desglose_metodos_pago: desglose, // Agregado el desglose
      flujo_neto_pen,
      flujo_neto_usd,
      total_esperado_pen,
      total_esperado_usd,
      ...(turno.estado === 'CERRADA' && {
        diferencia_pen: (turno.monto_cierre_real_efectivo || 0) - (turno.monto_cierre_teorico_efectivo || 0),
        diferencia_usd: (turno.monto_cierre_real_usd || 0) - (turno.monto_cierre_teorico_usd || 0),
      }),
    },
  }
}

/**
 * Obtener todos los turnos activos
 * - Si es ADMIN: Ve todos los turnos abiertos
 * - Si es RECEPCION: Ve solo su propio turno abierto
 */
export async function getTodosLosTurnosActivos(): Promise<DetalleTurno[]> {
  const supabase = await createClient()

  // Verificar usuario
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuario) throw new Error('Usuario no encontrado')

  // Si no es ADMIN, devolver solo su turno
  if (usuario.rol !== 'ADMIN') {
    const miTurno = await getTurnoActivo(user.id)
    return miTurno ? [miTurno] : []
  }

  // Si es ADMIN, obtener todos los turnos abiertos
  const { data: turnos, error } = await supabase
    .from('caja_turnos')
    .select(`
      id,
      usuario_id,
      fecha_apertura,
      monto_apertura_efectivo,
      monto_apertura_usd,
      estado,
      cajas!inner(nombre),
      usuarios!caja_turnos_usuario_id_fkey(nombres, apellidos)
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
      monto_apertura_efectivo,
      monto_apertura_usd,
      monto_cierre_teorico_efectivo,
      monto_cierre_real_efectivo,
      monto_cierre_teorico_usd,
      monto_cierre_real_usd,
      total_efectivo,
      total_tarjeta,
      total_yape,
      total_transferencia,
      total_digital,
      total_vendido,
      descuadre_efectivo,
      estado,
      cajas!inner(nombre),
      usuarios!caja_turnos_usuario_id_fkey(nombres, apellidos)
    `)
    .eq('id', turnoId)
    .eq('estado', 'CERRADA')
    .single()

  if (turnoError || !turno) {
    throw new Error('Turno no encontrado')
  }

  // Ejecutar consultas en paralelo para optimización
  const [movimientosResult, statsResult, pagosResult] = await Promise.all([
    supabase
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
        usuarios!caja_movimientos_usuario_id_fkey(nombres, apellidos)
      `)
      .eq('caja_turno_id', turno.id)
      .order('created_at', { ascending: false }),

    supabase.rpc('calcular_movimientos_turno', {
      p_turno_id: turno.id
    }),

    supabase
      .from('pagos')
      .select('metodo_pago, monto, moneda_pago, tipo_cambio_pago')
      .eq('caja_turno_id', turno.id)
  ])

  const { data: movimientos, error: movError } = movimientosResult
  const { data: stats } = statsResult
  const { data: pagos } = pagosResult

  if (movError) {
    console.error('Error al obtener movimientos:', movError)
    throw new Error('Error al obtener movimientos')
  }

  const estadisticas = stats?.[0] || {
    total_ingresos_pen: 0,
    total_ingresos_usd: 0,
    total_egresos_pen: 0,
    total_egresos_usd: 0,
  }

  // Usar helper centralizado para consistencia obsesiva
  const { desglose } = calcularReconciliacionCaja(pagos || [], estadisticas)

  const flujo_neto_pen = estadisticas.total_ingresos_pen - estadisticas.total_egresos_pen
  const flujo_neto_usd = estadisticas.total_ingresos_usd - estadisticas.total_egresos_usd

  // Acceder a las relaciones con type assertion
  const cajaData = turno.cajas as any
  const usuarioData = turno.usuarios as any

  return {
    turno: {
      id: turno.id,
      caja_nombre: cajaData?.nombre || 'Sin nombre',
      usuario_nombre: `${usuarioData?.nombres || ''} ${usuarioData?.apellidos || ''}`.trim(),
      fecha_apertura: turno.fecha_apertura,
      fecha_cierre: turno.fecha_cierre,
      monto_apertura_efectivo: turno.monto_apertura_efectivo,
      monto_apertura_usd: turno.monto_apertura_usd,
      monto_cierre_teorico_efectivo: turno.monto_cierre_teorico_efectivo,
      monto_cierre_real_efectivo: turno.monto_cierre_real_efectivo,
      monto_cierre_teorico_usd: turno.monto_cierre_teorico_usd,
      monto_cierre_real_usd: turno.monto_cierre_real_usd,
      total_efectivo: turno.total_efectivo,
      total_tarjeta: turno.total_tarjeta,
      total_yape: turno.total_yape,
      total_transferencia: turno.total_transferencia,
      total_digital: turno.total_digital,
      total_vendido: turno.total_vendido,
      descuadre_efectivo: turno.descuadre_efectivo,
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
      desglose_metodos_pago: desglose, // Agregado desglose reconciliado
      flujo_neto_pen,
      flujo_neto_usd,
      total_esperado_pen: turno.monto_apertura_efectivo + flujo_neto_pen,
      total_esperado_usd: turno.monto_apertura_usd + flujo_neto_usd,
      diferencia_pen: (turno.monto_cierre_real_efectivo || 0) - (turno.monto_cierre_teorico_efectivo || 0),
      diferencia_usd: (turno.monto_cierre_real_usd || 0) - (turno.monto_cierre_teorico_usd || 0),
    },
  }
}

/**
 * Obtener detalle de un turno activo por ID (para página de gestionar)
 */
export async function getDetalleTurnoActivo(turnoId: string): Promise<DetalleTurno | null> {
  const supabase = await createClient()

  const { data: turno, error: turnoError } = await supabase
    .from('caja_turnos')
    .select(`
      id,
      fecha_apertura,
      fecha_cierre,
      monto_apertura_efectivo,
      monto_apertura_usd,
      monto_cierre_teorico_efectivo,
      monto_cierre_real_efectivo,
      monto_cierre_teorico_usd,
      monto_cierre_real_usd,
      total_efectivo,
      total_tarjeta,
      total_yape,
      total_transferencia,
      total_digital,
      total_vendido,
      descuadre_efectivo,
      estado,
      cajas!inner(nombre),
      usuarios!caja_turnos_usuario_id_fkey(nombres, apellidos)
    `)
    .eq('id', turnoId)
    .eq('estado', 'ABIERTA')
    .single()

  if (turnoError || !turno) {
    console.log('[getDetalleTurnoActivo] Turno no encontrado:', turnoId)
    return null
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
      usuarios!caja_movimientos_usuario_id_fkey(nombres, apellidos)
    `)
    .eq('caja_turno_id', turno.id)
    .order('created_at', { ascending: false })

  if (movError) {
    console.error('Error al obtener movimientos:', movError)
    return null
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

  // Calcular desglose por método de pago consultando la tabla de pagos
  const { data: pagos } = await supabase
    .from('pagos')
    .select('metodo_pago, monto, moneda_pago, tipo_cambio_pago')
    .eq('caja_turno_id', turno.id)

  // Usar helper centralizado para consistencia obsesiva
  const { desglose } = calcularReconciliacionCaja(pagos || [], estadisticas)



  return {
    turno: {
      id: turno.id,
      caja_nombre: (turno.cajas as any).nombre,
      usuario_nombre: `${(turno.usuarios as any).nombres} ${(turno.usuarios as any).apellidos || ''}`.trim(),
      fecha_apertura: turno.fecha_apertura,
      fecha_cierre: turno.fecha_cierre,
      monto_apertura_efectivo: turno.monto_apertura_efectivo,
      monto_apertura_usd: turno.monto_apertura_usd,
      monto_cierre_teorico_efectivo: turno.monto_cierre_teorico_efectivo,
      monto_cierre_real_efectivo: turno.monto_cierre_real_efectivo,
      monto_cierre_teorico_usd: turno.monto_cierre_teorico_usd,
      monto_cierre_real_usd: turno.monto_cierre_real_usd,
      total_efectivo: turno.total_efectivo,
      total_tarjeta: turno.total_tarjeta,
      total_yape: turno.total_yape,
      total_transferencia: turno.total_transferencia,
      total_digital: turno.total_digital,
      total_vendido: turno.total_vendido,
      descuadre_efectivo: turno.descuadre_efectivo,
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
      total_esperado_pen: turno.monto_apertura_efectivo + flujo_neto_pen,
      total_esperado_usd: turno.monto_apertura_usd + flujo_neto_usd,
      desglose_metodos_pago: desglose
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
      monto_apertura_efectivo: input.monto_apertura,
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
      monto_cierre_real_efectivo: input.monto_declarado_pen,
      monto_cierre_real_usd: input.monto_declarado_usd,
      monto_cierre_teorico_efectivo: await calcularEfectivoLocal(supabase, input.turno_id, detalleTurno.estadisticas.total_esperado_pen),
      monto_cierre_teorico_usd: detalleTurno.estadisticas.total_esperado_usd,
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
      monto_cierre_real_efectivo: input.monto_declarado_pen,
      monto_cierre_real_usd: input.monto_declarado_usd,
      monto_cierre_teorico_efectivo: await calcularEfectivoLocal(supabase, input.turno_id, detalleTurno.estadisticas.total_esperado_pen),
      monto_cierre_teorico_usd: detalleTurno.estadisticas.total_esperado_usd,
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
 * Obtener efectivo disponible en el turno activo
 * Calcula: apertura + ingresos_efectivo - egresos_efectivo
 * Útil para validar si hay saldo suficiente antes de una devolución
 */
export async function getEfectivoDisponibleTurno(): Promise<{
  success: boolean
  efectivo_disponible?: number
  turno_id?: string
  error?: string
}> {
  try {
    const turno = await getTurnoActivo()

    if (!turno) {
      return { success: false, error: 'No hay turno activo' }
    }

    // Calcular efectivo disponible usando la lógica existente
    // total_esperado_pen ya tiene: apertura + ingresos - egresos
    const supabase = await createClient()
    const efectivoReal = await calcularEfectivoLocal(
      supabase,
      turno.turno.id,
      turno.estadisticas.total_esperado_pen
    )

    return {
      success: true,
      efectivo_disponible: efectivoReal,
      turno_id: turno.turno.id
    }
  } catch (error: any) {
    console.error('Error al calcular efectivo disponible:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Registrar movimiento de caja
 */
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

  revalidatePath('/')
  revalidatePath('/cajas')
  revalidatePath(`/cajas/gestionar/${turnoActivo.turno.id}`)
  return { success: true }
}

/**
 * Helper crucial para mantener consistencia "obsesivamente correcta" en toda la app.
 * Centraliza la lógica de desglose de métodos de pago y reconciliación de efectivo vs movimientos.
 */
function calcularReconciliacionCaja(pagos: any[], estadisticas: any) {
  const desglose = {
    efectivo: 0,
    tarjeta: 0,
    billetera: 0,
    transferencia: 0,
    otros: 0
  }

  let totalPagosPositivos = 0
  let totalPagosNegativosEfectivo = 0
  let totalGeneral = 0

  if (pagos) {
    pagos.forEach(p => {
      // Normalizar todo a PEN para el desglose visual principal
      const montoEnPen = p.moneda_pago === 'USD' ? p.monto * (p.tipo_cambio_pago || 1) : p.monto
      totalGeneral += montoEnPen

      // Acumular para lógica de conciliación
      if (montoEnPen > 0) {
        totalPagosPositivos += montoEnPen
      } else if (p.metodo_pago === 'DEVOLUCION_EFECTIVO') {
        totalPagosNegativosEfectivo += Math.abs(montoEnPen)
      }

      switch (p.metodo_pago) {
        case 'EFECTIVO':
          desglose.efectivo += montoEnPen;
          break;
        case 'DEVOLUCION_EFECTIVO':
          desglose.efectivo += montoEnPen; // Resta del efectivo (monto es negativo)
          break;
        case 'TARJETA': desglose.tarjeta += montoEnPen; break;
        case 'YAPE':
        case 'PLIN': desglose.billetera += montoEnPen; break;
        case 'TRANSFERENCIA': desglose.transferencia += montoEnPen; break;
        default: desglose.otros += montoEnPen;
      }
    })
  }

  // A. Ingresos Manuales
  const totalIngresosCaja = estadisticas.total_ingresos_pen
  let manualIngreso = 0
  if (totalIngresosCaja > totalPagosPositivos) {
    manualIngreso = totalIngresosCaja - totalPagosPositivos
    desglose.efectivo += manualIngreso
  }

  // B. Egresos Manuales
  const totalEgresosCaja = estadisticas.total_egresos_pen
  let manualEgreso = 0
  if (totalEgresosCaja > totalPagosNegativosEfectivo) {
    manualEgreso = totalEgresosCaja - totalPagosNegativosEfectivo
    desglose.efectivo -= manualEgreso
  }

  return {
    desglose,
    totalGeneral,
    manualIngreso,
    manualEgreso,
    totalPagosPositivos,
    totalPagosNegativosEfectivo
  }
}

/**
 * Obtener devoluciones pendientes de procesar
 * Son pagos negativos con metodo_pago 'DEVOLUCION_PENDIENTE'
 */
export async function getDevolucionesPendientes() {
  const supabase = await createClient()

  const { data: devoluciones, error } = await supabase
    .from('pagos')
    .select(`
      id,
      monto,
      fecha_pago,
      nota,
      reserva:reservas(
        id,
        codigo_reserva,
        huesped:huespedes(nombre_completo)
      )
    `)
    .eq('metodo_pago', 'DEVOLUCION_PENDIENTE')
    .order('fecha_pago', { ascending: false })

  if (error) {
    console.error('Error al obtener devoluciones pendientes:', error)
    return []
  }

  return devoluciones || []
}

/**
 * Marcar una devolución pendiente como procesada
 * Actualiza el método de pago de DEVOLUCION_PENDIENTE al método real usado (ej: YAPE)
 */
export async function marcarDevolucionProcesada(pagoId: string, metodoReal: string, notaAdicional?: string) {
  const supabase = await createClient()

  // Obtener nota actual
  // Obtener nota actual y turno
  const { data: pago } = await supabase.from('pagos').select('nota, caja_turno_id').eq('id', pagoId).single()
  const nuevaNota = `${pago?.nota || ''} - Procesado con ${metodoReal} ${notaAdicional ? `(${notaAdicional})` : ''}`

  const { error } = await supabase
    .from('pagos')
    .update({
      metodo_pago: metodoReal,
      nota: nuevaNota,
      fecha_pago: new Date().toISOString() // Actualizamos fecha al momento real del pago
    })
    .eq('id', pagoId)
    .eq('metodo_pago', 'DEVOLUCION_PENDIENTE')

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/cajas')
  if (pago?.caja_turno_id) {
    revalidatePath(`/cajas/gestionar/${pago.caja_turno_id}`)
  }
  return { success: true }
}

/**
 * Obtener reporte de métodos de pago para un turno
 * Retorna totales agrupados por método de pago consultando la tabla PAGOS
 */
export async function getReporteMetodosPago(turnoId: string) {
  const supabase = await createClient()

  // 1. Obtener pagos vinculados a este turno
  const { data: pagos, error } = await supabase
    .from('pagos')
    .select('metodo_pago, monto, moneda_pago, tipo_cambio_pago')
    .eq('caja_turno_id', turnoId)

  if (error) {
    console.error('Error al obtener pagos del turno:', error)
    return { success: false, error: 'Error al calcular reporte de pagos' }
  }

  // 2. Obtener estadísticas base para el helper (movimientos físicos)
  const { data: stats } = await supabase.rpc('calcular_movimientos_turno', { p_turno_id: turnoId })
  const estadisticas = stats?.[0] || {
    total_ingresos_pen: 0,
    total_egresos_pen: 0,
    total_ingresos_usd: 0,
    total_egresos_usd: 0
  }

  // 3. Usar helper centralizado para conciliación "Obsesivamente Correcta"
  const {
    desglose,
    totalGeneral,
    manualIngreso,
    manualEgreso,
    totalPagosPositivos,
    totalPagosNegativosEfectivo
  } = calcularReconciliacionCaja(pagos || [], estadisticas)

  const totales = {
    totalEfectivoPEN: desglose.efectivo,
    totalTarjeta: desglose.tarjeta,
    totalYape: desglose.billetera, // Mapeo de nombre para compatibilidad UI (Total Yape = Billetera)
    totalPlin: 0, // Incluido en billetera por ahora
    totalTransferencia: desglose.transferencia,
    totalGeneral,
    pagos: pagos || [],

    // Metadata adicional útil para debugging/auditoría
    manualIngreso,
    manualEgreso,
    totalIngresosMovimientos: estadisticas.total_ingresos_pen,
    totalEgresosMovimientos: estadisticas.total_egresos_pen,
    totalPagosPositivos,
    totalPagosNegativosEfectivo
  }

  return { success: true, data: totales }
}

async function calcularEfectivoLocal(supabase: any, turnoId: string, totalEsperado: number) {
  const { data: pagos } = await supabase.from('pagos').select('metodo_pago, monto, moneda_pago, tipo_cambio_pago').eq('caja_turno_id', turnoId)
  if (!pagos) return totalEsperado

  let noEfectivo = 0
  pagos.forEach((p: any) => {
    if (p.metodo_pago !== 'EFECTIVO') {
      const m = p.moneda_pago === 'USD' ? p.monto * (p.tipo_cambio_pago || 1) : p.monto
      noEfectivo += m
    }
  })
  return totalEsperado - noEfectivo
}

export async function getHistorialTurnos(filtros?: {
  fecha_inicio?: string
  fecha_fin?: string
  usuario_id?: string
  caja_id?: string
  solo_descuadres?: boolean
}) {
  const supabase = await createClient()

  let query = supabase
    .from('caja_turnos')
    .select(`
      id,
      fecha_cierre,
      monto_apertura_efectivo,
      monto_apertura_usd,
      monto_cierre_teorico_efectivo,
      monto_cierre_real_efectivo,
      monto_cierre_teorico_usd,
      monto_cierre_real_usd,
      estado,
      cajas!inner(nombre),
      usuarios!caja_turnos_usuario_id_fkey(nombres, apellidos)
    `)
    .eq('estado', 'CERRADA')
    .order('fecha_cierre', { ascending: false })

  if (filtros?.fecha_inicio) {
    query = query.gte('fecha_cierre', filtros.fecha_inicio)
  }
  if (filtros?.fecha_fin) {
    query = query.lte('fecha_cierre', filtros.fecha_fin + ' 23:59:59')
  }
  // usuario_id y caja_id si se implementan filtros específicos UI

  const { data, error } = await query

  if (error) {
    console.error('Error getHistorialTurnos:', error)
    return { success: false, error: 'Error al cargar historial' }
  }

  const turnos = data.map((t: any) => ({
    id: t.id,
    fecha_cierre: t.fecha_cierre,
    monto_apertura_efectivo: t.monto_apertura_efectivo,
    monto_apertura_usd: t.monto_apertura_usd,
    monto_cierre_teorico_efectivo: t.monto_cierre_teorico_efectivo,
    monto_cierre_real_efectivo: t.monto_cierre_real_efectivo,
    monto_cierre_teorico_usd: t.monto_cierre_teorico_usd,
    monto_cierre_real_usd: t.monto_cierre_real_usd,
    caja: { nombre: t.cajas.nombre },
    usuario: { nombres: t.usuarios.nombres, apellidos: t.usuarios.apellidos }
  }))

  if (filtros?.solo_descuadres) {
    return { success: true, data: turnos.filter((t: any) => Math.abs((t.monto_cierre_real_efectivo || 0) - (t.monto_cierre_teorico_efectivo || 0)) > 0.5) }
  }

  return { success: true, data: turnos }
}

