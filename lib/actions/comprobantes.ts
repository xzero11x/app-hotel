'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getHotelConfig } from '@/lib/actions/configuracion'
import { enviarComprobanteNubefact, consultarEstadoNubefact } from '@/lib/services/nubefact'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'

// ========================================
// TYPES
// ========================================
export type Comprobante = {
  id: string
  serie_id: string
  tipo_comprobante: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO' | 'TICKET_INTERNO'
  serie_numero: string
  correlativo: number
  numero_completo: string

  // Cliente
  cliente_tipo_doc: string
  cliente_numero_doc: string
  cliente_nombre: string
  cliente_direccion: string | null

  // Montos
  subtotal: number
  igv: number
  total: number
  moneda: 'PEN' | 'USD'

  // SUNAT
  estado_sunat: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'ANULADO'
  hash_cpe: string | null
  xml_firmado: string | null
  pdf_url: string | null

  // Auditoría
  fecha_emision: string
  usuario_emisor_id: string
  reserva_id: string | null
}

export type EmitirComprobanteInput = {
  reserva_id: string
  tipo_comprobante: 'BOLETA' | 'FACTURA'
  serie: string  // Serie como texto, ej: 'B001', 'F001'

  // Datos del cliente
  cliente_tipo_doc: 'DNI' | 'RUC' | 'PASAPORTE' | 'CE'
  cliente_numero_doc: string
  cliente_nombre: string
  cliente_direccion?: string

  // Items del comprobante
  items: ComprobanteItem[]

  // Observaciones
  observaciones?: string
}

export type ComprobanteItem = {
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  codigo_afectacion_igv?: string // '10' = Gravado, '20' = Exonerado
}

// ========================================
// INSERTAR COMPROBANTE ATÓMICO
// ========================================
// Esta función usa una RPC de Postgres que garantiza atomicidad:
// El correlativo SOLO se incrementa si el INSERT es exitoso.
// Si hay cualquier error, el correlativo no se consume.

type InsertarComprobanteParams = {
  serie: string
  tipo_comprobante: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO'
  turno_caja_id: string
  reserva_id: string
  receptor_tipo_doc: string
  receptor_nro_doc: string
  receptor_razon_social: string
  receptor_direccion?: string | null
  moneda: string
  tipo_cambio: number
  op_gravadas: number
  op_exoneradas: number
  monto_igv: number
  total_venta: number
  nota_credito_ref_id?: string | null
}

type InsertarComprobanteResult = {
  id: string
  serie: string
  numero: number
  numero_completo: string
}

async function insertarComprobanteAtomico(
  params: InsertarComprobanteParams
): Promise<InsertarComprobanteResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('insertar_comprobante_atomico', {
    p_serie: params.serie,
    p_tipo_comprobante: params.tipo_comprobante,
    p_turno_caja_id: params.turno_caja_id,
    p_reserva_id: params.reserva_id,
    p_receptor_tipo_doc: params.receptor_tipo_doc,
    p_receptor_nro_doc: params.receptor_nro_doc,
    p_receptor_razon_social: params.receptor_razon_social,
    p_receptor_direccion: params.receptor_direccion || null,
    p_moneda: params.moneda,
    p_tipo_cambio: params.tipo_cambio,
    p_op_gravadas: params.op_gravadas,
    p_op_exoneradas: params.op_exoneradas,
    p_monto_igv: params.monto_igv,
    p_total_venta: params.total_venta,
    p_nota_credito_ref_id: params.nota_credito_ref_id || null
  })

  if (error) {
    console.error('Error en insertarComprobanteAtomico:', error)
    throw new Error(`Error al crear comprobante: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('No se recibió respuesta del servidor')
  }

  // La RPC retorna un array, tomamos el primer elemento
  const resultado = data[0]

  return {
    id: resultado.id,
    serie: resultado.serie,
    numero: resultado.numero,
    numero_completo: resultado.numero_completo
  }
}

// DEPRECATED: Esta función ya no se usa directamente
// Se mantiene por si hay código legacy que la necesite
async function obtenerSiguienteCorrelativo(serie: string, tipo: string): Promise<{
  correlativo: number
  numero_completo: string
}> {
  const supabase = await createClient()

  const { data: correlativo, error } = await supabase
    .rpc('obtener_siguiente_correlativo', {
      p_serie: serie,
      p_tipo: tipo
    })

  if (error) {
    console.error('Error al obtener correlativo:', error)
    throw new Error('Error al generar número de comprobante')
  }

  if (!correlativo) {
    throw new Error('No se pudo obtener correlativo')
  }

  const numero_completo = `${serie}-${correlativo.toString().padStart(8, '0')}`

  return {
    correlativo: correlativo,
    numero_completo
  }
}

// ========================================
// EMITIR COMPROBANTE
// ========================================
export async function emitirComprobante(input: EmitirComprobanteInput) {
  const supabase = await createClient()

  // 1. Obtener turno de caja activo
  const { data: turnoActivo, error: turnoError } = await supabase
    .from('caja_turnos')
    .select('id')
    .eq('estado', 'ABIERTA')
    .maybeSingle()

  if (turnoError || !turnoActivo) {
    throw new Error('No hay un turno de caja activo')
  }

  // 2. Validar que la reserva existe
  const { data: reserva, error: reservaError } = await supabase
    .from('reservas')
    .select('id, precio_pactado')
    .eq('id', input.reserva_id)
    .single()

  if (reservaError || !reserva) {
    throw new Error('Reserva no encontrada')
  }

  // 3. Validar items
  if (!input.items || input.items.length === 0) {
    throw new Error('Debe agregar al menos un item al comprobante')
  }

  // 4. Obtener configuración fiscal
  const config = await getHotelConfig()

  // Validar configuración fiscal completa
  if (!config.ruc || config.ruc === '20000000001') {
    throw new Error('Debe configurar el RUC de su empresa en Configuración antes de emitir comprobantes')
  }

  // Validar formato de RUC (11 dígitos, comienza con 10, 15, 17 o 20)
  const rucPattern = /^(10|15|17|20)[0-9]{9}$/
  if (!rucPattern.test(config.ruc)) {
    throw new Error(
      'El RUC configurado no tiene formato válido. ' +
      'Debe tener 11 dígitos e iniciar con 10, 15, 17 o 20'
    )
  }

  if (!config.razon_social || config.razon_social === 'MI HOTEL S.A.C.') {
    throw new Error('Debe configurar la razón social de su empresa en Configuración')
  }

  if (!config.direccion_fiscal) {
    throw new Error('Debe configurar la dirección fiscal en Configuración')
  }

  // Validar documento del cliente según tipo de comprobante
  if (input.tipo_comprobante === 'FACTURA') {
    if (input.cliente_tipo_doc !== 'RUC') {
      throw new Error('Las facturas requieren que el cliente tenga RUC')
    }
    if (input.cliente_numero_doc.length !== 11) {
      throw new Error('El RUC del cliente debe tener 11 dígitos')
    }
  } else if (input.tipo_comprobante === 'BOLETA') {
    if (input.cliente_tipo_doc === 'DNI' && input.cliente_numero_doc.length !== 8) {
      throw new Error('El DNI debe tener 8 dígitos')
    }
  }

  // Calcular totales según configuración
  const TASA_IGV = config.es_exonerado_igv ? 0 : (config.tasa_igv || 18.00) / 100

  // 5. Calcular montos fiscales
  let op_gravadas = 0
  let op_exoneradas = 0
  let monto_igv = 0

  for (const item of input.items) {
    const codigoAfectacion = config.es_exonerado_igv ? '20' : (item.codigo_afectacion_igv || '10')

    if (codigoAfectacion === '10') {
      // Gravado: el subtotal incluye IGV, hay que desglosa
      const base = item.subtotal / (1 + TASA_IGV)
      op_gravadas += base
      monto_igv += (item.subtotal - base)
    } else {
      // Exonerado o Inafecto
      op_exoneradas += item.subtotal
    }
  }

  const total_venta = op_gravadas + monto_igv + op_exoneradas

  // 6. Crear comprobante usando función atómica (correlativo se obtiene e inserta en una sola transacción)
  const comprobante = await insertarComprobanteAtomico({
    serie: input.serie,
    tipo_comprobante: input.tipo_comprobante,
    turno_caja_id: turnoActivo.id,
    reserva_id: input.reserva_id,
    receptor_tipo_doc: input.cliente_tipo_doc,
    receptor_nro_doc: input.cliente_numero_doc,
    receptor_razon_social: input.cliente_nombre,
    receptor_direccion: input.cliente_direccion,
    moneda: 'PEN',
    tipo_cambio: 1.0,
    op_gravadas: op_gravadas,
    op_exoneradas: op_exoneradas,
    monto_igv: monto_igv,
    total_venta: total_venta
  })

  // 8. Crear items del comprobante
  const itemsToInsert = input.items.map(item => ({
    comprobante_id: comprobante.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    subtotal: item.subtotal,
    codigo_afectacion_igv: config.es_exonerado_igv ? '20' : (item.codigo_afectacion_igv || '10')
  }))

  const { error: itemsError } = await supabase
    .from('comprobante_detalles')
    .insert(itemsToInsert)

  if (itemsError) {
    console.error('Error al crear items:', itemsError)
    // Intentar eliminar el comprobante creado
    await supabase.from('comprobantes').delete().eq('id', comprobante.id)
    throw new Error('Error al registrar items del comprobante')
  }

  // 9. Enviar a NubeFact (si está configurado)
  try {
    // Formatear fecha a DD-MM-YYYY (formato requerido por Nubefact)
    const hoy = new Date()
    const fechaFormateada = `${String(hoy.getDate()).padStart(2, '0')}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${hoy.getFullYear()}`

    const respuesta = await enviarComprobanteNubefact({
      tipo_comprobante: input.tipo_comprobante,
      serie: input.serie,
      numero: comprobante.numero,

      cliente_tipo_documento: input.cliente_tipo_doc,
      cliente_numero_documento: input.cliente_numero_doc,
      cliente_denominacion: input.cliente_nombre,
      cliente_direccion: input.cliente_direccion,

      fecha_emision: fechaFormateada,
      moneda: 'PEN',
      tipo_cambio: 1.000,
      porcentaje_igv: config.tasa_igv ?? 18,
      total_gravada: op_gravadas,
      total_exonerada: op_exoneradas,
      total_igv: monto_igv,
      total: total_venta,

      items: input.items.map(item => {
        const esExonerado = config.es_exonerado_igv || item.codigo_afectacion_igv === '20'
        const tasaIgv = esExonerado ? 0 : (config.tasa_igv || 18) / 100
        // valor_unitario = precio sin IGV
        const valorUnitario = item.precio_unitario / (1 + tasaIgv)
        // precio_unitario = precio con IGV
        const precioUnitario = item.precio_unitario
        // subtotal = valor_unitario * cantidad (sin IGV)
        const subtotal = valorUnitario * item.cantidad
        // igv de la línea
        const igvLinea = subtotal * tasaIgv
        // total de la línea
        const totalLinea = subtotal + igvLinea

        return {
          unidad_de_medida: 'ZZ', // ZZ = Servicio
          codigo: '90101501', // Código SUNAT para servicios de alojamiento
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          valor_unitario: Number(valorUnitario.toFixed(10)),
          precio_unitario: Number(precioUnitario.toFixed(2)),
          subtotal: Number(subtotal.toFixed(2)),
          tipo_de_igv: esExonerado ? 8 : 1, // 1=Gravado, 8=Exonerado
          igv: Number(igvLinea.toFixed(2)),
          total: Number(totalLinea.toFixed(2))
        }
      })
    })

    if (respuesta.success && respuesta.aceptada_por_sunat) {
      // Actualizar con respuesta de NubeFact
      await supabase
        .from('comprobantes')
        .update({
          estado_sunat: 'ACEPTADO',
          hash_cpe: respuesta.hash,
          xml_url: respuesta.enlace,
          cdr_url: respuesta.enlace_del_cdr,
          external_id: respuesta.enlace_pdf
        })
        .eq('id', comprobante.id)

      logger.info('Comprobante aceptado por SUNAT', {
        comprobante_id: comprobante.id,
        hash: respuesta.hash
      })
    } else {
      // Marcar como rechazado si SUNAT lo rechazó
      await supabase
        .from('comprobantes')
        .update({
          estado_sunat: 'RECHAZADO',
          observaciones: respuesta.errors || respuesta.mensaje
        })
        .eq('id', comprobante.id)

      logger.warn('Comprobante rechazado por SUNAT', {
        comprobante_id: comprobante.id,
        error: respuesta.errors
      })
    }
  } catch (error) {
    // Si falla el envío a NubeFact, el comprobante queda PENDIENTE
    logger.error('Error al enviar a NubeFact', {
      comprobante_id: comprobante.id,
      error: getErrorMessage(error)
    })
    // No lanzar error, el comprobante se puede reenviar después
  }

  revalidatePath('/comprobantes')
  revalidatePath('/rack')

  return comprobante
}

// ========================================
// REENVIAR COMPROBANTE A NUBEFACT
// Para comprobantes que quedaron PENDIENTES o RECHAZADOS
// ========================================
export async function reenviarComprobanteNubefact(comprobante_id: string) {
  const supabase = await createClient()

  // 1. Obtener comprobante con sus detalles
  const { data: comprobante, error: compError } = await supabase
    .from('comprobantes')
    .select(`
      *,
      comprobante_detalles (*)
    `)
    .eq('id', comprobante_id)
    .single()

  if (compError || !comprobante) {
    return { success: false, error: 'Comprobante no encontrado' }
  }

  // 2. Validar que el estado permita reenvío
  if (comprobante.estado_sunat === 'ACEPTADO') {
    return { success: false, error: 'El comprobante ya fue aceptado por SUNAT' }
  }

  if (comprobante.estado_sunat === 'ANULADO') {
    return { success: false, error: 'No se puede reenviar un comprobante anulado' }
  }

  // 3. Obtener configuración
  const config = await getHotelConfig()
  const TASA_IGV = config.es_exonerado_igv ? 0 : (config.tasa_igv || 18) / 100

  // 4. Formatear fecha
  const fechaEmision = new Date(comprobante.fecha_emision)
  const fechaFormateada = `${String(fechaEmision.getDate()).padStart(2, '0')}-${String(fechaEmision.getMonth() + 1).padStart(2, '0')}-${fechaEmision.getFullYear()}`

  try {
    // 5. Construir items
    const items = comprobante.comprobante_detalles.map((det: any) => {
      const esExonerado = det.codigo_afectacion_igv === '20'
      const tasaIgv = esExonerado ? 0 : TASA_IGV
      const valorUnitario = det.precio_unitario / (1 + tasaIgv)
      const subtotal = valorUnitario * det.cantidad
      const igvLinea = subtotal * tasaIgv
      const totalLinea = subtotal + igvLinea

      return {
        unidad_de_medida: 'ZZ',
        codigo: '90101501',
        descripcion: det.descripcion,
        cantidad: det.cantidad,
        valor_unitario: Number(valorUnitario.toFixed(10)),
        precio_unitario: Number(det.precio_unitario.toFixed(2)),
        subtotal: Number(subtotal.toFixed(2)),
        tipo_de_igv: esExonerado ? 8 : 1,
        igv: Number(igvLinea.toFixed(2)),
        total: Number(totalLinea.toFixed(2))
      }
    })

    // 6. Enviar a Nubefact
    const respuesta = await enviarComprobanteNubefact({
      tipo_comprobante: comprobante.tipo_comprobante as any,
      serie: comprobante.serie,
      numero: comprobante.numero,
      cliente_tipo_documento: comprobante.receptor_tipo_doc,
      cliente_numero_documento: comprobante.receptor_nro_doc,
      cliente_denominacion: comprobante.receptor_razon_social,
      cliente_direccion: comprobante.receptor_direccion,
      fecha_emision: fechaFormateada,
      moneda: comprobante.moneda || 'PEN',
      tipo_cambio: comprobante.tipo_cambio || 1.0,
      porcentaje_igv: config.tasa_igv || 18,
      total_gravada: comprobante.op_gravadas || 0,
      total_exonerada: comprobante.op_exoneradas || 0,
      total_igv: comprobante.monto_igv || 0,
      total: comprobante.total_venta,
      items
    })

    // 7. Actualizar estado
    if (respuesta.success && respuesta.aceptada_por_sunat) {
      await supabase
        .from('comprobantes')
        .update({
          estado_sunat: 'ACEPTADO',
          hash_cpe: respuesta.hash,
          xml_url: respuesta.enlace,
          cdr_url: respuesta.enlace_del_cdr,
          external_id: respuesta.enlace_pdf,
          observaciones: null
        })
        .eq('id', comprobante_id)

      logger.info('Comprobante reenviado exitosamente', { comprobante_id })
      revalidatePath('/facturacion')
      return { success: true, message: 'Comprobante enviado y aceptado por SUNAT' }
    } else {
      await supabase
        .from('comprobantes')
        .update({
          estado_sunat: 'RECHAZADO',
          observaciones: respuesta.errors || respuesta.mensaje
        })
        .eq('id', comprobante_id)

      logger.warn('Reenvío rechazado por SUNAT', { comprobante_id, error: respuesta.errors })
      revalidatePath('/facturacion')
      return { success: false, error: respuesta.errors || 'Rechazado por SUNAT' }
    }
  } catch (error) {
    logger.error('Error al reenviar a Nubefact', { comprobante_id, error: getErrorMessage(error) })
    return { success: false, error: getErrorMessage(error) }
  }
}

// ========================================
// OBTENER HISTORIAL COMPLETO DE COMPROBANTES
// ========================================
export async function getHistorialComprobantes(filtros?: {
  tipo_comprobante?: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO' | 'TODAS'
  estado_sunat?: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'ANULADO' | 'TODOS'
  fecha_desde?: string
  fecha_hasta?: string
  busqueda?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('vw_historial_comprobantes')
    .select(`
      *,
      reserva_id,
      codigo_reserva
    `)

  // Aplicar filtros
  if (filtros?.tipo_comprobante && filtros.tipo_comprobante !== 'TODAS') {
    query = query.eq('tipo_comprobante', filtros.tipo_comprobante)
  }

  if (filtros?.estado_sunat && filtros.estado_sunat !== 'TODOS') {
    query = query.eq('estado_sunat', filtros.estado_sunat)
  }

  if (filtros?.fecha_desde) {
    query = query.gte('fecha_emision', filtros.fecha_desde)
  }

  if (filtros?.fecha_hasta) {
    query = query.lte('fecha_emision', filtros.fecha_hasta)
  }

  if (filtros?.busqueda) {
    query = query.or(`cliente_nombre.ilike.%${filtros.busqueda}%,numero_completo.ilike.%${filtros.busqueda}%,cliente_doc.ilike.%${filtros.busqueda}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error al obtener historial:', error)
    throw new Error('Error al cargar historial de comprobantes')
  }

  // Concatenar serie y numero para crear numero_completo
  const comprobantesConNumeroCompleto = (data || []).map((c: any) => ({
    ...c,
    numero_completo: `${c.serie}-${String(c.numero).padStart(8, '0')}`
  }))

  return comprobantesConNumeroCompleto
}

// ========================================
// OBTENER DETALLE COMPLETO DE UN COMPROBANTE
// ========================================
export async function getDetalleComprobante(comprobante_id: string) {
  const supabase = await createClient()

  // 1. Obtener datos del comprobante
  const { data: comprobante, error: comprobanteError } = await supabase
    .from('comprobantes')
    .select(`
      *,
      caja_turnos (
        usuario_id,
        usuarios!caja_turnos_usuario_id_fkey (
          nombres,
          apellidos
        )
      ),
      reservas (
        id,
        codigo_reserva,
        habitaciones (
          numero,
          piso
        )
      )
    `)
    .eq('id', comprobante_id)
    .single()

  if (comprobanteError || !comprobante) {
    console.error('Error al cargar comprobante:', comprobanteError)
    throw new Error('Comprobante no encontrado')
  }

  // 2. Obtener serie y caja (usando el campo serie del comprobante)
  let serieCaja = null
  if (comprobante.serie) {
    const { data: serieData } = await supabase
      .from('series_comprobante')
      .select(`
        serie,
        cajas (
          nombre
        )
      `)
      .eq('serie', comprobante.serie)
      .single()

    serieCaja = serieData
  }

  // Formatear datos para el Sheet
  const cajaFromSerie = (serieCaja?.cajas as any)
  const comprobanteFormatted = {
    ...comprobante,
    // Serie y caja
    caja_nombre: cajaFromSerie?.nombre || null,

    // Reserva
    reserva_id: comprobante.reservas?.id || null,
    codigo_reserva: comprobante.reservas?.codigo_reserva || null,
    habitacion_numero: comprobante.reservas?.habitaciones?.numero || null,

    // Emisor (desde turno)
    emisor_nombre: comprobante.caja_turnos?.usuarios
      ? `${comprobante.caja_turnos.usuarios.nombres} ${comprobante.caja_turnos.usuarios.apellidos || ''}`.trim()
      : null
  }

  // 3. Obtener items/detalles
  const { data: detalles, error: detallesError } = await supabase
    .from('comprobante_detalles')
    .select('*')
    .eq('comprobante_id', comprobante_id)
    .order('id', { ascending: true })

  if (detallesError) {
    console.error('Error al obtener detalles:', detallesError)
    throw new Error('Error al cargar detalles del comprobante')
  }

  return {
    comprobante: comprobanteFormatted,
    detalles: detalles || []
  }
}

// ========================================
// OBTENER ESTADÍSTICAS DE FACTURACIÓN
// ========================================
export async function getEstadisticasFacturacion(fecha_desde?: string, fecha_hasta?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('vw_historial_comprobantes')
    .select('tipo_comprobante, total_venta, estado_sunat')

  if (fecha_desde) {
    query = query.gte('fecha_emision', fecha_desde)
  }

  if (fecha_hasta) {
    query = query.lte('fecha_emision', fecha_hasta)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error al obtener estadísticas:', error)
    return {
      total_boletas: 0,
      total_facturas: 0,
      total_anuladas: 0,
      total_pendientes: 0,
      monto_total: 0
    }
  }

  const stats = {
    total_boletas: data.filter(c => c.tipo_comprobante === 'BOLETA' && c.estado_sunat !== 'ANULADO').length,
    total_facturas: data.filter(c => c.tipo_comprobante === 'FACTURA' && c.estado_sunat !== 'ANULADO').length,
    total_anuladas: data.filter(c => c.estado_sunat === 'ANULADO').length,
    total_pendientes: data.filter(c => c.estado_sunat === 'PENDIENTE').length,
    monto_total: data
      .filter(c => c.estado_sunat !== 'ANULADO')
      .reduce((sum, c) => sum + (c.total_venta || 0), 0)
  }

  return stats
}

// ========================================
// OBTENER COMPROBANTES DE UNA RESERVA
// ========================================
export async function getComprobantesByReserva(reserva_id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comprobantes')
    .select(`
      *,
      series_comprobante (
        serie,
        tipo_comprobante
      ),
      comprobante_detalles (
        descripcion,
        cantidad,
        precio_unitario,
        subtotal
      )
    `)
    .eq('reserva_id', reserva_id)
    .order('fecha_emision', { ascending: false })

  if (error) {
    console.error('Error al obtener comprobantes:', error)
    throw new Error('Error al obtener comprobantes')
  }

  return data || []
}

// ========================================
// OBTENER SERIES DISPONIBLES PARA EMITIR
// ========================================
export async function getSeriesDisponibles(tipo_comprobante: 'BOLETA' | 'FACTURA') {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('series_comprobante')
    .select(`
      id,
      serie,
      tipo_comprobante,
      correlativo_actual,
      cajas (
        nombre,
        estado
      )
    `)
    .eq('tipo_comprobante', tipo_comprobante)
    .eq('cajas.estado', true)
    .order('serie', { ascending: true })

  if (error) {
    console.error('Error al obtener series:', error)
    throw new Error('Error al obtener series disponibles')
  }

  return data || []
}

// ========================================
// ANULAR COMPROBANTE (NOTA DE CRÉDITO)
// ========================================
export async function anularComprobante(comprobante_id: string, motivo: string) {
  const supabase = await createClient()

  // 1. Obtener comprobante original
  const { data: comprobante, error: comprobanteError } = await supabase
    .from('comprobantes')
    .select('*')
    .eq('id', comprobante_id)
    .single()

  if (comprobanteError || !comprobante) {
    throw new Error('Comprobante no encontrado')
  }

  if (comprobante.estado_sunat === 'ANULADO') {
    throw new Error('El comprobante ya está anulado')
  }

  // 2. Marcar como anulado
  const { error: updateError } = await supabase
    .from('comprobantes')
    .update({
      estado_sunat: 'ANULADO',
      observaciones: `${comprobante.observaciones || ''}\nANULADO: ${motivo}`
    })
    .eq('id', comprobante_id)

  if (updateError) {
    console.error('Error al anular comprobante:', updateError)
    throw new Error('Error al anular el comprobante')
  }

  // 3. TODO: Generar Nota de Crédito electrónica vía NubeFact
  // - Crear nuevo comprobante tipo NOTA_CREDITO
  // - Referenciar al comprobante original
  // - Enviar a NubeFact con tipo_nota_credito='01'

  revalidatePath('/comprobantes')

  return { success: true, message: 'Comprobante anulado correctamente' }
}

// ========================================
// OBTENER COMPROBANTES PENDIENTES DE ENVÍO A SUNAT
// ========================================
export async function getComprobantesPendientesSunat() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comprobantes')
    .select('*')
    .eq('estado_sunat', 'PENDIENTE')
    .order('fecha_emision', { ascending: true })

  if (error) {
    console.error('Error al obtener comprobantes pendientes:', error)
    return []
  }

  return data || []
}

// ========================================
// EMITIR NOTA DE CRÉDITO PARCIAL
// ========================================
// Tipo 07: Devolución por ítem (por defecto)
// Tipo 09: Ajuste de montos (Disminución en el valor)
export type EmitirNotaCreditoInput = {
  comprobante_original_id: string
  monto_devolucion: number
  motivo: string
  dias_devueltos?: number
  tipo_nota_credito?: number // 7 o 9
}

export async function emitirNotaCreditoParcial(input: EmitirNotaCreditoInput) {
  const supabase = await createClient()

  try {
    // 0. Obtener configuración (para IGV)
    const config = await getHotelConfig()
    const TASA_IGV = config.es_exonerado_igv ? 0 : (config.tasa_igv || 18.00) / 100
    const CODIGO_TIPO_NC = input.tipo_nota_credito || 7

    // 1. Obtener comprobante original
    const { data: comprobanteOriginal, error: comprobanteError } = await supabase
      .from('comprobantes')
      .select('*')
      .eq('id', input.comprobante_original_id)
      .single()

    if (comprobanteError || !comprobanteOriginal) {
      return { success: false, error: 'Comprobante original no encontrado' }
    }

    if (comprobanteOriginal.estado_sunat === 'ANULADO') {
      return { success: false, error: 'No se puede emitir NC sobre comprobante anulado' }
    }

    // 2. Obtener turno de caja activo
    const { data: turnoActivo, error: turnoError } = await supabase
      .from('caja_turnos')
      .select('id')
      .eq('estado', 'ABIERTA')
      .maybeSingle()

    if (turnoError || !turnoActivo) {
      return { success: false, error: 'No hay un turno de caja activo' }
    }

    // 3. Obtener serie de NC correcta (F... para Facturas, B... para Boletas)
    // NOTA: La tabla series_comprobante diferencia por (serie, tipo).
    const prefijoRequerido = comprobanteOriginal.tipo_comprobante === 'FACTURA' ? 'F%' : 'B%'

    const { data: serieNC } = await supabase
      .from('series_comprobante')
      .select('serie')
      .eq('tipo_comprobante', 'NOTA_CREDITO')
      .ilike('serie', prefijoRequerido)
      .limit(1)
      .maybeSingle()

    if (!serieNC) {
      return {
        success: false,
        error: `No hay serie de Nota de Crédito configurada para ${comprobanteOriginal.tipo_comprobante} (Debe empezar con ${prefijoRequerido[0]})`
      }
    }

    // 4. Calcular montos de la NC basándose en el comprobante ORIGINAL (Consistencia Fiscal)
    // Heredamos la condición de impuestos del padre para evitar descuadres.
    const monto_devolucion = input.monto_devolucion
    const esOriginalExonerado = (comprobanteOriginal.op_exoneradas || 0) > 0

    let base_imponible = 0
    let monto_igv = 0
    let op_gravadas = 0
    let op_exoneradas = 0

    // Usamos TASA_IGV del scope superior (configuración actual) o 0.18 como fallback si se desea
    // Pero aquí usamos la lógica basada en el original:
    if (esOriginalExonerado) {
      op_exoneradas = monto_devolucion
    } else {
      // Cálculo inverso asumiendo 18% si no es exonerado (estándar Perú)
      base_imponible = monto_devolucion / 1.18
      monto_igv = monto_devolucion - base_imponible
      op_gravadas = base_imponible
    }

    // 5. Crear la Nota de Crédito usando función atómica (correlativo se obtiene e inserta en una sola transacción)
    let notaCredito: { id: string; serie: string; numero: number; numero_completo: string }
    try {
      notaCredito = await insertarComprobanteAtomico({
        serie: serieNC.serie,
        tipo_comprobante: 'NOTA_CREDITO',
        turno_caja_id: turnoActivo.id,
        reserva_id: comprobanteOriginal.reserva_id,
        receptor_tipo_doc: comprobanteOriginal.receptor_tipo_doc,
        receptor_nro_doc: comprobanteOriginal.receptor_nro_doc,
        receptor_razon_social: comprobanteOriginal.receptor_razon_social,
        receptor_direccion: comprobanteOriginal.receptor_direccion,
        moneda: comprobanteOriginal.moneda || 'PEN',
        tipo_cambio: 1.0,
        op_gravadas: op_gravadas,
        op_exoneradas: op_exoneradas,
        monto_igv: monto_igv,
        total_venta: monto_devolucion,
        nota_credito_ref_id: comprobanteOriginal.id
      })
    } catch (ncError: any) {
      console.error('Error al crear NC:', ncError)
      return { success: false, error: 'Error al registrar Nota de Crédito en base de datos' }
    }

    // 7. Crear detalle de la NC
    const descripcionItem = input.dias_devueltos
      ? `Devolución por acortamiento de estadía (${input.dias_devueltos} noches)`
      : `Devolución parcial: ${input.motivo}`

    // Calcular valores unitarios
    const cantidad = input.dias_devueltos || 1
    const subtotalLinea = esOriginalExonerado ? op_exoneradas : op_gravadas
    const precioUnitario = monto_devolucion / cantidad
    const valorUnitario = subtotalLinea / cantidad

    await supabase
      .from('comprobante_detalles')
      .insert({
        comprobante_id: notaCredito.id,
        descripcion: descripcionItem,
        cantidad: cantidad,
        precio_unitario: precioUnitario,
        subtotal: subtotalLinea,
        codigo_afectacion_igv: esOriginalExonerado ? '20' : '10'
      })

    // 8. ENVIAR A NUBEFACT
    try {
      const fechaFormateada = `${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`

      // Preparar item para Nubefact
      const itemsNubefact = [{
        unidad_de_medida: 'ZZ',
        codigo: '90101501',
        descripcion: descripcionItem,
        cantidad: cantidad,
        valor_unitario: Number(valorUnitario.toFixed(10)),
        precio_unitario: Number(precioUnitario.toFixed(2)),
        subtotal: Number(subtotalLinea.toFixed(2)),
        tipo_de_igv: esOriginalExonerado ? 8 : 1,
        igv: Number(monto_igv.toFixed(2)),
        total: Number(monto_devolucion.toFixed(2))
      }]

      const respuesta = await enviarComprobanteNubefact({
        tipo_comprobante: 'NOTA_CREDITO',
        serie: serieNC.serie,
        numero: notaCredito.numero,
        cliente_tipo_documento: comprobanteOriginal.receptor_tipo_doc,
        cliente_numero_documento: comprobanteOriginal.receptor_nro_doc,
        cliente_denominacion: comprobanteOriginal.receptor_razon_social,
        cliente_direccion: comprobanteOriginal.receptor_direccion,
        fecha_emision: fechaFormateada,
        moneda: 'PEN',
        tipo_cambio: 1.000,
        porcentaje_igv: 18,
        total_gravada: op_gravadas,
        total_exonerada: op_exoneradas,
        total_igv: monto_igv,
        total: monto_devolucion,
        items: itemsNubefact,

        // CAMPOS DE NOTA DE CRÉDITO
        tipo_nota_credito: CODIGO_TIPO_NC.toString(), // "7" o "9"
        motivo_nota_credito: descripcionItem,

        // Referencia
        comprobante_referencia_tipo: comprobanteOriginal.tipo_comprobante,
        comprobante_referencia_serie: comprobanteOriginal.serie,
        comprobante_referencia_numero: comprobanteOriginal.numero
      })

      if (respuesta.success && respuesta.aceptada_por_sunat) {
        // ACEPTADO por SUNAT
        await supabase.from('comprobantes').update({
          estado_sunat: 'ACEPTADO',
          hash_cpe: respuesta.hash,
          xml_url: respuesta.enlace,
          cdr_url: respuesta.enlace_del_cdr,
          pdf_url: respuesta.enlace_pdf,
          external_id: respuesta.enlace_pdf
        }).eq('id', notaCredito.id)

        logger.info('Nota de Crédito aceptada por SUNAT', { nc_id: notaCredito.id })
      } else if (respuesta.success && !respuesta.aceptada_por_sunat) {
        // PENDIENTE: Enviado a SUNAT pero aún en proceso
        await supabase.from('comprobantes').update({
          estado_sunat: 'PENDIENTE',
          hash_cpe: respuesta.hash,
          xml_url: respuesta.enlace,
          pdf_url: respuesta.enlace_pdf,
          observaciones: respuesta.mensaje || 'Enviado a SUNAT (En Proceso)'
        }).eq('id', notaCredito.id)

        logger.info('Nota de Crédito en proceso (PENDIENTE)', { nc_id: notaCredito.id })
      } else {
        // RECHAZADO: La respuesta no fue exitosa
        await supabase.from('comprobantes').update({
          estado_sunat: 'RECHAZADO',
          observaciones: respuesta.errors || respuesta.mensaje || 'Error desconocido'
        }).eq('id', notaCredito.id)

        logger.warn('Nota de Crédito rechazada por SUNAT', { nc_id: notaCredito.id, error: respuesta.errors })
      }

    } catch (nubefactError) {
      logger.error('Error al enviar NC a Nubefact', { originalError: getErrorMessage(nubefactError) })
      // Queda PENDIENTE para reenvío manual
    }

    revalidatePath('/comprobantes')

    return {
      success: true,
      notaCredito: {
        id: notaCredito.id,
        numero: notaCredito.numero_completo,
        monto: monto_devolucion
      },
      mensaje: `Nota de Crédito ${notaCredito.numero_completo} emitida por S/${monto_devolucion.toFixed(2)}`
    }

  } catch (error) {
    console.error('Error en emitirNotaCreditoParcial:', error)
    return { success: false, error: 'Error al procesar la Nota de Crédito' }
  }
}

// ========================================
// ACTUALIZAR ESTADO DESDE NUBEFACT (MANUAL)
// ========================================
export async function actualizarEstadoComprobante(comprobanteId: string) {
  const supabase = await createClient()

  // 1. Obtener comprobante
  const { data: comprobante, error: errorDb } = await supabase
    .from('comprobantes')
    .select('*')
    .eq('id', comprobanteId)
    .single()

  if (errorDb || !comprobante) {
    return { success: false, message: 'Comprobante no encontrado' }
  }

  // 2. Consultar a Nubefact
  const resultado = await consultarEstadoNubefact(
    comprobante.tipo_comprobante,
    comprobante.serie,
    comprobante.numero
  )

  if (!resultado.success) {
    return { success: false, message: resultado.mensaje || resultado.errors || 'Error al consultar Nubefact' }
  }

  // 3. Actualizar BD según respuesta
  const nuevoEstado = resultado.aceptada_por_sunat ? 'ACEPTADO' : 'PENDIENTE'

  // Detectar rechazo real
  let estadoFinal = nuevoEstado
  if (!resultado.aceptada_por_sunat && resultado.codigo_sunat && parseInt(resultado.codigo_sunat) > 0 && parseInt(resultado.codigo_sunat) < 4000) {
    if (resultado.mensaje?.toUpperCase().includes('RECHAZADO')) {
      estadoFinal = 'RECHAZADO'
    }
  }

  const updates: any = {
    estado_sunat: estadoFinal,
    observaciones: resultado.mensaje,
    updated_at: new Date().toISOString()
  }

  if (resultado.enlace_pdf) updates.pdf_url = resultado.enlace_pdf
  if (resultado.enlace_del_cdr) updates.cdr_url = resultado.enlace_del_cdr
  if (resultado.enlace) updates.xml_url = resultado.enlace

  const { error: updateError } = await supabase
    .from('comprobantes')
    .update(updates)
    .eq('id', comprobanteId)

  if (updateError) {
    return { success: false, message: 'Error al actualizar base de datos' }
  }

  revalidatePath('/facturacion')
  return { success: true, message: 'Estado actualizado correctamente' }
}

// ========================================
// EMITIR NOTA DE CRÉDITO MANUAL
// ========================================
// Para casos donde el usuario necesita emitir una NC manualmente
// desde la pantalla de facturación (errores, descuentos, anulaciones)

export type EmitirNotaCreditoManualInput = {
  comprobante_original_id: string
  tipo_nota_credito: number // 1, 6, 9, 10
  monto_devolucion: number
  motivo: string
}

export async function emitirNotaCreditoManual(input: EmitirNotaCreditoManualInput) {
  const supabase = await createClient()

  try {
    // 1. Validar que el comprobante original existe y es válido
    const { data: comprobanteOriginal, error: comprobanteError } = await supabase
      .from('comprobantes')
      .select('*')
      .eq('id', input.comprobante_original_id)
      .single()

    if (comprobanteError || !comprobanteOriginal) {
      return { success: false, error: 'Comprobante original no encontrado' }
    }

    // Validar que no sea ya una NC
    if (comprobanteOriginal.tipo_comprobante === 'NOTA_CREDITO') {
      return { success: false, error: 'No se puede emitir una NC sobre otra NC' }
    }

    // Validar estado del comprobante
    if (comprobanteOriginal.estado_sunat === 'ANULADO') {
      return { success: false, error: 'El comprobante ya está anulado' }
    }

    if (comprobanteOriginal.estado_sunat === 'RECHAZADO') {
      return { success: false, error: 'No se puede emitir NC sobre un comprobante rechazado por SUNAT' }
    }

    // Validar monto
    if (input.monto_devolucion <= 0) {
      return { success: false, error: 'El monto debe ser mayor a cero' }
    }

    if (input.monto_devolucion > comprobanteOriginal.total_venta) {
      return {
        success: false,
        error: `El monto (${input.monto_devolucion}) supera el total del comprobante (${comprobanteOriginal.total_venta})`
      }
    }

    // Para tipos 1 y 6 (anulación total), el monto debe ser igual al total
    const tiposAnulacionTotal = [1, 6]
    if (tiposAnulacionTotal.includes(input.tipo_nota_credito)) {
      if (input.monto_devolucion !== comprobanteOriginal.total_venta) {
        return {
          success: false,
          error: 'Para anulación total, el monto debe ser igual al total del comprobante'
        }
      }
    }

    // Validar motivo
    if (!input.motivo || input.motivo.trim().length < 5) {
      return { success: false, error: 'El motivo debe tener al menos 5 caracteres' }
    }

    // 2. Usar la función existente pero con el tipo de NC especificado
    const resultadoNC = await emitirNotaCreditoParcial({
      comprobante_original_id: input.comprobante_original_id,
      monto_devolucion: input.monto_devolucion,
      motivo: input.motivo.trim(),
      tipo_nota_credito: input.tipo_nota_credito
    })

    if (!resultadoNC.success) {
      return resultadoNC
    }

    // 3. Si es anulación total (tipos 1 o 6), marcar comprobante original como anulado
    if (tiposAnulacionTotal.includes(input.tipo_nota_credito)) {
      await supabase
        .from('comprobantes')
        .update({
          estado_sunat: 'ANULADO',
          observaciones: `Anulado por NC ${resultadoNC.notaCredito?.numero}`
        })
        .eq('id', input.comprobante_original_id)
    }

    logger.info('Nota de Crédito manual emitida exitosamente', {
      action: 'emitirNotaCreditoManual',
      tipo: input.tipo_nota_credito,
      monto: input.monto_devolucion,
      nc_numero: resultadoNC.notaCredito?.numero
    })

    revalidatePath('/facturacion')

    return {
      success: true,
      notaCredito: resultadoNC.notaCredito,
      mensaje: resultadoNC.mensaje
    }

  } catch (error) {
    logger.error('Error en emitirNotaCreditoManual', {
      action: 'emitirNotaCreditoManual',
      originalError: getErrorMessage(error)
    })
    return { success: false, error: 'Error inesperado al procesar la Nota de Crédito' }
  }
}

