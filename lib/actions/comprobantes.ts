'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
// OBTENER SIGUIENTE CORRELATIVO (ATÓMICO)
// ========================================
async function obtenerSiguienteCorrelativo(serie: string): Promise<{
  correlativo: number
  numero_completo: string
}> {
  const supabase = await createClient()

  // Llamar a la función de Postgres que incrementa atómicamente
  const { data: correlativo, error } = await supabase
    .rpc('obtener_siguiente_correlativo', {
      p_serie: serie
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
    .single()

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

  // 4. Calcular montos
  const op_gravadas = input.items.reduce((sum, item) => sum + item.subtotal, 0)
  const monto_igv = op_gravadas * 0.18 // 18% IGV
  const total_venta = op_gravadas + monto_igv

  // 5. Obtener siguiente correlativo (atómico)
  const { correlativo, numero_completo } = await obtenerSiguienteCorrelativo(input.serie)

  // 6. Crear comprobante
  const { data: comprobante, error: comprobanteError } = await supabase
    .from('comprobantes')
    .insert({
      turno_caja_id: turnoActivo.id,
      reserva_id: input.reserva_id,
      tipo_comprobante: input.tipo_comprobante,
      serie: input.serie,
      numero: correlativo,
      
      receptor_tipo_doc: input.cliente_tipo_doc,
      receptor_nro_doc: input.cliente_numero_doc,
      receptor_razon_social: input.cliente_nombre,
      receptor_direccion: input.cliente_direccion,
      
      moneda: 'PEN',
      tipo_cambio: 1.000,
      op_gravadas: op_gravadas,
      op_exoneradas: 0.00,
      op_inafectas: 0.00,
      monto_igv: monto_igv,
      monto_icbper: 0.00,
      total_venta: total_venta,
      
      estado_sunat: 'PENDIENTE',
      fecha_emision: new Date().toISOString(),
    })
    .select()
    .single()

  if (comprobanteError) {
    console.error('Error al crear comprobante:', comprobanteError)
    throw new Error('Error al emitir el comprobante')
  }

  // 7. Crear items del comprobante
  const itemsToInsert = input.items.map(item => ({
    comprobante_id: comprobante.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    subtotal: item.subtotal,
    codigo_afectacion_igv: item.codigo_afectacion_igv || '10'
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

  // 8. TODO: Enviar a SUNAT (integración futura)
  // - Generar XML
  // - Firmar con certificado digital
  // - Enviar a webservice de SUNAT
  // - Actualizar estado_sunat, hash_cpe, xml_firmado

  revalidatePath('/comprobantes')
  revalidatePath('/rack')

  return comprobante
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
    .select('*')

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

  return data || []
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
      reservas (
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
    throw new Error('Comprobante no encontrado')
  }

  // 2. Obtener items/detalles
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
    comprobante,
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

  // 3. TODO: Generar Nota de Crédito electrónica en SUNAT
  // - Crear nuevo comprobante tipo NOTA_CREDITO
  // - Referenciar al comprobante original
  // - Enviar a SUNAT

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
